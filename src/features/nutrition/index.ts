import type { IngredientInfo, RecipeNutritionFacts } from "@/lib/domain/types";
import { estimateRecipeNutrition } from "@/features/meal-plan/nutrition";
import rawFoodComposition from "@/data/food-composition.json";
type Composition = { per100g: Record<string, number | null> };
const composition = rawFoodComposition as Record<string, Composition>;
/** Unknown products have no group-average fallback. */
export function getNutrientPer100g(slug: string) {
  return composition[slug]?.per100g ?? null;
}
/** Per serving, using the recipe's original yield; optional ingredients are excluded. */
export function computeRecipeNutrition(
  ingredients: readonly {
    ingredientId: string;
    amount: number | null;
    unit: string;
    isOptional?: boolean;
  }[],
  dictionary: ReadonlyMap<string, IngredientInfo>,
  baseServings = 2,
): RecipeNutritionFacts {
  if (!Number.isInteger(baseServings) || baseServings < 1) throw new Error("Invalid recipe yield");
  const rows = ingredients.map((row) => {
    const ingredient = dictionary.get(row.ingredientId);
    if (!ingredient) throw new Error("Ingredient missing from nutrition dictionary");
    return {
      ...row,
      isOptional: row.isOptional ?? false,
      ingredient: {
        ...ingredient,
        nutrition: ingredient.nutrition ?? composition[ingredient.slug ?? ""] ?? null,
      },
    };
  });
  const estimate = estimateRecipeNutrition(baseServings, rows);
  const round = (value: number | null, digits = 1) =>
    value === null ? null : Number(value.toFixed(digits));
  return {
    caloriesKcal: round(estimate.values.energy, 0),
    carbohydrateG: round(estimate.values.carbohydrate),
    proteinG: round(estimate.values.protein),
    fatG: round(estimate.values.fat),
    sodiumMg: round(estimate.values.sodium, 0),
    calciumMg: round(estimate.values.calcium),
    ironMg: round(estimate.values.iron, 2),
    dietaryFiberG: round(estimate.values.fiber),
    estimate,
  };
}
