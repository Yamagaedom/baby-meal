/**
 * 월령 계산 및 연령 단계 매핑 (PRD 3.2 PRF-01~03, 연령 단계 정의)
 *
 * 개인정보 최소화를 위해 생년월일 대신 "입력 시점 월령 + 입력일"만 저장하고,
 * 현재 월령은 입력일로부터 경과한 개월 수를 더해 계산한다 (PRF-02).
 * 날짜 계산은 한국 시간(KST) 달력 기준이다.
 */
import type { AgeStage, SaltLevel } from "@/lib/domain/types";

export const MIN_AGE_MONTH = 12;
export const MAX_AGE_MONTH = 48;

export interface AgeStageInfo {
  stage: AgeStage;
  label: string;
  minMonth: number;
  maxMonth: number;
  texture: string;
  defaultSaltLevel: SaltLevel;
}

export const AGE_STAGES: readonly AgeStageInfo[] = [
  {
    stage: 1,
    label: "완료기",
    minMonth: 12,
    maxMonth: 15,
    texture: "무른 밥, 잇몸으로 으깰 수 있는 정도",
    defaultSaltLevel: "NONE",
  },
  {
    stage: 2,
    label: "유아식 1단계",
    minMonth: 16,
    maxMonth: 24,
    texture: "진밥, 작게 썬 반찬",
    defaultSaltLevel: "NONE",
  },
  {
    stage: 3,
    label: "유아식 2단계",
    minMonth: 25,
    maxMonth: 36,
    texture: "일반 밥에 가까움",
    defaultSaltLevel: "LOW",
  },
  {
    stage: 4,
    label: "유아식 3단계",
    minMonth: 37,
    maxMonth: 48,
    texture: "가족식 응용",
    defaultSaltLevel: "LOW",
  },
] as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → KST 기준 {year, month(1-12), day} */
export function toKstDateParts(date: Date): { year: number; month: number; day: number } {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}

/** KST 기준 오늘 날짜를 "YYYY-MM-DD"로 반환 (DB @db.Date 저장용) */
export function kstDateString(date: Date = new Date()): string {
  const { year, month, day } = toKstDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * from부터 to까지 "꽉 찬" 개월 수 (KST 달력 기준).
 * 예: 1/31 → 2/28 = 0개월, 1/31 → 3/1 = 1개월, 1/15 → 2/15 = 1개월
 * to가 from보다 이전이면 0.
 */
export function fullMonthsBetween(from: Date, to: Date): number {
  const a = toKstDateParts(from);
  const b = toKstDateParts(to);
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) months -= 1;
  return Math.max(0, months);
}

/** 입력 월령이 서비스 지원 범위(12~48개월 정수)인지 (PRF-01) */
export function isValidInputAgeMonth(month: number): boolean {
  return Number.isInteger(month) && month >= MIN_AGE_MONTH && month <= MAX_AGE_MONTH;
}

/**
 * 현재 월령 (PRF-02). 상한을 자르지 않고 실제 값을 반환한다.
 * 48개월 초과 여부는 isOverMaxAge로 판단한다 (PRF-03).
 */
export function currentAgeMonth(
  ageMonthAtInput: number,
  ageInputDate: Date,
  now: Date = new Date(),
): number {
  return ageMonthAtInput + fullMonthsBetween(ageInputDate, now);
}

/** 48개월 초과 → "지원 월령 종료" 안내 대상 (PRF-03) */
export function isOverMaxAge(ageMonth: number): boolean {
  return ageMonth > MAX_AGE_MONTH;
}

/**
 * 월령 → 연령 단계.
 * 12개월 미만은 지원하지 않으므로 null.
 * 48개월 초과는 3단계(stage 4) 레시피를 계속 이용할 수 있도록 stage 4 (PRF-03).
 */
export function getAgeStage(ageMonth: number): AgeStage | null {
  if (!Number.isFinite(ageMonth) || ageMonth < MIN_AGE_MONTH) return null;
  for (const s of AGE_STAGES) {
    if (ageMonth <= s.maxMonth) return s.stage;
  }
  return 4;
}

export function getAgeStageInfo(stage: AgeStage): AgeStageInfo {
  const info = AGE_STAGES.find((s) => s.stage === stage);
  if (!info) throw new Error(`알 수 없는 연령 단계: ${stage}`);
  return info;
}

/** 단계별 기본 간 단계 제안 (온보딩 PRD 4.2-5) */
export function defaultSaltLevelForAge(ageMonth: number): SaltLevel {
  const stage = getAgeStage(ageMonth);
  return stage ? getAgeStageInfo(stage).defaultSaltLevel : "NONE";
}

/** 레시피가 허용하는 가장 어린 단계의 시작 월령 (안전 검증 시 가장 엄격한 기준 적용) */
export function youngestMonthForStages(stages: readonly AgeStage[]): number {
  if (stages.length === 0) throw new Error("연령 단계가 비어 있습니다");
  const youngest = Math.min(...stages) as AgeStage;
  return getAgeStageInfo(youngest).minMonth;
}

/** 아기 월령보다 높은 단계의 레시피인지 (AGE-02 경고용) */
export function isRecipeAboveAge(recipeStages: readonly AgeStage[], ageMonth: number): boolean {
  const babyStage = getAgeStage(ageMonth);
  if (babyStage === null) return true;
  return Math.min(...recipeStages) > babyStage;
}
