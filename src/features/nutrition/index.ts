import type { IngredientGroup, IngredientInfo, RecipeNutritionFacts } from "@/lib/domain/types";
import { convertIngredientToGrams } from "@/lib/safety";
import rawFoodComposition from "@/data/food-composition.json";

export interface Nutrient100g {
  energy: number; // kcal
  carbohydrate: number; // g
  protein: number; // g
  fat: number; // g
  sodium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  fiber: number; // g
}

/**
 * 12~48개월 영유아 1끼 권장 섭취 기준 (KDRI 한국인 영양소 섭취기준 1일 권장량의 약 30%)
 */
export const INFANT_MEAL_RDA = {
  caloriesKcal: 300,
  carbohydrateG: 40,
  proteinG: 8,
  fatG: 9,
  sodiumMg: 200,
  calciumMg: 170,
  ironMg: 2.0,
  dietaryFiberG: 4.0,
} as const;

/**
 * 한국 국가표준식품성분표(제10개정판) 및 식약처 DB 기반 주요 식재료 100g당 대표 영양성분
 */
const EXTENDED_FOOD_NUTRIENTS: Record<string, Nutrient100g> = {
  // 육류
  "beef-minced": { energy: 240, carbohydrate: 0.2, protein: 25.5, fat: 15.0, sodium: 65, calcium: 15, iron: 2.6, fiber: 0 },
  "beef-sirloin": { energy: 215, carbohydrate: 0.1, protein: 26.0, fat: 12.0, sodium: 55, calcium: 12, iron: 2.4, fiber: 0 },
  "pork-tenderloin": { energy: 135, carbohydrate: 0.2, protein: 22.5, fat: 4.8, sodium: 45, calcium: 8, iron: 1.2, fiber: 0 },
  "pork-minced": { energy: 210, carbohydrate: 0.1, protein: 19.5, fat: 14.2, sodium: 55, calcium: 10, iron: 1.1, fiber: 0 },
  "chicken-breast": { energy: 110, carbohydrate: 0.0, protein: 23.0, fat: 1.5, sodium: 50, calcium: 11, iron: 0.8, fiber: 0 },
  "chicken-tender": { energy: 105, carbohydrate: 0.0, protein: 23.5, fat: 1.2, sodium: 48, calcium: 10, iron: 0.7, fiber: 0 },

  // 수산물
  salmon: { energy: 160, carbohydrate: 0.0, protein: 20.5, fat: 8.5, sodium: 60, calcium: 12, iron: 0.6, fiber: 0 },
  "cod-fillet": { energy: 80, carbohydrate: 0.1, protein: 17.5, fat: 0.7, sodium: 70, calcium: 24, iron: 0.4, fiber: 0 },
  shrimp: { energy: 95, carbohydrate: 0.2, protein: 20.0, fat: 1.1, sodium: 140, calcium: 65, iron: 0.6, fiber: 0 },
  anchovy: { energy: 210, carbohydrate: 1.2, protein: 40.0, fat: 4.5, sodium: 1200, calcium: 1100, iron: 4.5, fiber: 0 },

  // 채소류
  zucchini: { energy: 17, carbohydrate: 3.2, protein: 1.3, fat: 0.2, sodium: 2, calcium: 16, iron: 0.4, fiber: 1.1 },
  carrot: { energy: 35, carbohydrate: 8.2, protein: 1.0, fat: 0.2, sodium: 30, calcium: 30, iron: 0.6, fiber: 2.5 },
  broccoli: { energy: 32, carbohydrate: 5.5, protein: 3.2, fat: 0.3, sodium: 25, calcium: 45, iron: 1.0, fiber: 2.8 },
  spinach: { energy: 23, carbohydrate: 3.5, protein: 2.8, fat: 0.4, sodium: 40, calcium: 99, iron: 2.6, fiber: 2.2 },
  onion: { energy: 38, carbohydrate: 8.8, protein: 1.1, fat: 0.1, sodium: 3, calcium: 20, iron: 0.3, fiber: 1.6 },
  cabbage: { energy: 25, carbohydrate: 5.8, protein: 1.3, fat: 0.1, sodium: 18, calcium: 40, iron: 0.5, fiber: 2.5 },
  potato: { energy: 75, carbohydrate: 17.0, protein: 1.8, fat: 0.1, sodium: 4, calcium: 8, iron: 0.8, fiber: 1.5 },
  "sweet-potato": { energy: 130, carbohydrate: 30.5, protein: 1.6, fat: 0.2, sodium: 20, calcium: 30, iron: 0.7, fiber: 3.0 },
  mushroom: { energy: 22, carbohydrate: 3.3, protein: 3.1, fat: 0.3, sodium: 5, calcium: 3, iron: 0.5, fiber: 1.0 },
  "shiitake-mushroom": { energy: 25, carbohydrate: 4.5, protein: 2.2, fat: 0.4, sodium: 6, calcium: 5, iron: 0.8, fiber: 2.0 },
  cucumber: { energy: 12, carbohydrate: 2.2, protein: 0.7, fat: 0.1, sodium: 2, calcium: 14, iron: 0.3, fiber: 0.7 },
  tomato: { energy: 18, carbohydrate: 3.9, protein: 0.9, fat: 0.2, sodium: 5, calcium: 10, iron: 0.3, fiber: 1.2 },
  pumpkin: { energy: 30, carbohydrate: 7.0, protein: 1.2, fat: 0.1, sodium: 1, calcium: 18, iron: 0.5, fiber: 1.5 },

  // 곡류
  "white-rice-cooked": { energy: 130, carbohydrate: 28.5, protein: 2.5, fat: 0.3, sodium: 1, calcium: 3, iron: 0.2, fiber: 0.4 },
  "brown-rice": { energy: 150, carbohydrate: 32.0, protein: 3.0, fat: 1.0, sodium: 2, calcium: 10, iron: 0.6, fiber: 1.8 },
  oats: { energy: 375, carbohydrate: 66.0, protein: 13.0, fat: 6.5, sodium: 4, calcium: 52, iron: 4.2, fiber: 10.0 },
  noodles: { energy: 135, carbohydrate: 28.0, protein: 4.5, fat: 0.6, sodium: 100, calcium: 12, iron: 1.0, fiber: 1.2 },
  bread: { energy: 260, carbohydrate: 49.0, protein: 8.5, fat: 3.5, sodium: 450, calcium: 65, iron: 1.5, fiber: 2.5 },

  // 두부·계란·유제품
  tofu: { energy: 84, carbohydrate: 1.8, protein: 8.5, fat: 4.8, sodium: 8, calcium: 140, iron: 1.5, fiber: 0.5 },
  "soft-tofu": { energy: 50, carbohydrate: 1.2, protein: 5.0, fat: 2.5, sodium: 6, calcium: 80, iron: 0.9, fiber: 0.3 },
  egg: { energy: 145, carbohydrate: 1.0, protein: 12.5, fat: 10.0, sodium: 135, calcium: 50, iron: 1.8, fiber: 0 },
  milk: { energy: 65, carbohydrate: 4.8, protein: 3.2, fat: 3.6, sodium: 50, calcium: 110, iron: 0.1, fiber: 0 },
  "baby-cheese": { energy: 310, carbohydrate: 2.0, protein: 18.0, fat: 24.0, sodium: 120, calcium: 600, iron: 0.3, fiber: 0 },
  cheese: { energy: 330, carbohydrate: 2.5, protein: 21.0, fat: 26.0, sodium: 600, calcium: 700, iron: 0.4, fiber: 0 },
  yogurt: { energy: 60, carbohydrate: 5.0, protein: 3.5, fat: 3.0, sodium: 50, calcium: 120, iron: 0.1, fiber: 0 },

  // 과일류
  apple: { energy: 52, carbohydrate: 13.8, protein: 0.3, fat: 0.2, sodium: 1, calcium: 6, iron: 0.2, fiber: 2.4 },
  banana: { energy: 89, carbohydrate: 22.8, protein: 1.1, fat: 0.3, sodium: 1, calcium: 5, iron: 0.3, fiber: 2.6 },
  pear: { energy: 57, carbohydrate: 15.0, protein: 0.4, fat: 0.1, sodium: 1, calcium: 9, iron: 0.2, fiber: 3.1 },
  avocado: { energy: 160, carbohydrate: 8.5, protein: 2.0, fat: 14.7, sodium: 7, calcium: 12, iron: 0.6, fiber: 6.7 },

  // 유지류·육수
  "sesame-oil": { energy: 884, carbohydrate: 0.0, protein: 0.0, fat: 100.0, sodium: 0, calcium: 0, iron: 0, fiber: 0 },
  "olive-oil": { energy: 884, carbohydrate: 0.0, protein: 0.0, fat: 100.0, sodium: 0, calcium: 0, iron: 0, fiber: 0 },
  water: { energy: 0, carbohydrate: 0, protein: 0, fat: 0, sodium: 0, calcium: 0, iron: 0, fiber: 0 },
  "vegetable-broth": { energy: 5, carbohydrate: 1.0, protein: 0.2, fat: 0.0, sodium: 15, calcium: 5, iron: 0.1, fiber: 0 },
  "kelp-broth": { energy: 4, carbohydrate: 0.8, protein: 0.2, fat: 0.0, sodium: 25, calcium: 8, iron: 0.1, fiber: 0 },
};

