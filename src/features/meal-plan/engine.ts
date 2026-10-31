import {
  NUTRIENTS,
  type NutritionEstimate,
  type PlannedEntry,
  type PlanPreferences,
  type RecipeSnapshot,
} from "./types";
import { nutritionReference } from "./references";

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Missing food composition stays unknown, never zero. All quantities are for one recipe serving. */
export function aggregateNutrition(
  items: { nutrition: NutritionEstimate; servings: number }[],
): NutritionEstimate {
  const values = {} as NutritionEstimate["values"];
  const coverage = {} as NutritionEstimate["coverage"];
  for (const { key } of NUTRIENTS) {
    const known = items.filter((i) => i.nutrition.values[key] !== null);
    values[key] = known.length
      ? known.reduce((sum, i) => sum + i.nutrition.values[key]! * i.servings, 0)
      : null;
    coverage[key] = items.length ? Math.min(...items.map((i) => i.nutrition.coverage[key])) : 0;
  }
  return {
    values,
    coverage,
    missing: [...new Set(items.flatMap((i) => i.nutrition.missing))],
    sources: [
      ...new Map(items.flatMap((i) => i.nutrition.sources).map((s) => [s.url, s])).values(),
    ],
  };
}

export function generateWeek(
  prefs: PlanPreferences,
  recipes: RecipeSnapshot[],
  options: {
    favorites?: Set<string>;
    recent?: Set<string>;
    stock?: {
      recipeId: string | null;
      available: number;
      expiresDate: string | null;
      preparedDate: string;
    }[];
    seed?: number;
    ageMonth?: number;
  } = {},
): PlannedEntry[] {
  const selected = new Set(prefs.selectedIngredientIds);
  const avoided = new Set(prefs.avoidedIngredientIds);
  const pool = recipes.filter(
    (r) =>
      r.verified &&
      r.role !== "SIDE" &&
      r.role !== "UNKNOWN" &&
      r.cookMinutes <= prefs.maxCookMinutes &&
      (!prefs.tools.length || (r.tools ?? []).every((t) => prefs.tools.includes(t))) &&
      !r.ingredientIds.some((id) => avoided.has(id)) &&
      (prefs.allowShopping ||
        r.ingredients.filter((i) => !i.optional).every((i) => selected.has(i.id))),
  );
  const used = new Map<string, number>();
  const stock = (options.stock ?? []).map((s) => ({ ...s }));
  const entries: PlannedEntry[] = [];
  let previous: string | null = null;
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(prefs.startDate, offset);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const groupsToday = new Set<string>();
    const reference = nutritionReference(options.ageMonth ?? 18);
    const totals = { protein: 0, iron: 0, calcium: 0 };
    const slots = [
      "BREAKFAST",
      "LUNCH",
      "DINNER",
      ...Array.from({ length: prefs.snackCount }, () => "SNACK"),
    ] as PlannedEntry["mealTime"][];
    for (let index = 0; index < slots.length; index++) {
      const mealTime = slots[index];
      const home =
        mealTime === "SNACK" ||
        (prefs.meals.includes(mealTime) &&
          !(prefs.schedule === "WORKDAY" && weekday > 0 && weekday < 6 && mealTime === "LUNCH"));
      const kind = home ? "HOME" : "EXTERNAL";
      const candidates = home
        ? pool.filter((r) =>
            mealTime === "SNACK"
              ? r.category === "SNACK"
              : r.category === "MEAL" && r.role === "MAIN",
          )
        : [];
      const ranked = candidates
        .map((r, n) => {
          const matches = r.ingredientIds.filter((id) => selected.has(id)).length;
          const onHand =
            prefs.useStock &&
            stock.some(
              (s) =>
                s.recipeId === r.id &&
                s.available > 0 &&
                s.expiresDate &&
                s.expiresDate >= date &&
                s.preparedDate <= date,
            );
          const diversity = r.groups.filter((g) => !groupsToday.has(g) && g !== "SEASONING").length;
          const nutrientScore = reference
            ? (["protein", "iron", "calcium"] as const).reduce(
                (sum, key) =>
                  sum +
                  (r.nutrition.coverage[key] === 1
                    ? (Math.min(
                        Math.max(0, reference[key] - totals[key]),
                        r.nutrition.values[key] ?? 0,
                      ) /
                        reference[key]) *
                      10
                    : 0),
                0,
              )
            : 0;
          const score =
            matches * (prefs.priorities.includes("PANTRY") ? 12 : 6) +
            (matches / Math.max(1, r.ingredients.filter((i) => !i.optional).length)) * 8 +
            diversity * 5 +
            nutrientScore +
            (onHand ? 25 : 0) -
            r.cookMinutes * (prefs.priorities.includes("EASY") ? 0.4 : 0.1) +
            (options.favorites?.has(r.id) ? (prefs.priorities.includes("FAVORITE") ? 12 : 4) : 0) -
            (used.get(r.id) ?? 0) * (prefs.priorities.includes("VARIETY") ? 18 : 10) -
            (r.id === previous ? 15 : 0) -
            (options.recent?.has(r.id) ? 5 : 0) +
            ((n + (options.seed ?? 0)) % 7) * 0.13;
          return { r, score };
        })
        .sort((a, b) => b.score - a.score);
      const recipe = ranked[0]?.r;
      if (recipe) {
        used.set(recipe.id, (used.get(recipe.id) ?? 0) + 1);
        recipe.groups.forEach((g) => groupsToday.add(g));
        for (const key of ["protein", "iron", "calcium"] as const)
          if (recipe.nutrition.coverage[key] === 1)
            totals[key] += recipe.nutrition.values[key] ?? 0;
        previous = recipe.id;
        const batch = stock.find(
          (s) =>
            prefs.useStock &&
            s.recipeId === recipe.id &&
            s.available > 0 &&
            s.expiresDate &&
            s.expiresDate >= date &&
            s.preparedDate <= date,
        );
        if (batch) batch.available--;
      }
      entries.push({
        date,
        mealTime,
        slotIndex: mealTime === "SNACK" ? index - 3 : 0,
        position: 0,
        kind,
        recipeId: recipe?.id ?? null,
        name: recipe?.name ?? (home ? "메뉴를 선택해 주세요" : "외부 식사"),
        servings: 1,
        locked: false,
        snapshot: recipe ?? {},
      });
    }
  }
  return entries;
}

export function cookingDate(prefs: PlanPreferences, eatDate: string): string {
  if (prefs.cookingMode !== "BATCH") return eatDate;
  return (
    [...new Set([0, ...prefs.cookingDays])]
      .sort((a, b) => b - a)
      .map((d) => addDays(prefs.startDate, d))
      .find((d) => d <= eatDate) ?? prefs.startDate
  );
}
