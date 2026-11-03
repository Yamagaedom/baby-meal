/**
 * 분량 조절 순수 함수 모음 (PRD 3.7 SRV-01~05)
 *
 * SRV-03 단위 처리 규칙:
 * - g/ml은 정수 반올림 (1 미만 미량은 "약간")
 * - 개수·계량스푼 단위는 ¼·½·¾ 단위로 표시 (예: 달걀 1.5개 → "1½개", 0.2 미만 미량은 "약간")
 * - 원래 "약간"/"소량"이거나 매우 적은 양은 "약간"으로 표기
 */
import { getAgeStageInfo } from "@/lib/age";
import type { AgeStage } from "@/lib/domain/types";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  PIECE_UNITS,
  PINCH_UNITS,
  STANDARD_RICE_GRAMS_BY_STAGE,
} from "@/lib/safety/constants";

const FRACTION_UNITS = new Set([
  ...PIECE_UNITS,
  "큰술",
  "T",
  "tbsp",
  "작은술",
  "t",
  "tsp",
  "컵",
  "종이컵",
]);

const INTEGER_UNITS = new Set(["g", "ml", "mL", "cc"]);

export interface ScaledIngredientAmount {
  scaledAmount: number | null;
  unit: string;
  /** 단위까지 포함한 사용자 표시 문자열 (예: "1½개", "135g", "약간") */
  displayAmount: string;
}

function formatQuarterFraction(value: number, unit: string): string {
  if (value < 0.2) {
    return "약간";
  }

  const quarters = Math.round(value * 4);
  if (quarters <= 0) {
    return "약간";
  }

  const whole = Math.floor(quarters / 4);
  const rem = quarters % 4;
  const fracChar = rem === 1 ? "¼" : rem === 2 ? "½" : rem === 3 ? "¾" : "";

  if (whole === 0) {
    return `${fracChar}${unit}`;
  }
  return `${whole}${fracChar}${unit}`;
}

/** SRV-01~03: 기준 회분 대비 목표 회분(0.1~5회분) 재료 분량 재계산 */
export function scaleIngredientAmount(
  baseAmount: number | null,
  unit: string,
  baseServings: number,
  targetServings: number,
): ScaledIngredientAmount {
  if (!Number.isFinite(targetServings) || targetServings < 0.1 || targetServings > MAX_SERVINGS) {
    throw new Error(`분량은 0.1~${MAX_SERVINGS}회분 사이여야 합니다.`);
  }
  if (!Number.isInteger(baseServings) || baseServings < MIN_SERVINGS) {
    throw new Error("레시피 기준 분량이 올바르지 않습니다.");
  }

  const trimmedUnit = unit.trim();

  if (PINCH_UNITS.has(trimmedUnit) || baseAmount === null || baseAmount <= 0) {
    return {
      scaledAmount: null,
      unit: "약간",
      displayAmount: "약간",
    };
  }

  const scaled = (baseAmount * targetServings) / baseServings;

  if (INTEGER_UNITS.has(trimmedUnit)) {
    if (scaled < 1) {
      return {
        scaledAmount: scaled,
        unit: "약간",
        displayAmount: "약간",
      };
    }
    const rounded = Math.round(scaled);
    return {
      scaledAmount: rounded,
      unit: trimmedUnit,
      displayAmount: `${rounded}${trimmedUnit}`,
    };
  }

  if (trimmedUnit === "kg" || trimmedUnit === "L" || trimmedUnit === "l") {
    const subUnit = trimmedUnit === "kg" ? "g" : "ml";
    const subValue = scaled * 1000;
    if (subValue < 1) {
      return { scaledAmount: scaled, unit: "약간", displayAmount: "약간" };
    }
    if (subValue < 1000) {
      const roundedSub = Math.round(subValue);
      return { scaledAmount: roundedSub, unit: subUnit, displayAmount: `${roundedSub}${subUnit}` };
    }
    const rounded = Math.round(scaled * 10) / 10;
    return { scaledAmount: rounded, unit: trimmedUnit, displayAmount: `${rounded}${trimmedUnit}` };
  }

  if (FRACTION_UNITS.has(trimmedUnit)) {
    const formatted = formatQuarterFraction(scaled, trimmedUnit);
    return {
      scaledAmount: scaled,
      unit: formatted === "약간" ? "약간" : trimmedUnit,
      displayAmount: formatted,
    };
  }

  // 기타 단위도 0.2 미만이면 약간, 그 외 정수 반올림
  if (scaled < 0.5) {
    return { scaledAmount: scaled, unit: "약간", displayAmount: "약간" };
  }
  const rounded = Math.round(scaled);
  return {
    scaledAmount: rounded,
    unit: trimmedUnit,
    displayAmount: `${rounded}${trimmedUnit}`,
  };
}

/** SRV-04: 연령 단계별 1회분 밥 기준량 안내 */
export function getPortionGuideForStage(stage: AgeStage): string {
  const stageInfo = getAgeStageInfo(stage);
  const range = STANDARD_RICE_GRAMS_BY_STAGE[stage];
  return `${stageInfo.label} 1회 식사 밥 기준량: 약 ${range.min}~${range.max}g`;
}

/** SRV-05: 2회분 이상 선택 시 소분·냉동 보관 팁 노출 여부 */
export function shouldShowPortionStorageTip(targetServings: number): boolean {
  return targetServings >= 2;
}