/**
 * 식재료군(IngredientGroup)별 기본 대표 영양 기준 (누락 시 fallback)
 */
const GROUP_DEFAULT_NUTRIENTS: Record<IngredientGroup, Nutrient100g> = {
  GRAIN: { energy: 140, carbohydrate: 30.0, protein: 3.0, fat: 0.5, sodium: 5, calcium: 10, iron: 0.5, fiber: 1.0 },
  VEGETABLE: { energy: 25, carbohydrate: 5.0, protein: 1.5, fat: 0.2, sodium: 15, calcium: 35, iron: 0.7, fiber: 2.0 },
  FRUIT: { energy: 60, carbohydrate: 15.0, protein: 0.5, fat: 0.2, sodium: 2, calcium: 10, iron: 0.3, fiber: 2.0 },
  MEAT: { energy: 180, carbohydrate: 0.1, protein: 22.0, fat: 10.0, sodium: 60, calcium: 12, iron: 1.8, fiber: 0 },
  SEAFOOD: { energy: 110, carbohydrate: 0.2, protein: 19.0, fat: 3.0, sodium: 90, calcium: 30, iron: 0.6, fiber: 0 },
  EGG: { energy: 145, carbohydrate: 1.0, protein: 12.5, fat: 10.0, sodium: 135, calcium: 50, iron: 1.8, fiber: 0 },
  DAIRY: { energy: 80, carbohydrate: 5.0, protein: 4.0, fat: 4.5, sodium: 60, calcium: 120, iron: 0.1, fiber: 0 },
  LEGUME_TOFU: { energy: 80, carbohydrate: 3.0, protein: 8.0, fat: 4.0, sodium: 10, calcium: 120, iron: 1.3, fiber: 1.0 },
  NUT_SEED: { energy: 580, carbohydrate: 18.0, protein: 20.0, fat: 50.0, sodium: 10, calcium: 80, iron: 3.0, fiber: 8.0 },
  SEASONING: { energy: 40, carbohydrate: 8.0, protein: 1.0, fat: 0.5, sodium: 800, calcium: 10, iron: 0.5, fiber: 0 },
  PROCESSED: { energy: 150, carbohydrate: 20.0, protein: 6.0, fat: 5.0, sodium: 300, calcium: 40, iron: 0.8, fiber: 1.0 },
};

