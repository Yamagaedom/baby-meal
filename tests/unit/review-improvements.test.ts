import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { calculateIngredientMatch } from "@/features/ingredient-search";
import {
  addDays,
  generateWeek,
  scheduledCookingDays,
  aggregateNutrition,
} from "@/features/meal-plan/engine";
import { preferencesSchema, NUTRIENTS, type RecipeSnapshot } from "@/features/meal-plan/types";
import { getPrisma } from "@/lib/db";
import { createBabyProfile } from "@/features/profile";
import { createPlan, changePlan, getPlannerData, addStock } from "@/features/meal-plan/service";
import { kstDateString } from "@/lib/age";
import type { IngredientInfo } from "@/lib/domain/types";

const nutrition = {
  values: Object.fromEntries(NUTRIENTS.map((n) => [n.key, 10])),
  coverage: Object.fromEntries(NUTRIENTS.map((n) => [n.key, 1])),
  missing: [],
  sources: [],
} as unknown as RecipeSnapshot["nutrition"];
const recipe = (
  id: string,
  type: RecipeSnapshot["dishType"],
  groups = ["VEGETABLE"],
): RecipeSnapshot => ({
  id,
  name: id,
  category: "MEAL",
  role: type === "ONE_BOWL" ? "MAIN" : type,
  dishType: type,
  cookMinutes: 10,
  baseServings: 2,
  updatedAt: "v1",
  contentVersion: "v1",
  verified: true,
  groups,
  ingredientIds: [id],
  ingredients: [{ id, name: id, amount: 100, unit: "g", optional: false }],
  nutrition,
});

describe("review improvements: exact inventory, intervals, meal structure", () => {
  it("does not silently equate tofu/soft tofu or rice/cooked rice", () => {
    const names = ["두부", "순두부", "백미", "쌀밥"];
    const dict = new Map(
      names.map((name, i) => [
        String(i),
        {
          id: String(i),
          name,
          synonyms: [],
          group: "LEGUME_TOFU",
          allergens: [],
          minAgeMonth: 12,
          sodiumMgPer100g: 0,
          gramsPerPiece: null,
          densityGPerMl: 1,
          isSaltySeasoning: false,
          cautionNote: null,
        } as IngredientInfo,
      ]),
    );
    expect(
      calculateIngredientMatch(
        [{ ingredientId: "1", isOptional: false }],
        ["0"],
        dict,
        new Set(),
        false,
      ).matchRate,
    ).toBe(0);
    expect(
      calculateIngredientMatch(
        [{ ingredientId: "3", isOptional: false }],
        ["2"],
        dict,
        new Set(),
        false,
      ).missingIngredients,
    ).toEqual(["쌀밥"]);
  });
  it("keeps a 3-day anchored schedule across a week boundary", () => {
    const prefs = preferencesSchema.parse({
      startDate: "2026-11-03",
      cookingInterval: 3,
      cookingAnchor: "2026-11-03",
    });
    expect(scheduledCookingDays(prefs)).toEqual(["2026-11-03", "2026-11-06", "2026-11-09"]);
    expect(scheduledCookingDays({ ...prefs, startDate: "2026-11-10" })).toEqual([
      "2026-11-12",
      "2026-11-15",
    ]);
  });
  it("builds soup, one-bowl and rice plus four sides without disguising eggs as meat", () => {
    const prefs = preferencesSchema.parse({
      startDate: "2026-11-03",
      snackCount: 0,
      mealStyles: { BREAKFAST: "SOUP", LUNCH: "ONE_BOWL", DINNER: "RICE_SIDES" },
      sideCount: 4,
      sidePortion: 0.5,
    });
    const catalog = [
      recipe("soup", "SOUP"),
      recipe("bowl", "ONE_BOWL"),
      recipe("rice", "STAPLE"),
      recipe("meat", "SIDE", ["MEAT"]),
      recipe("egg", "SIDE", ["EGG"]),
      recipe("veg", "SIDE"),
      recipe("tofu", "SIDE", ["LEGUME_TOFU"]),
    ];
    const entries = generateWeek(prefs, catalog);
    const dinner = entries.filter((e) => e.date === prefs.startDate && e.mealTime === "DINNER");
    expect(dinner).toHaveLength(5);
    expect(dinner[0].recipeId).toBe("rice");
    expect(dinner[1].recipeId).toBe("meat");
    expect(new Set(dinner.map((e) => e.recipeId)).size).toBe(5);
    expect(dinner.slice(1).every((e) => e.servings === 0.5)).toBe(true);
    expect(entries.find((e) => e.mealTime === "BREAKFAST")?.recipeId).toBe("soup");
    expect(
      aggregateNutrition(
        dinner.map((e) => ({
          nutrition: (e.snapshot as RecipeSnapshot).nutrition,
          servings: e.servings,
        })),
      ).values.protein,
    ).toBe(30);
    const noMeat = generateWeek(
      prefs,
      catalog.filter((r) => r.id !== "meat"),
    ).find((e) => e.mealTime === "DINNER" && e.position === 1)!;
    expect(noMeat.recipeId).toBeNull();
    expect(noMeat.name).toContain("고기");
  });
  it("reuses a dish within a cooking interval only when requested", () => {
    const prefs = preferencesSchema.parse({
      startDate: "2026-11-03",
      meals: ["DINNER"],
      snackCount: 0,
      cookingInterval: 3,
      repeatMeals: true,
    });
    const dinner = generateWeek(prefs, [recipe("a", "ONE_BOWL"), recipe("b", "ONE_BOWL")]).filter(
      (e) => e.kind === "HOME",
    );
    expect(dinner[0].recipeId).toBe(dinner[1].recipeId);
    expect(dinner[1].recipeId).toBe(dinner[2].recipeId);
  });
});

