/**
 * 개인화 가중치 및 최근 섭취 메뉴 다양성 보정 순수 함수 (PRD 3.3 REC-05, REC-06, 3.9 AI-13)
 *
 * - REC-05: 아기가 잘 먹은(GOOD) 메뉴와 주재료에 가산점, 거부(REFUSED)한 메뉴와 주재료에 감점 부여
 * - REC-06: 최근 3일(72시간) 이내 먹은 메뉴는 추천 순위를 대폭 하향하여 식단 다양성 확보
 * - AI-13: 전체 피드백 기반 레시피 qualityScore 반영
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";

export const RECENT_MEAL_COOLDOWN_DAYS = 3;
export const RECENT_MEAL_PENALTY = -80;

export interface BabyPersonalizationProfile {
  /** 최근 3일 이내 섭취한 레시피 ID 집합 (REC-06) */
  recentRecipeIds: ReadonlySet<string>;
  /** 식재료별 선호 점수 누적 (GOOD +1.0, OK +0.2, REFUSED -1.2) */
  ingredientWeights: ReadonlyMap<string, number>;
  /** 레시피별 직접 반응 점수 누적 (GOOD +2.0, OK +0.3, REFUSED -3.0) */
  recipeDirectWeights: ReadonlyMap<string, number>;
}

export interface HistoricalMealLogForScoring {
  recipeId: string;
  eatenAt: Date;
  rating: "GOOD" | "OK" | "REFUSED";
  primaryIngredientIds: readonly string[];
}

export function buildPersonalizationProfileFromLogs(
  logs: readonly HistoricalMealLogForScoring[],
  now: Date = new Date(),
): BabyPersonalizationProfile {
  const recentCutoffMs = now.getTime() - RECENT_MEAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const recentRecipeIds = new Set<string>();
  const ingredientWeights = new Map<string, number>();
  const recipeDirectWeights = new Map<string, number>();

  for (const log of logs) {
    if (log.eatenAt.getTime() >= recentCutoffMs) {
      recentRecipeIds.add(log.recipeId);
    }

    const recipeDelta = log.rating === "GOOD" ? 2.0 : log.rating === "OK" ? 0.3 : -3.0;
    recipeDirectWeights.set(
      log.recipeId,
      (recipeDirectWeights.get(log.recipeId) ?? 0) + recipeDelta,
    );

    const ingDelta = log.rating === "GOOD" ? 1.0 : log.rating === "OK" ? 0.2 : -1.2;
    for (const ingId of log.primaryIngredientIds) {
      ingredientWeights.set(ingId, (ingredientWeights.get(ingId) ?? 0) + ingDelta);
    }
  }

  return {
    recentRecipeIds,
    ingredientWeights,
    recipeDirectWeights,
  };
}

/**
 * 레시피 1건의 개인화·품질·최근성 종합 추천 점수 계산 (높을수록 우선 추천)
 */
export function computeRecipeRecommendationScore(
  recipe: {
    id: string;
    qualityScore: number;
    primaryIngredientIds: readonly string[];
  },
  profile: BabyPersonalizationProfile,
): {
  totalScore: number;
  isRecentlyEaten: boolean;
  personalizationScore: number;
} {
  const isRecentlyEaten = profile.recentRecipeIds.has(recipe.id);
  const directScore = profile.recipeDirectWeights.get(recipe.id) ?? 0;

  let ingScore = 0;
  for (const ingId of recipe.primaryIngredientIds) {
    ingScore += profile.ingredientWeights.get(ingId) ?? 0;
  }

  const personalizationScore = Math.round((directScore + ingScore) * 100) / 100;
  const recentPenalty = isRecentlyEaten ? RECENT_MEAL_PENALTY : 0;
  const totalScore =
    Math.round((personalizationScore + recipe.qualityScore + recentPenalty) * 100) / 100;

  return {
    totalScore,
    isRecentlyEaten,
    personalizationScore,
  };
}

export async function loadBabyPersonalizationProfile(
  babyId: string,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<BabyPersonalizationProfile> {
  const rows = await prisma.mealLog.findMany({
    where: { babyId },
    include: {
      recipe: {
        include: {
          ingredients: {
            where: { isOptional: false },
            select: { ingredientId: true },
          },
        },
      },
    },
  });

  return buildPersonalizationProfileFromLogs(
    rows.map((r) => ({
      recipeId: r.recipeId,
      eatenAt: r.eatenAt,
      rating: r.rating,
      primaryIngredientIds: r.recipe.ingredients.map((ri) => ri.ingredientId),
    })),
    now,
  );
}