/**
 * 특정 식재료의 100g당 영양 정보를 조회 (우선순위: Extended DB -> USDA food-composition.json -> Group Fallback)
 */
export function getNutrientPer100g(slugOrName: string, group?: IngredientGroup, sodiumMgPer100g?: number): Nutrient100g {
  const normalizedKey = slugOrName.toLowerCase().trim();

  // 1. 한국 표준 성분 매핑
  if (normalizedKey in EXTENDED_FOOD_NUTRIENTS) {
    return EXTENDED_FOOD_NUTRIENTS[normalizedKey];
  }

  // 2. USDA SR Legacy composition
  const comp = (
    rawFoodComposition as unknown as Record<
      string,
      { per100g?: Record<string, number | null | undefined> }
    >
  )[normalizedKey];
  if (comp?.per100g) {
    const p = comp.per100g;
    return {
      energy: Number(p.energy ?? 0),
      carbohydrate: Number(p.carbohydrate ?? 0),
      protein: Number(p.protein ?? 0),
      fat: Number(p.fat ?? 0),
      sodium: Number(p.sodium ?? sodiumMgPer100g ?? 0),
      calcium: Number(p.calcium ?? 0),
      iron: Number(p.iron ?? 0),
      fiber: Number(p.fiber ?? 0),
    };
  }

  // 3. 식재료군 fallback
  const fallback = group ? GROUP_DEFAULT_NUTRIENTS[group] : GROUP_DEFAULT_NUTRIENTS.VEGETABLE;
  return {
    ...fallback,
    sodium: sodiumMgPer100g !== undefined ? sodiumMgPer100g : fallback.sodium,
  };
}

