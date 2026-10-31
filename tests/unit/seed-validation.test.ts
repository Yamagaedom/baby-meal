import { describe, expect, it } from "vitest";
import type { IngredientInfo } from "@/lib/domain/types";
import { validateRecipeSafety } from "@/lib/safety";
import { SEED_INGREDIENTS } from "../../prisma/seed/ingredients";
import { SEED_RECIPES } from "../../prisma/seed/recipes";

describe("시드 데이터 무결성 및 안전 검증 (PRD 8장, AI-05)", () => {
  it("식재료 사전은 200종 이상이며 중복 slug/이름이 없고 필수 안전 필드가 모두 채워져 있다", () => {
    expect(SEED_INGREDIENTS.length).toBeGreaterThanOrEqual(200);

    const slugs = new Set<string>();
    const names = new Set<string>();

    for (const ing of SEED_INGREDIENTS) {
      expect(ing.slug).toMatch(/^[a-z0-9-]+$/);
      expect(slugs.has(ing.slug), `중복 slug: ${ing.slug}`).toBe(false);
      slugs.add(ing.slug);

      expect(ing.name.trim().length).toBeGreaterThan(0);
      expect(names.has(ing.name), `중복 식재료명: ${ing.name}`).toBe(false);
      names.add(ing.name);

      expect(Array.isArray(ing.allergens)).toBe(true);
      expect(Number.isInteger(ing.minAgeMonth)).toBe(true);
      expect(ing.minAgeMonth).toBeGreaterThanOrEqual(12);
      expect(Number.isFinite(ing.sodiumMgPer100g)).toBe(true);
      expect(ing.sodiumMgPer100g).toBeGreaterThanOrEqual(0);
    }
  });

  it("샘플 레시피가 4개 연령 단계·식사/간식·무염/저염에 고르게 분포하며 모두 lib/safety 검증을 통과한다", () => {
    expect(SEED_RECIPES.length).toBeGreaterThanOrEqual(30);

    const dictBySlug = new Map<string, IngredientInfo>(
      SEED_INGREDIENTS.map((ing) => [
        ing.slug,
        {
          id: ing.slug,
          name: ing.name,
          synonyms: ing.synonyms,
          group: ing.group,
          allergens: ing.allergens,
          minAgeMonth: ing.minAgeMonth,
          sodiumMgPer100g: ing.sodiumMgPer100g,
          gramsPerPiece: ing.gramsPerPiece ?? null,
          densityGPerMl: ing.densityGPerMl ?? 1.0,
          isSaltySeasoning: ing.isSaltySeasoning ?? false,
          cautionNote: ing.cautionNote ?? null,
        },
      ]),
    );

    const stageCounts = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
    let mealCount = 0;
    let snackCount = 0;
    let unsaltedCount = 0;

    for (const recipe of SEED_RECIPES) {
      if (recipe.category === "MEAL") mealCount += 1;
      if (recipe.category === "SNACK") snackCount += 1;
      if (recipe.saltLevel === "NONE") unsaltedCount += 1;
      for (const st of recipe.ageStages) {
        stageCounts.set(st, (stageCounts.get(st) ?? 0) + 1);
      }

      const mappedIngredients = recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientSlug,
        amount: ri.amount,
        unit: ri.unit,
        isOptional: ri.isOptional ?? false,
      }));

      // 대체 식재료도 모두 사전에 등록되어 있어야 함
      for (const ri of recipe.ingredients) {
        if (ri.substituteSlug) {
          expect(
            dictBySlug.has(ri.substituteSlug),
            `${recipe.slug}의 대체 재료 미등록: ${ri.substituteSlug}`,
          ).toBe(true);
        }
      }

      const report = validateRecipeSafety(
        {
          name: recipe.name,
          category: recipe.category,
          ageStages: recipe.ageStages,
          saltLevel: recipe.saltLevel,
          cookMinutes: recipe.cookMinutes,
          baseServings: recipe.baseServings,
          ingredients: mappedIngredients,
          steps: recipe.steps,
          storageInfo: recipe.storageInfo,
          sources: recipe.sources,
        },
        dictBySlug,
      );

      expect(
        report.issues,
        `레시피 안전 검증 실패 (${recipe.slug} - ${recipe.name}): ${JSON.stringify(report.issues)}`,
      ).toEqual([]);
      expect(report.passed).toBe(true);
    }

    expect(mealCount).toBeGreaterThanOrEqual(20);
    expect(snackCount).toBeGreaterThanOrEqual(10);
    // PRD 8장: 무염 버전 비율 40% 이상
    expect(unsaltedCount / SEED_RECIPES.length).toBeGreaterThanOrEqual(0.4);
    for (const [stage, count] of stageCounts.entries()) {
      expect(count, `연령 단계 ${stage} 레시피 부족`).toBeGreaterThanOrEqual(5);
    }
  });
});
