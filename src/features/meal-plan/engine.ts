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

/** Repeat intervals stay anchored across plan boundaries. First plan day is a preparation opportunity. */
export function cookingDate(prefs: PlanPreferences, eatDate: string): string {
  if (prefs.cookingInterval > 1) {
    const anchor = prefs.cookingAnchor ?? prefs.startDate;
    const days = Math.floor(
      (Date.parse(`${eatDate}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86400000,
    );
    const remainder =
      ((days % prefs.cookingInterval) + prefs.cookingInterval) % prefs.cookingInterval;
    const scheduled = addDays(eatDate, -remainder);
    // No newly created task before this plan: existing food is allocated separately.
    return scheduled < prefs.startDate ? prefs.startDate : scheduled;
  }
  if (prefs.cookingMode !== "BATCH") return eatDate;
  return (
    [...new Set([0, ...prefs.cookingDays])]
      .sort((a, b) => b - a)
      .map((d) => addDays(prefs.startDate, d))
      .find((d) => d <= eatDate) ?? prefs.startDate
  );
}

export function scheduledCookingDays(prefs: PlanPreferences): string[] {
  if (prefs.cookingInterval <= 1)
    return [
      ...new Set(
        Array.from({ length: 7 }, (_, i) => cookingDate(prefs, addDays(prefs.startDate, i))),
      ),
    ];
  const anchor = prefs.cookingAnchor ?? prefs.startDate;
  return Array.from({ length: 7 }, (_, i) => addDays(prefs.startDate, i)).filter((d) => {
    const n = Math.round((Date.parse(d) - Date.parse(anchor)) / 86400000);
    return ((n % prefs.cookingInterval) + prefs.cookingInterval) % prefs.cookingInterval === 0;
  });
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
    fixedEntries?: PlannedEntry[];
    replacing?: PlannedEntry[];
  } = {},
): PlannedEntry[] {
  const selected = new Set(prefs.selectedIngredientIds);
  const avoided = new Set(prefs.avoidedIngredientIds);
  const pool = recipes.filter(
    (r) =>
      r.verified &&
      r.role !== "UNKNOWN" &&
      r.cookMinutes <= prefs.maxCookMinutes &&
      (!prefs.tools.length || (r.tools ?? []).every((t) => prefs.tools.includes(t))) &&
      !r.ingredientIds.some((id) => avoided.has(id)) &&
      (prefs.allowShopping ||
        r.ingredients
          .filter((i) => !i.optional)
          .every((i) => selected.has(i.id) || r.basicIds?.includes(i.id))),
  );
  const used = new Map<string, number>();
  const repeated = new Map<string, string>();
  const stock = (options.stock ?? []).map((s) => ({ ...s }));
  const entries: PlannedEntry[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(prefs.startDate, offset);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const dailyTotals = { protein: 0, iron: 0, calcium: 0 };
    const dailyGroups = new Set<string>();
    const ref = nutritionReference(options.ageMonth ?? 18);
    const slots = [
      "BREAKFAST",
      "LUNCH",
      "DINNER",
      ...Array.from({ length: prefs.snackCount }, () => "SNACK"),
    ] as PlannedEntry["mealTime"][];
    for (let index = 0; index < slots.length; index++) {
      const mealTime = slots[index];
      const slotIndex = mealTime === "SNACK" ? index - 3 : 0;
      const home =
        mealTime === "SNACK" ||
        (prefs.meals.includes(mealTime) &&
          !(prefs.schedule === "WORKDAY" && weekday > 0 && weekday < 6 && mealTime === "LUNCH"));
      const style = mealTime === "SNACK" ? "AUTO" : prefs.mealStyles[mealTime];
      const count = home && style === "RICE_SIDES" ? prefs.sideCount + 1 : 1;
      const mealUsed = new Set<string>();
      for (let position = 0; position < count; position++) {
        const portion =
          style === "RICE_SIDES" ? (position === 0 ? prefs.staplePortion : prefs.sidePortion) : 1;
        const candidates = home
          ? pool.filter((r) => {
              if (
                mealUsed.has(r.id) ||
                options.fixedEntries?.some(
                  (e) =>
                    e.date === date &&
                    e.mealTime === mealTime &&
                    e.slotIndex === slotIndex &&
                    e.position !== position &&
                    e.recipeId === r.id,
                )
              )
                return false;
              if (mealTime === "SNACK") return r.category === "SNACK";
              if (style === "SOUP") return r.dishType === "SOUP";
              if (style === "ONE_BOWL") return r.dishType === "ONE_BOWL";
              if (style === "RICE_SIDES")
                return position === 0
                  ? r.dishType === "STAPLE"
                  : r.dishType === "SIDE" &&
                      (position !== 1 || !prefs.requireMeat || r.groups.includes("MEAT"));
              return r.category === "MEAL" && r.role === "MAIN";
            })
          : [];
        const bucket = `${cookingDate(prefs, date)}:${mealTime}:${slotIndex}:${position}`;
        const repeatedId = prefs.repeatMeals ? repeated.get(bucket) : undefined;
        const ranked = candidates
          .map((r, n) => {
            const hits = r.ingredientIds.filter((id) => selected.has(id)).length;
            const onHand =
              prefs.useStock &&
              stock.some(
                (s) =>
                  s.recipeId === r.id &&
                  s.available >= portion &&
                  s.expiresDate &&
                  s.expiresDate >= date &&
                  s.preparedDate <= date,
              );
            const nutrientScore = ref
              ? (["protein", "iron", "calcium"] as const).reduce(
                  (sum, key) =>
                    sum +
                    (r.nutrition.coverage[key] === 1
                      ? (Math.min(
                          Math.max(0, ref[key] - dailyTotals[key]),
                          (r.nutrition.values[key] ?? 0) * portion,
                        ) /
                          ref[key]) *
                        10
                      : 0),
                  0,
                )
              : 0;
            const replacing = options.replacing?.some(
              (e) =>
                e.date === date &&
                e.mealTime === mealTime &&
                e.slotIndex === slotIndex &&
                e.position === position &&
                e.recipeId === r.id,
            );
            const score =
              nutrientScore +
              r.groups.filter((g) => !dailyGroups.has(g) && g !== "SEASONING").length * 5 -
              (replacing && candidates.length > 1 ? 1000 : 0) +
              hits * (prefs.priorities.includes("PANTRY") ? 12 : 6) +
              (hits / Math.max(1, r.ingredients.length)) * 8 +
              (onHand ? 80 : 0) +
              (r.id === repeatedId ? 200 : 0) +
              (options.favorites?.has(r.id) ? 12 : 0) -
              r.cookMinutes * (prefs.priorities.includes("EASY") ? 0.4 : 0.1) -
              (used.get(r.id) ?? 0) * (prefs.priorities.includes("VARIETY") ? 18 : 10) -
              (options.recent?.has(r.id) ? 5 : 0) +
              ((n + (options.seed ?? 0)) % 7) * 0.13;
            return { r, score };
          })
          .sort((a, b) => b.score - a.score);
        const fixed = options.fixedEntries?.find(
          (e) =>
            e.date === date &&
            e.mealTime === mealTime &&
            e.slotIndex === slotIndex &&
            e.position === position,
        );
        const recipe =
          (fixed?.recipeId ? recipes.find((r) => r.id === fixed.recipeId) : undefined) ??
          ranked[0]?.r;
        if (recipe) {
          recipe.groups.forEach((g) => dailyGroups.add(g));
          for (const key of ["protein", "iron", "calcium"] as const)
            if (recipe.nutrition.coverage[key] === 1)
              dailyTotals[key] += (recipe.nutrition.values[key] ?? 0) * portion;
          mealUsed.add(recipe.id);
          used.set(recipe.id, (used.get(recipe.id) ?? 0) + 1);
          repeated.set(bucket, recipe.id);
          const batch = stock.find(
            (s) =>
              prefs.useStock &&
              s.recipeId === recipe.id &&
              s.available >= portion &&
              s.expiresDate &&
              s.expiresDate >= date &&
              s.preparedDate <= date,
          );
          if (batch)
            batch.available = Math.max(0, Math.round((batch.available - portion) * 10000) / 10000);
        }
        const needed =
          style === "RICE_SIDES"
            ? position === 0
              ? "밥"
              : position === 1 && prefs.requireMeat
                ? "고기 반찬"
                : "반찬"
            : style === "SOUP"
              ? "스프류"
              : style === "ONE_BOWL"
                ? "한그릇 음식"
                : "메뉴";
        entries.push({
          date,
          mealTime,
          slotIndex,
          position,
          kind: home ? "HOME" : "EXTERNAL",
          recipeId: recipe?.id ?? null,
          name: recipe?.name ?? (home ? `${needed} 후보 없음 · 직접 선택해 주세요` : "외부 식사"),
          servings: portion,
          locked: false,
          snapshot: recipe ?? {},
        });
      }
    }
  }
  return entries;
}
