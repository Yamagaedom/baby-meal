/**
 * 집에 있는 재료 기반 추천 도메인 (PRD 3.5 ING-01~06)
 *
 * 매칭 로직:
 * - 매칭 점수 = (보유한 필수 재료 수 ÷ 전체 필수 재료 수) × 100 (반올림 정수)
 * - 선택 재료(isOptional === true)는 점수 계산에서 제외
 * - assumeBasicPantry === true일 때 기본 양념·상비 재료(isPantryBasic)는 보유한 것으로 간주
 * - 동점 시 조리시간 짧은 순 정렬
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type BabyProfileView, buildBabyAllergyFilter } from "@/features/profile";
import {
  type RecipeCardView,
  allowedSaltLevelsForBaby,
  isRecipeSafeForBaby,
  loadMealLogSummariesByRecipe,
  toRecipeCardView,
} from "@/features/recipe";
import {
  computeRecipeRecommendationScore,
  loadBabyPersonalizationProfile,
} from "@/features/recommend/personalization";
import { getPrisma } from "@/lib/db";
import type { IngredientInfo } from "@/lib/domain/types";
import { checkAllergyConflicts, normalizeIngredientName } from "@/lib/safety";

/** 자주 쓰는 재료 칩 slug 목록 (ING-01) */
export const POPULAR_CHIP_SLUGS = [
  "potato",
  "carrot",
  "zucchini",
  "tofu",
  "beef-lean",
  "egg",
  "onion",
  "broccoli",
  "sweet-potato",
  "banana",
  "chicken-tenderloin",
  "white-rice-cooked",
] as const;

/**
 * 대표 원재료 패밀리 매핑:
 * 부모가 "소고기"를 선택했을 때 "소고기다짐육"·"소고기양지" 레시피도 자연스럽게 매칭되도록 묶는다.
 */
const INGREDIENT_FAMILY_GROUPS: readonly (readonly string[])[] = [
  ["소고기", "소고기다짐육", "소고기안심", "소고기양지"],
  ["닭가슴살", "닭안심", "닭다리살", "닭고기다짐육"],
  ["돼지고기앞다리살", "돼지고기안심", "돼지고기등심", "돼지고기다짐육"],
  ["쌀밥", "백미"],
  ["두부", "순두부"],
];

function expandOwnedIngredientIds(
  selectedIds: readonly string[],
  dictMap: ReadonlyMap<string, IngredientInfo>,
): Set<string> {
  const expanded = new Set<string>(selectedIds);
  const nameToId = new Map<string, string>();
  for (const info of dictMap.values()) {
    nameToId.set(info.name, info.id);
  }

  for (const id of selectedIds) {
    const info = dictMap.get(id);
    if (!info) continue;
    for (const family of INGREDIENT_FAMILY_GROUPS) {
      if (family.includes(info.name)) {
        for (const siblingName of family) {
          const siblingId = nameToId.get(siblingName);
          if (siblingId) expanded.add(siblingId);
        }
      }
    }
  }

  return expanded;
}

export interface IngredientMatchResult {
  matchRate: number;
  ownedRequiredCount: number;
  totalRequiredCount: number;
  missingIngredients: string[];
  availabilityBadge: string;
}

/** ING-02~04: 순수 매칭 점수 계산 함수 (단위 테스트 대상) */
export function calculateIngredientMatch(
  recipeIngredients: readonly {
    ingredientId: string;
    isOptional: boolean;
  }[],
  selectedIngredientIds: readonly string[],
  dictMap: ReadonlyMap<string, IngredientInfo>,
  pantryBasicIds: ReadonlySet<string>,
  assumeBasicPantry: boolean,
): IngredientMatchResult {
  const ownedSet = expandOwnedIngredientIds(selectedIngredientIds, dictMap);
  if (assumeBasicPantry) {
    for (const id of pantryBasicIds) {
      ownedSet.add(id);
    }
  }

  const required = recipeIngredients.filter((ri) => !ri.isOptional);
  if (required.length === 0) {
    return {
      matchRate: 0,
      ownedRequiredCount: 0,
      totalRequiredCount: 0,
      missingIngredients: [],
      availabilityBadge: "모든 재료 보유",
    };
  }

  let ownedRequiredCount = 0;
  const missingIngredients: string[] = [];

  for (const ri of required) {
    if (ownedSet.has(ri.ingredientId)) {
      ownedRequiredCount += 1;
    } else {
      const name = dictMap.get(ri.ingredientId)?.name ?? "기타 재료";
      missingIngredients.push(name);
    }
  }

  const matchRate = Math.round((ownedRequiredCount / required.length) * 100);
  const availabilityBadge =
    missingIngredients.length === 0
      ? "모든 재료 보유"
      : `${missingIngredients.length}개 부족: ${missingIngredients.join(", ")}`;

  return {
    matchRate,
    ownedRequiredCount,
    totalRequiredCount: required.length,
    missingIngredients,
    availabilityBadge,
  };
}

export interface IngredientOptionView {
  id: string;
  slug: string;
  name: string;
  synonyms: string[];
  isPantryBasic: boolean;
}

