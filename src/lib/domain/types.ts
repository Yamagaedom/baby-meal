/**
 * 도메인 공통 타입.
 * Prisma enum과 문자열 값이 1:1로 일치해야 한다 (prisma/schema.prisma 참고).
 * lib/age, lib/safety 같은 순수 함수 모듈이 Prisma에 의존하지 않도록 별도로 정의한다.
 */

export const SALT_LEVELS = ["NONE", "LOW", "NORMAL"] as const;
export type SaltLevel = (typeof SALT_LEVELS)[number];

export const RECIPE_CATEGORIES = ["MEAL", "SNACK"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const MEAL_TIMES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export const AGE_STAGE_VALUES = [1, 2, 3, 4] as const;
export type AgeStage = (typeof AGE_STAGE_VALUES)[number];

/** 식약처 알레르기 유발물질 표시 대상 (식품 등의 표시기준 기준 분류) */
export const ALLERGENS = [
  "EGG", // 알류(가금류)
  "MILK", // 우유
  "BUCKWHEAT", // 메밀
  "PEANUT", // 땅콩
  "SOYBEAN", // 대두
  "WHEAT", // 밀
  "MACKEREL", // 고등어
  "CRAB", // 게
  "SHRIMP", // 새우
  "PORK", // 돼지고기
  "PEACH", // 복숭아
  "TOMATO", // 토마토
  "SULFITE", // 아황산류
  "WALNUT", // 호두
  "CHICKEN", // 닭고기
  "BEEF", // 쇠고기
  "SQUID", // 오징어
  "SHELLFISH", // 조개류(굴, 전복, 홍합 포함)
  "PINE_NUT", // 잣
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  EGG: "달걀(알류)",
  MILK: "우유",
  BUCKWHEAT: "메밀",
  PEANUT: "땅콩",
  SOYBEAN: "대두",
  WHEAT: "밀",
  MACKEREL: "고등어",
  CRAB: "게",
  SHRIMP: "새우",
  PORK: "돼지고기",
  PEACH: "복숭아",
  TOMATO: "토마토",
  SULFITE: "아황산류",
  WALNUT: "호두",
  CHICKEN: "닭고기",
  BEEF: "쇠고기",
  SQUID: "오징어",
  SHELLFISH: "조개류",
  PINE_NUT: "잣",
};

export const INGREDIENT_GROUPS = [
  "GRAIN",
  "VEGETABLE",
  "FRUIT",
  "MEAT",
  "SEAFOOD",
  "EGG",
  "DAIRY",
  "LEGUME_TOFU",
  "NUT_SEED",
  "SEASONING",
  "PROCESSED",
] as const;
export type IngredientGroup = (typeof INGREDIENT_GROUPS)[number];

/** 안전 검증에 필요한 식재료 사전 필드 (Prisma Ingredient의 부분집합) */
export interface IngredientInfo {
  id: string;
  slug?: string;
  nutrition?: unknown;
  name: string;
  synonyms: string[];
  group: IngredientGroup;
  allergens: Allergen[];
  minAgeMonth: number;
  sodiumMgPer100g: number;
  /** 개수 단위(개, 장, 모 등) 1단위의 무게(g). 없으면 개수 단위로 환산 불가 */
  gramsPerPiece: number | null;
  /** ml → g 환산 밀도 */
  densityGPerMl: number;
  /** 소금·간장·된장 등 간을 내는 양념 여부 (무염 레시피에서 금지) */
  isSaltySeasoning: boolean;
  cautionNote: string | null;
}

/** 레시피 재료 한 줄 (안전 검증 입력) */
export interface RecipeIngredientInput {
  ingredientId: string;
  amount: number | null;
  unit: string;
  isOptional: boolean;
}

/** Per serving. Null means unknown, not zero. */
export interface RecipeNutritionFacts {
  caloriesKcal: number | null;
  carbohydrateG: number | null;
  proteinG: number | null;
  fatG: number | null;
  sodiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  dietaryFiberG: number | null;
  estimate?: import("@/features/meal-plan/types").NutritionEstimate;
}
