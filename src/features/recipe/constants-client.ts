import type { AgeStage, IngredientGroup, MealTime, SaltLevel } from "@/lib/domain/types";

export const SALT_LEVEL_LABELS: Record<SaltLevel, string> = {
  NONE: "무염",
  LOW: "저염",
  NORMAL: "일반(유아 싱겁게)",
};

export const AGE_STAGE_LABELS: Record<AgeStage, string> = {
  1: "완료기(12~15개월)",
  2: "유아식 1단계(16~24개월)",
  3: "유아식 2단계(25~36개월)",
  4: "유아식 3단계(37~48개월)",
};

export const INGREDIENT_GROUP_LABELS: Record<IngredientGroup, string> = {
  GRAIN: "곡류·감자",
  VEGETABLE: "채소·버섯",
  FRUIT: "과일",
  MEAT: "육류",
  SEAFOOD: "해산물",
  EGG: "달걀",
  DAIRY: "유제품",
  LEGUME_TOFU: "콩·두부",
  NUT_SEED: "견과·씨앗",
  SEASONING: "양념·육수",
  PROCESSED: "면·떡·기타",
};

export const MEAL_TIME_LABELS: Record<MealTime, string> = {
  BREAKFAST: "아침",
  LUNCH: "점심",
  DINNER: "저녁",
  SNACK: "간식",
};

export const RATING_LABELS = {
  GOOD: " 잘 먹었어요",
  OK: " 보통이에요",
  REFUSED: " 안 먹었어요",
} as const;

export const AMOUNT_EATEN_LABELS = {
  ALL: "다 먹음",
  HALF: "절반",
  LITTLE: "조금",
} as const;

export const REACTION_OPTIONS = ["발진", "두드러기", "구토", "설사", "입주변붉어짐"] as const;

export const REPORT_REASON_LABELS = {
  WRONG_PORTION: "분량이 이상해요",
  UNSAFE_INGREDIENT: "아기에게 위험한 재료가 있어요",
  BAD_TASTE: "아기가 먹기 힘든 맛/조리법이에요",
  OTHER: "기타 오류",
} as const;

export const COMMON_TOOLS = ["냄비", "프라이팬", "전자레인지", "에어프라이어"] as const;
