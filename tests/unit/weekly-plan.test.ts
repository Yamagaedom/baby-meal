import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createBabyProfile } from "@/features/profile";
import { addDays, aggregateNutrition, generateWeek } from "@/features/meal-plan/engine";
import { estimateRecipeNutrition } from "@/features/meal-plan/nutrition";
import {
  addStock,
  changePlan,
  createPlan,
  getPlannerData,
  moveStock,
} from "@/features/meal-plan/service";
import {
  NUTRIENTS,
  preferencesSchema,
  type NutritionEstimate,
  type RecipeSnapshot,
} from "@/features/meal-plan/types";
import { kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";

const emptyNutrition: NutritionEstimate = {
  values: Object.fromEntries(NUTRIENTS.map((n) => [n.key, null])) as NutritionEstimate["values"],
  coverage: Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0])) as NutritionEstimate["coverage"],
  missing: ["未確認"],
  sources: [],
};
const fixture = (id: string, changes: Partial<RecipeSnapshot> = {}): RecipeSnapshot => ({
  id,
  name: id,
  category: "MEAL",
  role: "MAIN",
  cookMinutes: 10,
  baseServings: 2,
  updatedAt: "v1",
  contentVersion: "v1",
  verified: true,
  groups: ["GRAIN"],
  ingredientIds: [id],
  ingredients: [{ id, name: id, amount: 100, unit: "g", optional: false }],
  nutrition: emptyNutrition,
  ...changes,
});

describe("weekly planning rules", () => {
  it("excludes unverified candidates and keeps external weekday lunches and two snack slots", () => {
    const prefs = preferencesSchema.parse({
      startDate: "2026-11-02",
      schedule: "WORKDAY",
      snackCount: 2,
    });
    const entries = generateWeek(prefs, [
      fixture("fake", { verified: false }),
      fixture("valid"),
      fixture("snack", { category: "SNACK", role: "SNACK" }),
    ]);
    expect(entries).toHaveLength(35);
    expect(entries.filter((e) => e.recipeId === "fake")).toHaveLength(0);
    expect(entries.filter((e) => e.mealTime === "LUNCH" && e.kind === "EXTERNAL")).toHaveLength(5);
    expect(
      entries
        .filter((e) => e.mealTime === "SNACK" && e.date === "2026-11-02")
        .map((e) => e.slotIndex),
    ).toEqual([0, 1]);
  });
  it("prioritizes selected ingredients and leaves blanks when shopping is forbidden", () => {
    const selected = randomUUID();
    const prefs = preferencesSchema.parse({
      startDate: "2026-11-01",
      selectedIngredientIds: [selected],
      priorities: ["PANTRY"],
    });
    const match = fixture("selected", {
      ingredientIds: [selected],
      ingredients: [{ id: selected, name: "carrot", amount: 50, unit: "g", optional: false }],
    });
    expect(generateWeek(prefs, [fixture("other"), match])[0].recipeId).toBe("selected");
    expect(
      generateWeek({ ...prefs, allowShopping: false }, [fixture("other")])[0].recipeId,
    ).toBeNull();
  });
  it("does not inflate unknown nutrients to zero or mark partial totals complete", () => {
    expect(aggregateNutrition([{ nutrition: emptyNutrition, servings: 4 }]).values.iron).toBeNull();
    const partial = {
      ...emptyNutrition,
      values: { ...emptyNutrition.values, protein: 5 },
      coverage: { ...emptyNutrition.coverage, protein: 0.5 },
    };
    const total = aggregateNutrition([
      { nutrition: partial, servings: 2 },
      { nutrition: emptyNutrition, servings: 1 },
    ]);
    expect(total.values.protein).toBe(10);
    expect(total.coverage.protein).toBe(0);
  });
  it("does not apply the sodium validator's pinch assumption to quantitative nutrition", () => {
    const ingredient = {
      id: "x",
      name: "test",
      synonyms: [],
      group: "GRAIN" as const,
      allergens: [],
      minAgeMonth: 12,
      sodiumMgPer100g: 1,
      gramsPerPiece: null,
      densityGPerMl: 1,
      isSaltySeasoning: false,
      cautionNote: null,
      nutrition: { per100g: { protein: 5 } },
    };
    const result = estimateRecipeNutrition(2, [
      { amount: null, unit: "약간", isOptional: false, ingredient },
    ]);
    expect(result.values.protein).toBeNull();
    expect(result.missing).toEqual(["test"]);
  });
  it("preserves calendar dates across month and year boundaries", () => {
    expect(addDays("2026-12-29", 6)).toBe("2027-01-04");
  });
});