/**
 * 레시피 재료 목록과 인분 수를 기반으로 1회 제공량(1 serving) 영양 성분을 정밀 계산
 */
export function computeRecipeNutrition(
  recipeIngredients: readonly {
    ingredientId: string;
    amount: number | null;
    unit: string;
    isOptional?: boolean;
  }[],
  dictionaryById: ReadonlyMap<string, IngredientInfo & { slug?: string }>,
  baseServings: number = 2,
): RecipeNutritionFacts {
  const servings = baseServings > 0 ? baseServings : 2;

  let totalCalories = 0;
  let totalCarb = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalSodium = 0;
  let totalCalcium = 0;
  let totalIron = 0;
  let totalFiber = 0;

  for (const ri of recipeIngredients) {
    const info = dictionaryById.get(ri.ingredientId);
    if (!info) continue;

    const grams = convertIngredientToGrams(ri.amount, ri.unit, info);
    if (!grams || grams <= 0) continue;

    const key = info.slug || info.name;
    const nut = getNutrientPer100g(key, info.group, info.sodiumMgPer100g);

    const ratio = grams / 100;
    totalCalories += nut.energy * ratio;
    totalCarb += nut.carbohydrate * ratio;
    totalProtein += nut.protein * ratio;
    totalFat += nut.fat * ratio;
    totalSodium += nut.sodium * ratio;
    totalCalcium += nut.calcium * ratio;
    totalIron += nut.iron * ratio;
    totalFiber += nut.fiber * ratio;
  }

  return {
    caloriesKcal: Math.round(totalCalories / servings),
    carbohydrateG: Math.round((totalCarb / servings) * 10) / 10,
    proteinG: Math.round((totalProtein / servings) * 10) / 10,
    fatG: Math.round((totalFat / servings) * 10) / 10,
    sodiumMg: Math.round(totalSodium / servings),
    calciumMg: Math.round((totalCalcium / servings) * 10) / 10,
    ironMg: Math.round((totalIron / servings) * 100) / 100,
    dietaryFiberG: Math.round((totalFiber / servings) * 10) / 10,
  };
}

/**
 * 1회 식사 권장량(INFANT_MEAL_RDA) 대비 달성 비율(%) 계산
 */
export function computeNutritionPercentages(nutrition: RecipeNutritionFacts) {
  return {
    caloriesPercent: Math.min(200, Math.round((nutrition.caloriesKcal / INFANT_MEAL_RDA.caloriesKcal) * 100)),
    carbohydratePercent: Math.min(200, Math.round((nutrition.carbohydrateG / INFANT_MEAL_RDA.carbohydrateG) * 100)),
    proteinPercent: Math.min(200, Math.round((nutrition.proteinG / INFANT_MEAL_RDA.proteinG) * 100)),
    fatPercent: Math.min(200, Math.round((nutrition.fatG / INFANT_MEAL_RDA.fatG) * 100)),
    calciumPercent: Math.min(200, Math.round((nutrition.calciumMg / INFANT_MEAL_RDA.calciumMg) * 100)),
    ironPercent: Math.min(200, Math.round((nutrition.ironMg / INFANT_MEAL_RDA.ironMg) * 100)),
    dietaryFiberPercent: Math.min(200, Math.round((nutrition.dietaryFiberG / INFANT_MEAL_RDA.dietaryFiberG) * 100)),
  };
}
