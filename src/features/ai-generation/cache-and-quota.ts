/**
 * 즉석 AI 생성 캐시 키 및 일일 한도 관리 (PRD 3.9 AI-06~11)
 *
 * 핵심 불변식:
 * 1. 계정당 1일 3회 한도는 KST 자정(00:00 KST) 기준으로 초기화된다 (UTC 자정 아님).
 * 2. 캐시 적중, 안전 검증 실패, 외부 API 오류, 타임아웃 시에는 횟수가 차감되지 않는다.
 * 3. 동일 계정의 동시 다중 요청에서도 원자적 조건부 증가(count < 3)로 4회째 생성이 절대 발생하지 않는다.
 * 4. 서비스 전체 일일 상한(AI_DAILY_GLOBAL_LIMIT) 도달 시 신규 즉석 생성을 차단한다.
 */
import crypto from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import type { AgeStage, Allergen, RecipeCategory, SaltLevel } from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import type { AiQuotaStatus } from "./types";

export const DAILY_USER_AI_LIMIT = 3;
export const DEFAULT_DAILY_GLOBAL_AI_LIMIT = 100;

export function getGlobalDailyAiLimit(): number {
  const raw = process.env.AI_DAILY_GLOBAL_LIMIT;
  if (!raw) return DEFAULT_DAILY_GLOBAL_AI_LIMIT;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_DAILY_GLOBAL_AI_LIMIT;
}

/** KST 날짜 문자열("YYYY-MM-DD")과 Prisma @db.Date 저장용 UTC 자정 Date 반환 */
export function getKstUsageDate(now: Date = new Date()): {
  kstDateStr: string;
  dbDate: Date;
} {
  const kstDateStr = kstDateString(now);
  const dbDate = new Date(`${kstDateStr}T00:00:00.000Z`);
  return { kstDateStr, dbDate };
}

/**
 * AI-09: 생성 조건 정규화 캐시 키 생성
 * (정렬된 재료 ID 조합 + 카테고리 + 연령 단계 + 간 단계 + 제외 알레르기·식재료 집합)
 */
export function buildGenerationCacheKey(params: {
  scope?: string;
  maxMissing?: number;
  dishType?: string;
  freshKey?: string;
  assumeBasicPantry?: boolean;
  category: RecipeCategory;
  ageStage: AgeStage;
  saltLevel: SaltLevel;
  ingredientIds: readonly string[];
  excludedAllergens: readonly Allergen[];
  excludedIngredientIds: readonly string[];
}): string {
  const canonical = JSON.stringify({
    v: 2,
    scope: params.scope ?? "SHOPPING",
    maxMissing: params.maxMissing ?? 3,
    dishType: params.dishType ?? "ANY",
    freshKey: params.freshKey,
    assumeBasicPantry: params.assumeBasicPantry ?? true,
    category: params.category,
    ageStage: params.ageStage,
    saltLevel: params.saltLevel,
    ingredientIds: Array.from(new Set(params.ingredientIds)).sort(),
    excludedAllergens: Array.from(new Set(params.excludedAllergens)).sort(),
    excludedIngredientIds: Array.from(new Set(params.excludedIngredientIds)).sort(),
  });
  return `ai-v1-${crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 40)}`;
}

/** 현재 사용자의 KST 기준 오늘 남은 횟수 및 전역 상한 도달 여부 조회 */
export async function getAiQuotaStatus(
  userId: string,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
  globalLimitOverride?: number,
): Promise<AiQuotaStatus> {
  const { kstDateStr, dbDate } = getKstUsageDate(now);
  const globalLimit = globalLimitOverride ?? getGlobalDailyAiLimit();

  const [userRow, globalAgg] = await Promise.all([
    prisma.aiUsage.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate: dbDate,
        },
      },
      select: { count: true },
    }),
    prisma.aiUsage.aggregate({
      where: { usageDate: dbDate },
      _sum: { count: true },
    }),
  ]);

  const usedToday = userRow?.count ?? 0;
  const globalUsed = globalAgg._sum.count ?? 0;

  return {
    dailyLimit: DAILY_USER_AI_LIMIT,
    usedToday,
    remainingToday: Math.max(0, DAILY_USER_AI_LIMIT - usedToday),
    globalLimitReached: globalUsed >= globalLimit,
    usageDateKst: kstDateStr,
    resetsAtKst: "매일 00:00 (KST)",
  };
}