it("multiple dishes: partial servings reserve, serve atomically and retry without double deduction", async () => {
  const db = getPrisma();
  const today = kstDateString(new Date());
  const user = await db.user.create({
    data: { loginId: `components-${randomUUID()}`, passwordHash: "test", recoveryCodeHash: "test" },
  });
  try {
    const { baby } = await createBabyProfile(user.id, { ageMonth: 24, saltLevel: "NONE" }, db);
    const { id } = await createPlan(
      user.id,
      baby,
      {
        startDate: today,
        meals: ["DINNER"],
        snackCount: 0,
        mealStyles: { DINNER: "RICE_SIDES" },
        sideCount: 4,
        sidePortion: 0.5,
      },
      db,
    );
    let view = (await getPlannerData(user.id, baby, db)).plans.find((p) => p.id === id)!;
    const dinner = view.entries.filter((e) => e.date === today && e.mealTime === "DINNER");
    expect(dinner.every((e) => !!e.recipeId)).toBe(true);
    expect(dinner).toHaveLength(5);
    for (const e of dinner)
      await addStock(
        user.id,
        baby,
        {
          name: e.name,
          recipeId: e.recipeId,
          category: "MEAL",
          location: "FREEZER",
          servings: 2,
          preparedDate: today,
          expiresDate: addDays(today, 7),
          eventKey: randomUUID(),
        },
        db,
      );
    await changePlan(user.id, baby, id, { action: "CONFIRM", revision: view.revision }, db);
    view = (await getPlannerData(user.id, baby, db)).plans.find((p) => p.id === id)!;
    const command = {
      action: "SERVE_MEAL",
      mealTime: "DINNER",
      revision: view.revision,
      amounts: dinner.map((e) => ({ entryId: e.id, rating: "GOOD", amountEaten: "HALF" })),
    };
    await changePlan(user.id, baby, id, command, db);
    await changePlan(user.id, baby, id, command, db);
    expect(await db.mealLog.count({ where: { babyId: baby.id } })).toBe(5);
    const batches = await db.foodBatch.findMany({ where: { userId: user.id } });
    expect(batches.map((b) => b.remaining).sort()).toEqual([1, 1.5, 1.5, 1.5, 1.5]);
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
}, 30000);