/** ING-01: 식재료 자동완성 검색 및 자주 쓰는 칩 조회 (아기 알레르기·유아식 금지 재료 제외) */
export async function searchIngredientsForBaby(
  baby: BabyProfileView,
  query: string = "",
  prisma: PrismaClient = getPrisma(),
): Promise<{
  results: IngredientOptionView[];
  popularChips: IngredientOptionView[];
}> {
  const rows = await prisma.ingredient.findMany({
    where: {
      minAgeMonth: { lte: 48 },
    },
    orderBy: { name: "asc" },
  });

  const dictMap = new Map<string, IngredientInfo>(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        synonyms: r.synonyms,
        group: r.group,
        allergens: r.allergens,
        minAgeMonth: r.minAgeMonth,
        sodiumMgPer100g: r.sodiumMgPer100g,
        gramsPerPiece: r.gramsPerPiece,
        densityGPerMl: r.densityGPerMl,
        isSaltySeasoning: r.isSaltySeasoning,
        cautionNote: r.cautionNote,
      },
    ]),
  );

  const allergyFilter = buildBabyAllergyFilter(baby);
  const safeRows = rows.filter(
    (r) => !checkAllergyConflicts([{ ingredientId: r.id }], dictMap, allergyFilter).hasConflict,
  );

  const chipMap = new Map(safeRows.map((r) => [r.slug, r]));
  const popularChips: IngredientOptionView[] = POPULAR_CHIP_SLUGS.map((slug) => chipMap.get(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      synonyms: r.synonyms,
      isPantryBasic: r.isPantryBasic,
    }));

  const normalizedQuery = normalizeIngredientName(query);
  const matched = normalizedQuery
    ? safeRows.filter((r) => {
        if (normalizeIngredientName(r.name).includes(normalizedQuery)) return true;
        return r.synonyms.some((syn) => normalizeIngredientName(syn).includes(normalizedQuery));
      })
    : safeRows.slice(0, 30);

  return {
    results: matched.slice(0, 25).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      synonyms: r.synonyms,
      isPantryBasic: r.isPantryBasic,
    })),
    popularChips,
  };
}

export const ingredientRecommendInputSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).min(1, "재료를 1개 이상 선택해 주세요.").max(30),
  assumeBasicPantry: z.boolean().optional().default(true),
});

export interface IngredientMatchedRecipeView extends RecipeCardView {
  matchRate: number;
  ownedRequiredCount: number;
  totalRequiredCount: number;
  missingIngredients: string[];
  availabilityBadge: string;
}

/** ING-02~06: 선택 재료 기반 레시피 추천 */
export async function recommendRecipesByIngredients(
  userId: string,
  baby: BabyProfileView,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<{
  items: IngredientMatchedRecipeView[];
  showAiGenerationSlot: boolean;
}> {
  const input = ingredientRecommendInputSchema.parse(rawInput);
  const allowedSalts = allowedSaltLevelsForBaby(baby.saltLevel);

  const [allIngredientRows, recipeRows, favorites, logSummaries, personalization] =
    await Promise.all([
      prisma.ingredient.findMany(),
      prisma.recipe.findMany({
        where: {
          status: "ACTIVE",
          ageStages: { has: baby.ageStage },
          saltLevel: { in: allowedSalts },
        },
        include: {
          ingredients: { select: { ingredientId: true, isOptional: true } },
        },
      }),
      prisma.favorite.findMany({
        where: { userId },
        select: { recipeId: true },
      }),
      loadMealLogSummariesByRecipe(baby.id, prisma),
      loadBabyPersonalizationProfile(baby.id, prisma),
    ]);

  const dictMap = new Map<string, IngredientInfo>(
    allIngredientRows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        synonyms: r.synonyms,
        group: r.group,
        allergens: r.allergens,
        minAgeMonth: r.minAgeMonth,
        sodiumMgPer100g: r.sodiumMgPer100g,
        gramsPerPiece: r.gramsPerPiece,
        densityGPerMl: r.densityGPerMl,
        isSaltySeasoning: r.isSaltySeasoning,
        cautionNote: r.cautionNote,
      },
    ]),
  );

  const pantryBasicIds = new Set(allIngredientRows.filter((r) => r.isPantryBasic).map((r) => r.id));
  const favSet = new Set(favorites.map((f) => f.recipeId));

  // 사용자가 입력한 재료(기본 양념 제외) 중 최소 1개라도 포함된 안전 레시피를 매칭
  const userOwnedOnly = expandOwnedIngredientIds(input.ingredientIds, dictMap);

  const personalScoreById = new Map<string, number>();
  const items: IngredientMatchedRecipeView[] = [];
  for (const row of recipeRows) {
    if (!isRecipeSafeForBaby(row.ingredients, dictMap, baby)) continue;

    const hitsUserSelection = row.ingredients.some((ri) => userOwnedOnly.has(ri.ingredientId));
    if (!hitsUserSelection) continue;

    const match = calculateIngredientMatch(
      row.ingredients,
      input.ingredientIds,
      dictMap,
      pantryBasicIds,
      input.assumeBasicPantry,
    );

    const pScore = computeRecipeRecommendationScore(
      {
        id: row.id,
        qualityScore: row.qualityScore,
        primaryIngredientIds: row.ingredients
          .filter((ri) => !ri.isOptional)
          .map((ri) => ri.ingredientId),
      },
      personalization,
    );
    personalScoreById.set(row.id, pScore.totalScore);

    const card = toRecipeCardView(row, baby, favSet, logSummaries, dictMap);
    items.push({
      ...card,
      ...match,
    });
  }

  // PRD 3.5: 매칭률 순 → 동점 시 개인화·품질 점수(REC-05, AI-13) → 조리시간 짧은 순
  items.sort((a, b) => {
    if (b.matchRate !== a.matchRate) return b.matchRate - a.matchRate;
    const pDiff = (personalScoreById.get(b.id) ?? 0) - (personalScoreById.get(a.id) ?? 0);
    if (pDiff !== 0) return pDiff;
    return a.cookMinutes - b.cookMinutes;
  });

  // ING-06: 매칭률 80% 이상 결과가 3개 미만이면 즉석 AI 생성 슬롯 노출 대상
  const highMatchCount = items.filter((i) => i.matchRate >= 80).length;

  return {
    items,
    showAiGenerationSlot: highMatchCount < 3,
  };
}
