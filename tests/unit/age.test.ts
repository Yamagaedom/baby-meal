import { describe, expect, it } from "vitest";
import {
  AGE_STAGES,
  MAX_AGE_MONTH,
  MIN_AGE_MONTH,
  currentAgeMonth,
  defaultSaltLevelForAge,
  fullMonthsBetween,
  getAgeStage,
  getAgeStageInfo,
  isOverMaxAge,
  isRecipeAboveAge,
  isValidInputAgeMonth,
  kstDateString,
  toKstDateParts,
  youngestMonthForStages,
} from "@/lib/age";
import type { AgeStage } from "@/lib/domain/types";

describe("lib/age — 월령 계산 및 연령 단계 매핑 (PRF-01~03, AGE-02)", () => {
  it("PRF-01: 입력 월령 유효성 검사 — 12~48개월 정수만 허용한다", () => {
    expect(isValidInputAgeMonth(11)).toBe(false);
    expect(isValidInputAgeMonth(MIN_AGE_MONTH)).toBe(true);
    expect(isValidInputAgeMonth(24)).toBe(true);
    expect(isValidInputAgeMonth(MAX_AGE_MONTH)).toBe(true);
    expect(isValidInputAgeMonth(49)).toBe(false);
    expect(isValidInputAgeMonth(15.5)).toBe(false);
    expect(isValidInputAgeMonth(Number.NaN)).toBe(false);
  });

  it("PRF-01: 월령 경계값(11, 12, 15, 16, 24, 25, 36, 37, 48, 49개월) 단계 매핑", () => {
    expect(getAgeStage(11)).toBeNull();
    expect(getAgeStage(Number.NaN)).toBeNull();

    // 완료기: 12~15개월 (stage 1)
    expect(getAgeStage(12)).toBe(1);
    expect(getAgeStage(15)).toBe(1);

    // 유아식 1단계: 16~24개월 (stage 2)
    expect(getAgeStage(16)).toBe(2);
    expect(getAgeStage(24)).toBe(2);

    // 유아식 2단계: 25~36개월 (stage 3)
    expect(getAgeStage(25)).toBe(3);
    expect(getAgeStage(36)).toBe(3);

    // 유아식 3단계: 37~48개월 (stage 4)
    expect(getAgeStage(37)).toBe(4);
    expect(getAgeStage(48)).toBe(4);

    // PRF-03: 49개월 이상도 3단계(stage 4) 레시피 계속 이용 가능
    expect(getAgeStage(49)).toBe(4);
    expect(getAgeStage(60)).toBe(4);
  });

  it("PRF-03: 48개월 초과 시 지원 월령 종료 안내 대상 판정", () => {
    expect(isOverMaxAge(48)).toBe(false);
    expect(isOverMaxAge(49)).toBe(true);
  });

  it("KST 날짜 변환 — UTC 자정 전후를 한국 날짜로 정확히 처리한다", () => {
    // 2026-10-31 15:30 UTC === 2026-11-01 00:30 KST
    const utcLate = new Date("2026-10-31T15:30:00Z");
    expect(toKstDateParts(utcLate)).toEqual({ year: 2026, month: 11, day: 1 });
    expect(kstDateString(utcLate)).toBe("2026-11-01");
  });

  it("PRF-02: 경과 개월 수 및 현재 월령 자동 증가 계산", () => {
    const jan31 = new Date("2026-01-31T00:00:00+09:00");
    const feb28 = new Date("2026-02-28T00:00:00+09:00");
    const mar01 = new Date("2026-03-01T00:00:00+09:00");
    const apr30 = new Date("2026-04-30T00:00:00+09:00");
    const may01 = new Date("2026-05-01T00:00:00+09:00");

    // 1/31 → 2/28은 일자가 31에 미달하므로 아직 0개월, 3/1에 1개월 경과
    expect(fullMonthsBetween(jan31, feb28)).toBe(0);
    expect(fullMonthsBetween(jan31, mar01)).toBe(1);
    expect(fullMonthsBetween(jan31, apr30)).toBe(2);
    expect(fullMonthsBetween(jan31, may01)).toBe(3);

    // 역전된 날짜는 음수가 아닌 0
    expect(fullMonthsBetween(may01, jan31)).toBe(0);

    // 15개월에 입력 후 1개월 경과 시 16개월(유아식 1단계)로 자동 전환
    const updatedAge = currentAgeMonth(15, jan31, mar01);
    expect(updatedAge).toBe(16);
    expect(getAgeStage(updatedAge)).toBe(2);
  });

  it("온보딩 기본 간 단계 제안 (PRD 4.2-5)", () => {
    expect(defaultSaltLevelForAge(11)).toBe("NONE");
    expect(defaultSaltLevelForAge(12)).toBe("NONE");
    expect(defaultSaltLevelForAge(20)).toBe("NONE");
    expect(defaultSaltLevelForAge(25)).toBe("LOW");
    expect(defaultSaltLevelForAge(40)).toBe("LOW");
  });

  it("getAgeStageInfo 및 youngestMonthForStages 예외 처리", () => {
    expect(AGE_STAGES).toHaveLength(4);
    expect(getAgeStageInfo(1).label).toBe("완료기");
    expect(() => getAgeStageInfo(99 as AgeStage)).toThrow("알 수 없는 연령 단계");
    expect(youngestMonthForStages([3, 2, 4])).toBe(16);
    expect(() => youngestMonthForStages([])).toThrow("연령 단계가 비어 있습니다");
  });

  it("AGE-02: 아기 월령보다 높은 단계 레시피 경고 판정", () => {
    // 14개월(stage 1) 아기가 stage [2, 3] 레시피 조회 → 경고 대상
    expect(isRecipeAboveAge([2, 3], 14)).toBe(true);
    // stage [1, 2] 레시피 조회 → 적합
    expect(isRecipeAboveAge([1, 2], 14)).toBe(false);
    // 12개월 미만은 항상 경고
    expect(isRecipeAboveAge([1], 10)).toBe(true);
  });
});
