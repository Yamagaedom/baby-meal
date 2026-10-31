/**
 * 메뉴 추천·전체 탐색·즐겨찾기 도메인 (PRD 3.3 REC-01~06, 3.6 AGE-01~02, 3.9 AI-13)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { BabyProfileView } from "@/features/profile";
import {
  type RecipeCardView,
  allowedSaltLevelsForBaby,
  isRecipeSafeForBaby,
  loadIngredientDictionaryMap,
  loadMealLogSummariesByRecipe,
  toRecipeCardView,
} from "@/features/recipe";
import { kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import { INGREDIENT_GROUPS, RECIPE_CATEGORIES, SALT_LEVELS } from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import { ageStageSchema, isValidUuid } from "@/lib/validation";
import { uniqueMenuSuggestions } from "@/lib/presentation";
import {
  computeRecipeRecommendationScore,
  loadBabyPersonalizationProfile,
} from "./personalization";

export * from "./personalization";

export const recipeFilterInputSchema = z.object({
  category: z.enum(RECIPE_CATEGORIES).optional(),
  maxCookMinutes: z.enum(["10", "20", "30", "30_PLUS"]).optional(),
  tool: z.string().trim().min(1).optional(),
  ingredientGroup: z.enum(INGREDIENT_GROUPS).optional(),
  stage: ageStageSchema.optional(),
  saltLevel: z.enum(SALT_LEVELS).optional(),
  favoritesOnly: z.boolean().optional().default(false),
  query: z.string().trim().optional(),
});

export type RecipeFilterInput = z.infer<typeof recipeFilterInputSchema>;

/** 결정적 시드 지터 (0.0 ~ 0.99 범위 — 동점자 순서를 섞어 "다른 메뉴 보기"가 동작하면서도 REC-05/06 우선순위는 보존) */
function seededJitter(id: string, seed: string): number {
  let h = 2166136261;
  const str = `${seed}:${id}`;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * REC-01, REC-02, REC-04, REC-05, REC-06, AI-13:
 * 홈 화면 오늘의 추천 (식사 아침/점심/저녁 + 간식)
 * - 서버에서 아기 월령 단계·간 단계·알레르기·ACTIVE 상태를 강제 필터링한다.
 * - 개인화 선호도(REC-05) + 품질 점수(AI-13) + 최근 3일 섭취 메뉴 순위 하향(REC-06)을 반영한다.
 */
export async function getTodayRecommendations(
  userId: string,
  baby: BabyProfileView,
  options: { seed?: string; now?: Date } = {},
  prisma: PrismaClient = getPrisma(),
): Promise<{
  meals: {
    breakfast: RecipeCardView | null;
    lunch: RecipeCardView | null;
    dinner: RecipeCardView | null;
    extraMeals: RecipeCardView[];
  };
  snacks: RecipeCardView[];
}> {
  const allowedSalts = allowedSaltLevelsForBaby(baby.saltLevel);
  const now = options.now ?? new Date();
  const isManualRefresh = Boolean(options.seed);
  const seed = options.seed ?? kstDateString(now);

  const [rows, dictMap, favorites, logSummaries, personalization] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        status: "ACTIVE",
        ageStages: { has: baby.ageStage },
        saltLevel: { in: allowedSalts },
      },
      include: {
        ingredients: { select: { ingredientId: true, isOptional: true } },
      },
      orderBy: [{ qualityScore: "desc" }, { generatedAt: "asc" }],
    }),
    loadIngredientDictionaryMap(prisma),
    prisma.favorite.findMany({
      where: { userId },
      select: { recipeId: true },
    }),
    loadMealLogSummariesByRecipe(baby.id, prisma),
    loadBabyPersonalizationProfile(baby.id, prisma, now),
  ]);

  const favSet = new Set(favorites.map((f) => f.recipeId));
  const jitterWeight = isManualRefresh ? 8 : 0.99;

  // 알레르기 서버 이중 검증 (REC-02 절대 노출 금지) + 개인화/최근 3일 하향 정렬
  const safeScored = rows
    .filter((r) => isRecipeSafeForBaby(r.ingredients, dictMap, baby))
    .map((r) => {
      const primaryIngredientIds = r.ingredients
        .filter((ri) => !ri.isOptional)
        .map((ri) => ri.ingredientId);
      const scoreInfo = computeRecipeRecommendationScore(
        {
          id: r.id,
          qualityScore: r.qualityScore,
          primaryIngredientIds,
        },
        personalization,
      );
      return {
        card: toRecipeCardView(r, baby, favSet, logSummaries),
        rankScore: scoreInfo.totalScore + seededJitter(r.id, seed) * jitterWeight,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((entry) => entry.card);

  const uniqueMenus = uniqueMenuSuggestions(safeScored);
  const mealPool = uniqueMenus.filter((c) => c.category === "MEAL");
  const snackPool = uniqueMenus.filter((c) => c.category === "SNACK");

  const usedIds = new Set<string>();
  const pickMealForSlot = (slot: "BREAKFAST" | "LUNCH" | "DINNER"): RecipeCardView | null => {
    const preferred = mealPool.find((m) => !usedIds.has(m.id) && m.mealCategories.includes(slot));
    const fallback = preferred ?? mealPool.find((m) => !usedIds.has(m.id)) ?? null;
    if (fallback) usedIds.add(fallback.id);
    return fallback;
  };

  const breakfast = pickMealForSlot("BREAKFAST");
  const lunch = pickMealForSlot("LUNCH");
  const dinner = pickMealForSlot("DINNER");
  const extraMeals = mealPool.filter((m) => !usedIds.has(m.id)).slice(0, 4);

  return {
    meals: { breakfast, lunch, dinner, extraMeals },
    snacks: snackPool.slice(0, 4),
  };
}

/**
 * REC-02, REC-03, AGE-02, AI-13:
 * 레시피 전체 탐색 및 다중 조건 필터링
 * - 수동으로 다른 연령 단계·간 단계 탐색 가능하되, 알레르기 필터와 ACTIVE 상태는 어떤 경우에도 해제되지 않는다.
 */
export async function searchRecipesForBaby(
  userId: string,
  baby: BabyProfileView,
  rawFilter: unknown = {},
  prisma: PrismaClient = getPrisma(),
): Promise<RecipeCardView[]> {
  const filter = recipeFilterInputSchema.parse(rawFilter);
  const targetStage = filter.stage ?? undefined;
  const targetSalts = filter.saltLevel
    ? [filter.saltLevel]
    : allowedSaltLevelsForBaby(baby.saltLevel);

  const [rows, dictMap, favorites, logSummaries] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        status: "ACTIVE",
        ...(filter.category ? { category: filter.category } : {}),
        ...(targetStage ? { ageStages: { has: targetStage } } : {}),
        saltLevel: { in: targetSalts },
        ...(filter.tool ? { tools: { has: filter.tool } } : {}),
        ...(filter.maxCookMinutes === "10"
          ? { cookMinutes: { lte: 10 } }
          : filter.maxCookMinutes === "20"
            ? { cookMinutes: { lte: 20 } }
            : filter.maxCookMinutes === "30"
              ? { cookMinutes: { lte: 30 } }
              : filter.maxCookMinutes === "30_PLUS"
                ? { cookMinutes: { gt: 30 } }
                : {}),
        ...(filter.query
          ? {
              name: {
                contains: filter.query,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        ingredients: {
          include: {
            ingredient: { select: { group: true, name: true } },
          },
        },
      },
      orderBy: [{ qualityScore: "desc" }, { cookMinutes: "asc" }, { name: "asc" }],
    }),
    loadIngredientDictionaryMap(prisma),
    prisma.favorite.findMany({
      where: { userId },
      select: { recipeId: true },
    }),
    loadMealLogSummariesByRecipe(baby.id, prisma),
  ]);

  const favSet = new Set(favorites.map((f) => f.recipeId));

  return rows
    .filter((r) => {
      if (!isRecipeSafeForBaby(r.ingredients, dictMap, baby)) return false;
      if (filter.favoritesOnly && !favSet.has(r.id)) return false;
      if (filter.ingredientGroup) {
        const hasGroup = r.ingredients.some(
          (ri) => !ri.isOptional && ri.ingredient.group === filter.ingredientGroup,
        );
        if (!hasGroup) return false;
      }
      return true;
    })
    .map((r) => toRecipeCardView(r, baby, favSet, logSummaries));
}

/** REC-04: 즐겨찾기 토글 (알레르기 충돌·HIDDEN 레시피는 즐겨찾기 등록도 차단) */
export async function toggleRecipeFavorite(
  userId: string,
  baby: BabyProfileView,
  recipeId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<{ isFavorite: boolean }> {
  if (!isValidUuid(recipeId)) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: { select: { ingredientId: true } } },
  });

  if (!recipe || recipe.status !== "ACTIVE") {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const dictMap = await loadIngredientDictionaryMap(prisma);
  if (!isRecipeSafeForBaby(recipe.ingredients, dictMap, baby)) {
    throw new AppError(
      403,
      "ALLERGY_BLOCKED",
      "알레르기 유발 식재료가 포함된 레시피는 즐겨찾기할 수 없습니다.",
    );
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_recipeId: { userId, recipeId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { isFavorite: false };
  }

  await prisma.favorite.create({
    data: { userId, recipeId },
  });
  return { isFavorite: true };
}