/**
 * 원자적 슬롯 예약 (레이스 컨디션 방지):
 * - 먼저 행을 보장한 뒤 `count < DAILY_USER_AI_LIMIT` 조건부 원자 증가를 수행한다.
 * - 전역 상한 초과 시 즉시 롤백(차감 취소)하고 429를 던진다.
 * - 이후 생성·검증 단계에서 실패하거나 캐시 경합이 발생하면 반드시 refundAiGenerationSlot으로 복구한다.
 */
export async function reserveAiGenerationSlot(
  userId: string,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
  globalLimitOverride?: number,
): Promise<{ dbDate: Date; kstDateStr: string }> {
  const { kstDateStr, dbDate } = getKstUsageDate(now);
  const globalLimit = globalLimitOverride ?? getGlobalDailyAiLimit();

  if (globalLimit <= 0) {
    throw new AppError(
      429,
      "GLOBAL_QUOTA_EXCEEDED",
      "오늘 서비스 전체 AI 레시피 생성 한도에 도달하여 기존 검증 레시피만 안내해 드립니다.",
    );
  }

  // 동시 첫 요청 시 unique 충돌을 안전하게 무시하며 기본 행 보장
  try {
    await prisma.aiUsage.upsert({
      where: { userId_usageDate: { userId, usageDate: dbDate } },
      create: { userId, usageDate: dbDate, count: 0 },
      update: {},
    });
  } catch {
    // 동시 트랜잭션이 방금 생성한 경우 무시
  }

  const preGlobal = await prisma.aiUsage.aggregate({
    where: { usageDate: dbDate },
    _sum: { count: true },
  });
  if ((preGlobal._sum.count ?? 0) >= globalLimit) {
    throw new AppError(
      429,
      "GLOBAL_QUOTA_EXCEEDED",
      "오늘 서비스 전체 AI 레시피 생성 한도에 도달하여 기존 검증 레시피만 안내해 드립니다.",
    );
  }

  // 행 수준 잠금을 동반하는 원자적 조건부 증가 (동시 4개 요청이 와도 정확히 3개만 count 증가 성공)
  const incremented = await prisma.aiUsage.updateMany({
    where: {
      userId,
      usageDate: dbDate,
      count: { lt: DAILY_USER_AI_LIMIT },
    },
    data: {
      count: { increment: 1 },
    },
  });

  if (incremented.count === 0) {
    throw new AppError(
      429,
      "USER_QUOTA_EXCEEDED",
      "오늘의 AI 레시피 생성 횟수(3회)를 모두 사용했어요. 내일 자정(00:00 KST) 이후 다시 이용할 수 있어요.",
    );
  }

  // 증가 직후 전역 상한 재확인 (동시 타 계정 요청 경합 방어)
  const postGlobal = await prisma.aiUsage.aggregate({
    where: { usageDate: dbDate },
    _sum: { count: true },
  });
  if ((postGlobal._sum.count ?? 0) > globalLimit) {
    await refundAiGenerationSlot(userId, dbDate, prisma);
    throw new AppError(
      429,
      "GLOBAL_QUOTA_EXCEEDED",
      "오늘 서비스 전체 AI 레시피 생성 한도에 도달하여 기존 검증 레시피만 안내해 드립니다.",
    );
  }

  return { dbDate, kstDateStr };
}

/** 검증 실패·외부 오류·타임아웃·캐시 경합 시 예약했던 횟수를 즉시 환불한다 (0 미만 방지) */
export async function refundAiGenerationSlot(
  userId: string,
  dbDate: Date,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await prisma.aiUsage.updateMany({
    where: {
      userId,
      usageDate: dbDate,
      count: { gt: 0 },
    },
    data: {
      count: { decrement: 1 },
    },
  });
}
