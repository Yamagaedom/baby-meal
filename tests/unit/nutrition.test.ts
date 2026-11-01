import { describe, expect, it } from "vitest";
import { computeRecipeNutrition, getNutrientPer100g } from "@/features/nutrition";
import type { IngredientInfo } from "@/lib/domain/types";

const ingredient = (id: string, slug = id): IngredientInfo => ({
  id,
  slug,
  name: id,
  synonyms: [],
  group: "GRAIN",
  allergens: [],
  minAgeMonth: 12,
  sodiumMgPer100g: 999,
  gramsPerPiece: null,
  densityGPerMl: 1,
  isSaltySeasoning: false,
  cautionNote: null,
});
const dict = new Map(
  ["white-rice-cooked", "beef-minced", "zucchini", "unknown-broth", "milk"].map((id) => [
    id,
    ingredient(id),
  ]),
);
const row = (ingredientId: string, amount: number | null, isOptional = false, unit = "g") => ({
  ingredientId,
  amount,
  unit,
  isOptional,
});

describe("traceable recipe nutrition", () => {
  it("uses official food facts rather than invented overrides or group averages", () => {
    expect(getNutrientPer100g("beef-minced")?.energy).toBe(176);
    expect(getNutrientPer100g("unknown-broth")).toBeNull();
    const facts = computeRecipeNutrition(
      [row("white-rice-cooked", 160), row("beef-minced", 60), row("zucchini", 40)],
      dict,
      2,
    );
    expect(facts.caloriesKcal).toBe(160);
    expect(facts.estimate?.coverage.energy).toBe(1);
    expect(facts.estimate?.sources[0].title).toContain("USDA");
  });

  it("keeps unknown values and partial coverage instead of treating them as zero", () => {
    const unknown = computeRecipeNutrition([row("unknown-broth", 100)], dict, 2);
    expect(unknown.caloriesKcal).toBeNull();
    expect(unknown.sodiumMg).toBeNull();
    const partial = computeRecipeNutrition(
      [row("white-rice-cooked", 160), row("unknown-broth", 100)],
      dict,
      2,
    );
    expect(partial.caloriesKcal).toBe(104);
    expect(partial.estimate?.coverage.energy).toBe(0.5);
    expect(partial.estimate?.missing).toContain("unknown-broth");
  });

  it("excludes optional ingredients and unmeasured pinches", () => {
    const facts = computeRecipeNutrition(
      [row("white-rice-cooked", 160), row("milk", 100, true), row("zucchini", null, false, "약간")],
      dict,
      2,
    );
    expect(facts.caloriesKcal).toBe(104);
    expect(facts.estimate?.missing).toContain("zucchini");
    expect(facts.estimate?.missing).not.toContain("milk");
    expect(facts.estimate?.coverage.energy).toBe(0.5);
  });

  it("uses recipe yield consistently and rejects an invalid yield", () => {
    const rows = [row("white-rice-cooked", 160)];
    expect(computeRecipeNutrition(rows, dict, 1).caloriesKcal).toBe(208);
    expect(computeRecipeNutrition(rows, dict, 2).caloriesKcal).toBe(104);
    expect(() => computeRecipeNutrition(rows, dict, 0)).toThrow("Invalid recipe yield");
  });
});
