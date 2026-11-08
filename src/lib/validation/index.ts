/**
 * 공통 Zod 검증 스키마 (PRD 3.2, 3.7, 3.9, 3.10)
 * 서버 입력 검증 및 AI 구조화 출력 파싱에 공통으로 사용한다.
 */
import { z } from "zod";
import { MAX_AGE_MONTH, MIN_AGE_MONTH } from "@/lib/age";
import {
  AGE_STAGE_VALUES,
  ALLERGENS,
  MEAL_TIMES,
  RECIPE_CATEGORIES,
  SALT_LEVELS,
} from "@/lib/domain/types";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/safety/constants";

const EMAIL_LIKE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_LIKE_REGEX = /^01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}$/;
const UUID_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgreSQL UUID 컬럼 조회 전 형식 검증 헬퍼 */
export function isValidUuid(value: string): boolean {
  return UUID_LIKE_REGEX.test(value);
}

/** 실존하는 달력 날짜(YYYY-MM-DD)인지 검증 (예: 2026-02-31 차단) */
export function isValidCalendarDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/**
 * 로그인 ID 스키마 (ACC-02, ACC-08)
 * - 영문 소문자·숫자 4~20자
 * - 이메일·휴대폰 번호 형식 차단 (개인정보 미수집 원칙)
 */
export const loginIdSchema = z
  .string()
  .min(4, "아이디는 4자 이상이어야 합니다.")
  .max(20, "아이디는 20자 이하여야 합니다.")
  .refine((val) => !EMAIL_LIKE_REGEX.test(val), {
    message: "이메일 주소는 아이디로 사용할 수 없습니다.",
  })
  .refine((val) => !PHONE_LIKE_REGEX.test(val), {
    message: "휴대폰 번호는 아이디로 사용할 수 없습니다.",
  })
  .regex(/^[a-z0-9]+$/, "아이디는 영문 소문자와 숫자만 사용할 수 있습니다.");

/** 이메일 주소 스키마 (이메일 로그인 및 SNS 계정 연동용) */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "올바른 이메일 주소를 입력해 주세요.")
  .max(120, "이메일은 120자 이하여야 합니다.")
  .refine((val) => EMAIL_LIKE_REGEX.test(val), {
    message: "올바른 이메일 주소를 입력해 주세요.",
  });

/**
 * 통합 계정 식별자 스키마:
 * - 이메일 주소(예: mom@example.com) 또는 기존 아이디(영문 소문자·숫자 4~20자, 휴대폰 번호 차단) 모두 허용
 */
export const accountIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((val) => !PHONE_LIKE_REGEX.test(val), {
    message: "휴대폰 번호는 계정 아이디로 사용할 수 없습니다.",
  })
  .refine(
    (val) =>
      (EMAIL_LIKE_REGEX.test(val) && val.length <= 120) ||
      (/^[a-z0-9]{4,20}$/.test(val) && !PHONE_LIKE_REGEX.test(val)),
    {
      message:
        "이메일 주소(예: mom@example.com) 또는 영문 소문자·숫자 아이디(4~20자)를 입력해 주세요.",
    },
  );

export const SOCIAL_PROVIDERS = ["KAKAO", "GOOGLE", "NAVER"] as const;
export type SocialProviderType = (typeof SOCIAL_PROVIDERS)[number];
export const socialProviderSchema = z.enum(SOCIAL_PROVIDERS);

/** 비밀번호 스키마 (ACC-03: 8자 이상, 영문+숫자 조합) */
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(72, "비밀번호는 72자 이하여야 합니다.")
  .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
    message: "비밀번호는 영문과 숫자를 모두 포함해야 합니다.",
  });

/** 아기 입력 월령 스키마 (PRF-01: 12~48개월 정수) */
export const babyAgeMonthSchema = z
  .number()
  .int("월령은 정수여야 합니다.")
  .min(MIN_AGE_MONTH, `지원 월령은 ${MIN_AGE_MONTH}개월부터입니다.`)
  .max(MAX_AGE_MONTH, `지원 월령은 ${MAX_AGE_MONTH}개월까지입니다.`);

/** 아기 생년월일 스키마 (YYYY-MM-DD 실존 달력 날짜) */
export const babyBirthDateSchema = z.string().trim().refine(isValidCalendarDateString, {
  message: "올바른 생년월일(YYYY-MM-DD)을 입력해 주세요.",
});

/** 아기 닉네임 스키마 (PRF-01, ACC-08: 선택 입력, 이메일/전화번호 차단) */
export const babyNicknameSchema = z
  .string()
  .trim()
  .max(20, "닉네임은 20자 이하여야 합니다.")
  .refine((val) => val === "" || !EMAIL_LIKE_REGEX.test(val), {
    message: "이메일 형식은 닉네임으로 사용할 수 없습니다.",
  })
  .refine((val) => val === "" || !PHONE_LIKE_REGEX.test(val), {
    message: "전화번호 형식은 닉네임으로 사용할 수 없습니다.",
  })
  .optional();

export const saltLevelSchema = z.enum(SALT_LEVELS);
export const recipeCategorySchema = z.enum(RECIPE_CATEGORIES);
export const mealTimeSchema = z.enum(MEAL_TIMES);
export const allergenSchema = z.enum(ALLERGENS);
export const ageStageSchema = z.union([
  z.literal(AGE_STAGE_VALUES[0]),
  z.literal(AGE_STAGE_VALUES[1]),
  z.literal(AGE_STAGE_VALUES[2]),
  z.literal(AGE_STAGE_VALUES[3]),
]);

/** 분량(회분) 스키마 (SRV-01: 1~5회분) */
export const servingsSchema = z
  .number()
  .int()
  .min(MIN_SERVINGS, `${MIN_SERVINGS}회분 이상 선택해 주세요.`)
  .max(MAX_SERVINGS, `${MAX_SERVINGS}회분 이하로 선택해 주세요.`);

/** 레시피 조리 단계 JSON 스키마 (RCP-03, AI-03) */
export const recipeStepSchema = z.object({
  order: z.number().int().positive(),
  instruction: z.string().min(1),
  timerSeconds: z.number().int().positive().nullable().optional(),
});

/** 레시피 보관 정보 JSON 스키마 (RCP-05, AI-03) */
export const storageInfoSchema = z.object({
  fridgeDays: z.number().int().min(0).max(14).nullable().optional(),
  freezerDays: z.number().int().min(0).max(60).nullable().optional(),
  reheatTip: z.string().min(1),
  portionTip: z.string().optional(),
});

/** 아기 맞춤 팁 JSON 스키마 (RCP-04, RCP-06, AGE-04) */
export const babyTipsSchema = z.object({
  textureTip: z.string().min(1),
  cuttingSizeTip: z.string().min(1),
  seasoningTip: z.string().min(1),
  stageVariations: z.record(z.string(), z.string()).optional(),
});