describe("weekly planning database lifecycle", () => {
  const prisma = getPrisma();
  const userIds: string[] = [];
  const today = kstDateString(new Date());
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });
  async function setup() {
    const user = await prisma.user.create({
      data: {
        loginId: `weekly-${randomUUID()}`,
        passwordHash: "test-unused",
        recoveryCodeHash: "test-unused",
      },
    });
    userIds.push(user.id);
    const { baby } = await createBabyProfile(
      user.id,
      { nickname: "주간테스트", ageMonth: 18, saltLevel: "NONE" },
      prisma,
    );
    return { user, baby };
  }
  const preferences = {
    startDate: today,
    schedule: "CUSTOM",
    meals: ["DINNER"],
    snackCount: 0,
    cookingMode: "BATCH",
    cookingDays: [0, 3],
  };
  it("confirm reserves only; serve is atomic and idempotent; archiving releases reservations, not stock", async () => {
    const { user, baby } = await setup();
    const { id } = await createPlan(user.id, baby, preferences, prisma);
    let view = (await getPlannerData(user.id, baby, prisma)).plans.find((p) => p.id === id)!;
    const entry = view.entries.find((e) => e.date === today && e.kind === "HOME")!;
    expect(entry.recipeId).toBeTruthy();
    await addStock(
      user.id,
      baby,
      {
        name: entry.name,
        recipeId: entry.recipeId,
        category: "MEAL",
        location: "FREEZER",
        servings: 4,
        preparedDate: today,
        expiresDate: addDays(today, 7),
        eventKey: randomUUID(),
      },
      prisma,
    );
    await changePlan(user.id, baby, id, { action: "CONFIRM", revision: view.revision }, prisma);
    const state = await getPlannerData(user.id, baby, prisma);
    view = state.plans.find((p) => p.id === id)!;
    expect(state.stock[0].remaining).toBe(4);
    expect(state.stock[0].reserved).toBeGreaterThan(0);
    const revision = view.revision;
    await changePlan(
      user.id,
      baby,
      id,
      { action: "SERVE", revision, entryId: entry.id, rating: "GOOD", amountEaten: "HALF" },
      prisma,
    );
    await changePlan(
      user.id,
      baby,
      id,
      { action: "SERVE", revision, entryId: entry.id, rating: "GOOD", amountEaten: "HALF" },
      prisma,
    );
    const after = await getPlannerData(user.id, baby, prisma);
    expect(after.stock[0].remaining).toBe(3);
    expect(await prisma.mealLog.count({ where: { babyId: baby.id } })).toBe(1);
    expect(
      (await prisma.mealLog.findFirstOrThrow({ where: { babyId: baby.id } })).amountEaten,
    ).toBe("HALF");
    view = after.plans.find((p) => p.id === id)!;
    await changePlan(user.id, baby, id, { action: "ARCHIVE", revision: view.revision }, prisma);
    const archived = await getPlannerData(user.id, baby, prisma);
    expect(archived.stock[0].remaining).toBe(3);
    expect(archived.stock[0].reserved).toBe(0);
  }, 30000);
  it("keeps locked entries, rejects stale edits and prevents cross-account plan access", async () => {
    const { user, baby } = await setup();
    const { id } = await createPlan(user.id, baby, preferences, prisma);
    let view = (await getPlannerData(user.id, baby, prisma)).plans[0];
    const entry = view.entries.find((e) => e.kind === "HOME")!;
    await changePlan(
      user.id,
      baby,
      id,
      { action: "ENTRY", revision: view.revision, entryId: entry.id, locked: true },
      prisma,
    );
    await expect(
      changePlan(user.id, baby, id, { action: "REGENERATE", revision: view.revision }, prisma),
    ).rejects.toMatchObject({ code: "PLAN_CHANGED" });
    view = (await getPlannerData(user.id, baby, prisma)).plans[0];
    await changePlan(user.id, baby, id, { action: "REGENERATE", revision: view.revision }, prisma);
    const locked = (await getPlannerData(user.id, baby, prisma)).plans[0].entries.find(
      (e) => e.id === entry.id,
    )!;
    expect(locked.recipeId).toBe(entry.recipeId);
    expect(locked.locked).toBe(true);
    const other = await setup();
    await expect(
      changePlan(other.user.id, other.baby, id, { action: "EDIT", revision: 0 }, prisma),
    ).rejects.toMatchObject({ status: 404 });
  }, 30000);
  it("never over-reserves stock across two babies and rejects spending reserved stock", async () => {
    const { user, baby } = await setup();
    const { baby: second } = await createBabyProfile(
      user.id,
      { ageMonth: 18, saltLevel: "NONE" },
      prisma,
    );
    const first = await createPlan(user.id, baby, preferences, prisma);
    const next = await createPlan(user.id, second, preferences, prisma);
    const recipe = (await getPlannerData(user.id, baby, prisma)).recipes.find(
      (r) => r.verified && r.category === "MEAL" && r.role === "MAIN",
    )!;
    await addStock(
      user.id,
      baby,
      {
        name: recipe.name,
        recipeId: recipe.id,
        category: "MEAL",
        location: "FREEZER",
        servings: 1,
        preparedDate: today,
        expiresDate: addDays(today, 7),
        eventKey: randomUUID(),
      },
      prisma,
    );
    await Promise.all([
      changePlan(user.id, baby, first.id, { action: "CONFIRM", revision: 0 }, prisma),
      changePlan(user.id, second, next.id, { action: "CONFIRM", revision: 0 }, prisma),
    ]);
    const data = await getPlannerData(user.id, baby, prisma);
    const stock = data.stock[0];
    expect(stock.reserved).toBe(1);
    expect(stock.remaining).toBe(1);
    await expect(
      moveStock(
        user.id,
        {
          id: stock.id,
          version: stock.version,
          action: "USE",
          servings: 1,
          eventKey: randomUUID(),
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "STOCK_RESERVED" });
  }, 30000);
  it("cooking adds actual stock once and creates a task for any remaining shortage", async () => {
    const { user, baby } = await setup();
    const { id } = await createPlan(user.id, baby, preferences, prisma);
    await changePlan(user.id, baby, id, { action: "CONFIRM", revision: 0 }, prisma);
    const view = (await getPlannerData(user.id, baby, prisma)).plans[0];
    const task = view.tasks.find((t) => t.date === today)!;
    const command = {
      action: "COOK",
      revision: view.revision,
      taskId: task.id,
      servings: 1,
      location: "FREEZER",
      expiresDate: addDays(today, 7),
    };
    await changePlan(user.id, baby, id, command, prisma);
    await changePlan(user.id, baby, id, command, prisma);
    const data = await getPlannerData(user.id, baby, prisma);
    expect(data.stock.reduce((sum, s) => sum + s.remaining, 0)).toBe(1);
    expect(
      await prisma.foodMovement.count({ where: { batch: { userId: user.id }, kind: "COOK" } }),
    ).toBe(1);
  }, 30000);
  it("manually confirmed food without a recipe can be reserved and served, with unknown nutrition preserved", async () => {
    const { user, baby } = await setup();
    const { id } = await createPlan(
      user.id,
      baby,
      { ...preferences, meals: [], useStock: false },
      prisma,
    );
    const batch = await addStock(
      user.id,
      baby,
      {
        name: "직접 만든 간식",
        category: "SNACK",
        location: "FRIDGE",
        servings: 1,
        preparedDate: today,
        expiresDate: today,
        eventKey: randomUUID(),
      },
      prisma,
    );
    await changePlan(
      user.id,
      baby,
      id,
      {
        action: "STOCK",
        revision: 0,
        batchId: batch.id,
        date: today,
        mealTime: "DINNER",
        servings: 1,
        confirmedIngredients: true,
      },
      prisma,
    );
    let view = (await getPlannerData(user.id, baby, prisma)).plans[0];
    const entry = view.entries.find((e) => e.name === "직접 만든 간식")!;
    expect(entry.needsAttention).toBe(false);
    expect(entry.recipeId).toBeNull();
    expect(entry.locked).toBe(true);
    await changePlan(user.id, baby, id, { action: "CONFIRM", revision: view.revision }, prisma);
    view = (await getPlannerData(user.id, baby, prisma)).plans[0];
    expect(view.entries.find((e) => e.id === entry.id)!.reserved).toBe(1);
    await changePlan(
      user.id,
      baby,
      id,
      { action: "SERVE", revision: view.revision, entryId: entry.id },
      prisma,
    );
    expect((await prisma.foodBatch.findUniqueOrThrow({ where: { id: batch.id } })).remaining).toBe(
      0,
    );
    expect(await prisma.mealLog.count({ where: { babyId: baby.id } })).toBe(0);
  }, 30000);
});
