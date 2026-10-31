import { describe, expect, it } from "vitest";
import { computeNutritionPercentages, computeRecipeNutrition, getNutrientPer100g } from "@/features/nutrition";
import type { IngredientInfo } from "@/lib/domain/types";

describe("features/nutrition — 영양소 계산 엔진", () => {
  const mockDict = new Map<string, IngredientInfo & { slug: string }>([
    [
      "ing-rice",
      {
        id: "ing-rice",
        slug: "white-rice-cooked",
        name: "밥",
        synonyms: [],
        group: "GRAIN",
        allergens: [],
        minAgeMonth: 12,
        sodiumMgPer100g: 1,
        gramsPerPiece: null,
        densityGPerMl: 1,
        isSaltySeasoning: false,
        cautionNote: null,
      },
    ],
    [
      "ing-beef",
      {
        id: "ing-beef",
        slug: "beef-minced",
        name: "소고기 다짐육",
        synonyms: [],
        group: "MEAT",
        allergens: ["BEEF"],
        minAgeMonth: 12,
        sodiumMgPer100g: 65,
        gramsPerPiece: null,
        densityGPerMl: 1,
        isSaltySeasoning: false,
        cautionNote: null,
      },
    ],
    [
      "ing-zucchini",
      {
        id: "ing-zucchini",
        slug: "zucchini",
        name: "애호박",
        synonyms: [],
        group: "VEGETABLE",
        allergens: [],
        minAgeMonth: 12,
        sodiumMgPer100g: 2,
        gramsPerPiece: null,
        densityGPerMl: 1,
        isSaltySeasoning: false,
        cautionNote: null,
      },
    ],
  ]);

  it("100g당 개별 영양소 조회가 정확하다", () => {
    const beef = getNutrientPer100g("beef-minced", "MEAT");
    expect(beef.energy).toBeGreaterThan(200);
    expect(beef.protein).toBeGreaterThan(20);
    expect(beef.iron).toBeGreaterThan(2.0);

    const zucchini = getNutrientPer100g("zucchini", "VEGETABLE");
    expect(zucchini.energy).toBeLessThan(30);
    expect(zucchini.fiber).toBeGreaterThan(0.5);
  });

  it("레시피 재료 구성과 인분 수에 따라 1회 제공량 영양소를 정확히 산출한다", () => {
    // 2인분 기준: 밥 160g, 소고기 60g, 애호박 40g
    const ingredients = [
      { ingredientId: "ing-rice", amount: 160, unit: "g" },
      { ingredientId: "ing-beef", amount: 60, unit: "g" },
      { ingredientId: "ing-zucchini", amount: 40, unit: "g" },
    ];

    const nut = computeRecipeNutrition(ingredients, mockDict, 2);

    // 1인분당: 밥 80g(104kcal, 단2g), 소고기 30g(72kcal, 단7.65g), 애호박 20g(3.4kcal)
    // 총 열량: 약 179 kcal
    expect(nut.caloriesKcal).toBeGreaterThanOrEqual(160);
    expect(nut.caloriesKcal).toBeLessThanOrEqual(210);
    expect(nut.proteinG).toBeGreaterThanOrEqual(8.0);
    expect(nut.carbohydrateG).toBeGreaterThan(20);
    expect(nut.ironMg).toBeGreaterThan(0.7);
    expect(nut.sodiumMg).toBeGreaterThanOrEqual(15);
  });

  it("영유아 1끼 권장 섭취량 대비 비율을 계산한다", () => {
    const facts = {
      caloriesKcal: 250,
      carbohydrateG: 35,
      proteinG: 8,
      fatG: 7,
      sodiumMg: 50,
      calciumMg: 85,
      ironMg: 1.5,
      dietaryFiberG: 2.0,
    };

    const percentages = computeNutritionPercentages(facts);
    expect(percentages.caloriesPercent).toBe(83); // 250 / 300 * 100
    expect(percentages.proteinPercent).toBe(100); // 8 / 8 * 100
    expect(percentages.calciumPercent).toBe(50); // 85 / 170 * 100
  });
});
