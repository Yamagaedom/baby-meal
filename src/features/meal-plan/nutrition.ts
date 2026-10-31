import type { IngredientInfo } from "@/lib/domain/types";
import { convertIngredientToGrams } from "@/lib/safety";
import { NUTRIENTS, type NutritionEstimate } from "./types";

export function estimateRecipeNutrition(
  baseServings: number,
  ingredients: {
    amount: number | null;
    unit: string;
    isOptional: boolean;
    ingredient: IngredientInfo & { nutrition?: unknown };
  }[],
): NutritionEstimate {
  const values = {} as NutritionEstimate["values"];
  const coverage = {} as NutritionEstimate["coverage"];
  const rows = ingredients
    .filter((i) => !i.isOptional)
    .map((i) => {
      const composition = i.ingredient.nutrition as {
        per100g?: Record<string, number | null>;
        source?: string;
        sourceUrl?: string;
      } | null;
      // The existing sodium validator estimates a pinch; nutrition must not silently assume its weight.
      const grams =
        i.amount === null || ["약간", "소량", "적당량"].includes(i.unit)
          ? null
          : convertIngredientToGrams(i.amount, i.unit, i.ingredient);
      return { ...i, grams, composition };
    });
  for (const { key } of NUTRIENTS) {
    const known = rows.filter(
      (i) => i.grams !== null && typeof i.composition?.per100g?.[key] === "number",
    );
    values[key] = known.length
      ? known.reduce((sum, i) => sum + (i.grams! / 100) * i.composition!.per100g![key]!, 0) /
        baseServings
      : null;
    coverage[key] = rows.length ? known.length / rows.length : 0;
  }
  return {
    values,
    coverage,
    missing: rows
      .filter(
        (i) =>
          i.grams === null ||
          !i.composition?.per100g ||
          NUTRIENTS.some((n) => i.composition!.per100g?.[n.key] == null),
      )
      .map((i) => i.ingredient.name),
    sources: [
      ...new Map(
        rows
          .filter((i) => i.composition?.sourceUrl)
          .map((i) => [
            i.composition!.sourceUrl!,
            { title: i.composition!.source ?? "식품 성분 자료", url: i.composition!.sourceUrl! },
          ]),
      ).values(),
    ],
  };
}
