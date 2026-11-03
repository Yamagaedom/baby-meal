import { describe, expect, it } from "vitest";
import {
  getPortionGuideForStage,
  scaleIngredientAmount,
  shouldShowPortionStorageTip,
} from "@/features/serving";

describe("features/serving — 분량 조절 규칙 검증 (SRV-01~05)", () => {
  it("부분 회분의 조리 재료도 환산한다", () => {
    expect(scaleIngredientAmount(100, "g", 2, 0.5).displayAmount).toBe("25g");
  });
  it("SRV-03: g/ml 단위는 정수 반올림하고 1 미만 미량은 '약간'으로 표시한다", () => {
    expect(scaleIngredientAmount(90, "g", 2, 3).displayAmount).toBe("135g");
    expect(scaleIngredientAmount(150, "ml", 2, 1).displayAmount).toBe("75ml");
    expect(scaleIngredientAmount(1, "g", 4, 1).displayAmount).toBe("약간");
  });

  it("SRV-03: 개수·계량스푼 단위는 ¼·½·¾ 분수로 표시하고 극소량은 '약간'으로 표시한다", () => {
    // 2회분 기준 달걀 1개 → 3회분일 때 1.5개 → "1½개"
    expect(scaleIngredientAmount(1, "개", 2, 3).displayAmount).toBe("1½개");
    // 2회분 기준 달걀 1개 → 1회분일 때 0.5개 → "½개"
    expect(scaleIngredientAmount(1, "개", 2, 1).displayAmount).toBe("½개");
    // 4회분 기준 참기름 1작은술 → 1회분일 때 0.25작은술 → "¼작은술"
    expect(scaleIngredientAmount(1, "작은술", 4, 1).displayAmount).toBe("¼작은술");
    // 4회분 기준 3개 → 1회분일 때 0.75개 → "¾개"
    expect(scaleIngredientAmount(3, "개", 4, 1).displayAmount).toBe("¾개");
    // 5회분 기준 0.5작은술 → 1회분일 때 0.1작은술(<0.2) → "약간"
    expect(scaleIngredientAmount(0.5, "작은술", 5, 1).displayAmount).toBe("약간");
    // 원래 약간인 재료는 회분 변경 시에도 약간 유지
    expect(scaleIngredientAmount(null, "약간", 2, 5).displayAmount).toBe("약간");
  });

  it("SRV-01, SRV-04, SRV-05: 1~5회분 범위 검증, 단계별 기준량 안내, 소분 보관 팁 조건", () => {
    expect(() => scaleIngredientAmount(100, "g", 2, 0)).toThrow();
    expect(() => scaleIngredientAmount(100, "g", 2, 6)).toThrow();

    expect(getPortionGuideForStage(1)).toContain("완료기");
    expect(getPortionGuideForStage(1)).toContain("80~100g");

    expect(shouldShowPortionStorageTip(1)).toBe(false);
    expect(shouldShowPortionStorageTip(2)).toBe(true);
    expect(shouldShowPortionStorageTip(5)).toBe(true);
  });
});
