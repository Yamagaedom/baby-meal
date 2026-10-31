/**
 * 유아식 안전 검증 상수 (PRD 3.6 AGE-03~05, 3.7 SRV-04, 3.9 AI-05)
 *
 * 참고 기준:
 * - 보건복지부·한국영양학회 「2020 한국인 영양소 섭취기준」 나트륨 충분섭취량:
 *   1~2세(12~35개월) 810 mg/일, 3~5세(36~71개월) 1,000 mg/일
 * - 하루 3끼 + 간식 2회 구성을 가정하여 1회분 상한을 보수적으로 산정.
 */
import type { AgeStage, SaltLevel } from "@/lib/domain/types";

/**
 * 간 단계별 1회분 나트륨 상한 (mg/serving) — AI-05 ④, AGE-03
 * - NONE(무염): 소금·간장·된장 등 간 양념 첨가 금지 + 원재료 자연 유래 나트륨 최대 80mg
 * - LOW(저염): 1회분 200mg 이하 (1~2세 일일 충분섭취량 810mg의 약 25%)
 * - NORMAL(유아 기준 싱겁게): 1회분 350mg 이하 (3~5세 일일 충분섭취량 1,000mg의 35%)
 */
export const MAX_SODIUM_MG_PER_SERVING: Record<SaltLevel, number> = {
  NONE: 80,
  LOW: 200,
  NORMAL: 350,
};

/** 1회분 총 중량 허용 범위 (g) — AI-05 ⑤ 비정상 분량 차단 */
export const MIN_TOTAL_GRAMS_PER_SERVING = 15;
export const MAX_TOTAL_GRAMS_PER_SERVING = 450;

/** 개별 재료 1회분 최대 허용 중량 (g) */
export const MAX_SINGLE_INGREDIENT_GRAMS_PER_SERVING = 300;

/** 레시피 기준 분량 허용 범위 (SRV-01: 1~5회분) */
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 5;

/** 연령 단계별 1회 식사 밥 기준량 가이드 (g) — SRV-04 */
export const STANDARD_RICE_GRAMS_BY_STAGE: Record<AgeStage, { min: number; max: number }> = {
  1: { min: 80, max: 100 },
  2: { min: 90, max: 110 },
  3: { min: 100, max: 120 },
  4: { min: 110, max: 140 },
};

/** 조리 계량 부피 단위 → ml 환산표 */
export const VOLUME_UNIT_TO_ML: Record<string, number> = {
  ml: 1,
  mL: 1,
  cc: 1,
  l: 1000,
  L: 1000,
  큰술: 15,
  T: 15,
  tbsp: 15,
  작은술: 5,
  t: 5,
  tsp: 5,
  컵: 180,
  종이컵: 180,
};

/** 무게 단위 → g 환산표 */
export const WEIGHT_UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
};

/** 개수 계열 단위 목록 (`IngredientInfo.gramsPerPiece` 곱셈 대상) */
export const PIECE_UNITS = new Set([
  "개",
  "알",
  "장",
  "모",
  "마리",
  "조각",
  "쪽",
  "줌",
  "봉",
  "팩",
  "스틱",
  "송이",
  "줄기",
  "대",
  "뿌리",
  "토막",
]);

/** 미량 표기 단위 ("약간", "소량" 등) 기본 환산 중량 (g) */
export const PINCH_UNITS = new Set(["약간", "소량", "조금", "한꼬집", "꼬집"]);
export const PINCH_GRAMS = 0.3;
