/**
 * 레시피 조회·안전 필터·상세 변환 도메인 (PRD 3.4 RCP-01~06, 3.6 AGE-02~05, 3.7 SRV-01~05, 3.9 AI-06/08)
 *
 * [핵심 안전 정책]
 * 1. status !== "ACTIVE"(HIDDEN 등)인 레시피는 어떤 경로에서도 노출하지 않는다.
 * 2. 활성 아기 프로필의 알레르기(CONFIRMED + SUSPECTED + 기피 식재료)와 충돌하는 레시피는
 *    목록은 물론 직접 URL/API 단건 조회에서도 403(ALLERGY_BLOCKED)으로 원천 차단한다 (REC-02).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { type BabyProfileView, buildBabyAllergyFilter } from "@/features/profile";
import {
  getPortionGuideForStage,
  scaleIngredientAmount,
  shouldShowPortionStorageTip,
} from "@/features/serving";
import { getAgeStageInfo, isRecipeAboveAge } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import {
  ALLERGEN_LABELS,
  type AgeStage,
  type Allergen,
  type IngredientInfo,
  type MealTime,
  type RecipeCategory,
  type RecipeNutritionFacts,
  type SaltLevel,
} from "@/lib/domain/types";
import { computeRecipeNutrition } from "@/features/nutrition";
import { AppError } from "@/lib/http/errors";
import { checkAllergyConflicts } from "@/lib/safety";
import {
  babyTipsSchema,
  isValidUuid,
  recipeStepSchema,
  servingsSchema,
  storageInfoSchema,
} from "@/lib/validation";
import { z } from "zod";

export const AI_RECIPE_DISCLAIMER =
  "AI가 웹 자료를 참고해 만든 레시피입니다. 사람이 검수하지 않았으니 재료와 조리법을 꼭 확인하세요.";

export const MEDICAL_DISCLAIMER =
  "본 서비스는 의료적 조언을 대체하지 않습니다. 처음 먹이는 식재료는 소량부터 시도하고 이상 반응을 살펴주세요.";

export const UNSALTED_FLAVOR_GUIDE =
  "무염 맛내기 팁: 소금·간장 대신 양파·무·배추로 우린 채수, 멸치·다시마 육수, 표고버섯, 사과·단호박의 자연 단맛을 활용해 보세요.";

export const SALT_LEVEL_LABELS: Record<SaltLevel, string> = {
  NONE: "무염",
  LOW: "저염",
  NORMAL: "일반(유아 싱겁게)",
};

export function allowedSaltLevelsForBaby(babySaltLevel: SaltLevel): SaltLevel[] {
  if (babySaltLevel === "NONE") return ["NONE"];
  if (babySaltLevel === "LOW") return ["NONE", "LOW"];
  return ["NONE", "LOW", "NORMAL"];
}

export async function loadIngredientDictionaryMap(
  prisma: PrismaClient = getPrisma(),
): Promise<Map<string, IngredientInfo>> {
  const rows = await prisma.ingredient.findMany();
  return new Map(
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
}

export interface MealLogBadgeSummary {
  goodCount: number;
  okCount: number;
  refusedCount: number;
  totalCount: number;
  badgeText: string | null;
}

export function summarizeRatingsForBadge(
  ratings: readonly ("GOOD" | "OK" | "REFUSED")[],
): MealLogBadgeSummary {
  let goodCount = 0;
  let okCount = 0;
  let refusedCount = 0;
  for (const r of ratings) {
    if (r === "GOOD") goodCount += 1;
    else if (r === "OK") okCount += 1;
    else refusedCount += 1;
  }
  const totalCount = ratings.length;
  let badgeText: string | null = null;
  if (goodCount > 0) badgeText = `잘 먹음 ${goodCount}회`;
  else if (okCount > 0) badgeText = `보통 ${okCount}회`;
  else if (refusedCount > 0) badgeText = `안 먹음 ${refusedCount}회`;

  return { goodCount, okCount, refusedCount, totalCount, badgeText };
}

export async function loadMealLogSummariesByRecipe(
  babyId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<Map<string, MealLogBadgeSummary>> {
  const logs = await prisma.mealLog.findMany({
    where: { babyId },
    select: { recipeId: true, rating: true },
  });

  const grouped = new Map<string, ("GOOD" | "OK" | "REFUSED")[]>();
  for (const l of logs) {
    const arr = grouped.get(l.recipeId) ?? [];
    arr.push(l.rating);
    grouped.set(l.recipeId, arr);
  }

  const out = new Map<string, MealLogBadgeSummary>();
  for (const [recipeId, list] of grouped.entries()) {
    out.set(recipeId, summarizeRatingsForBadge(list));
  }
  return out;
}

export interface RecipeCardView {
  id: string;
  slug: string | null;
  name: string;
  summary: string | null;
  category: RecipeCategory;
  mealCategories: MealTime[];
  ageStages: AgeStage[];
  ageStageLabels: string[];
  saltLevel: SaltLevel;
  saltLevelLabel: string;
  cookMinutes: number;
  difficulty: number;
  tools: string[];
  baseServings: number;
  sodiumMgPerServing: number;
  allergens: { code: Allergen; label: string }[];
  isFavorite: boolean;
  ratingBadge: string | null;
  aboveAgeWarning: boolean;
  isAiGenerated: boolean;
  favoriteCount: number;
  averageRating: number;
  reviewCount: number;
}

export interface RecipeDetailView extends RecipeCardView {
  targetServings: number;
  portionGuide: string;
  showPortionStorageTip: boolean;
  aboveAgeWarningMessage: string | null;
  unsaltedFlavorGuide: string | null;
  cautionIngredients: { name: string; cautionNote: string }[];
  nutrition: RecipeNutritionFacts | null;
  ingredients: {
    ingredientId: string;
    name: string;
    baseAmount: number | null;
    baseUnit: string;
    displayAmount: string;
    prepNote: string | null;
    isOptional: boolean;
    substituteName: string | null;
  }[];
  steps: {
    order: number;
    instruction: string;
    timerSeconds: number | null;
  }[];
  babyTips: {
    textureTip: string;
    cuttingSizeTip: string;
    seasoningTip: string;
    stageVariations: Record<string, string>;
  };
  storageInfo: {
    fridgeDays: number | null;
    freezerDays: number | null;
    reheatTip: string;
    portionTip: string | null;
  };
  sources: {
    id: string;
    url: string;
    title: string;
    channelOrSite: string;
    sourceType: string;
    verificationStatus?: string;
  }[];
  aiDisclaimer: string;
  medicalDisclaimer: string;
}

export function isRecipeSafeForBaby(
  recipeIngredients: readonly { ingredientId: string }[],
  dictMap: ReadonlyMap<string, IngredientInfo>,
  baby: BabyProfileView,
): boolean {
  const allergyProfile = buildBabyAllergyFilter(baby);
  const check = checkAllergyConflicts(recipeIngredients, dictMap, allergyProfile);
  return !check.hasConflict;
}

export function toRecipeCardView(
  row: {
    id: string;
    slug: string | null;
    name: string;
    summary: string | null;
    category: RecipeCategory;
    mealCategories: MealTime[];
    ageStages: number[];
    saltLevel: SaltLevel;
    cookMinutes: number;
    difficulty: number;
    tools: string[];
    baseServings: number;
    sodiumMgPerServing: number;
    allergens: Allergen[];
    isAiGenerated?: boolean;
    favoriteCount?: number;
    averageRating?: number;
    reviewCount?: number;
  },
  baby: BabyProfileView,
  favoriteSet: ReadonlySet<string>,
  logSummaries: ReadonlyMap<string, MealLogBadgeSummary>,
): RecipeCardView {
  const stages = row.ageStages as AgeStage[];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    category: row.category,
    mealCategories: row.mealCategories,
    ageStages: stages,
    ageStageLabels: stages.map((s) => getAgeStageInfo(s).label),
    saltLevel: row.saltLevel,
    saltLevelLabel: SALT_LEVEL_LABELS[row.saltLevel],
    cookMinutes: row.cookMinutes,
    difficulty: row.difficulty,
    tools: row.tools,
    baseServings: row.baseServings,
    sodiumMgPerServing: row.sodiumMgPerServing,
    allergens: row.allergens.map((code) => ({ code, label: ALLERGEN_LABELS[code] })),
    isFavorite: favoriteSet.has(row.id),
    ratingBadge: logSummaries.get(row.id)?.badgeText ?? null,
    aboveAgeWarning: isRecipeAboveAge(stages, baby.currentAgeMonth),
    isAiGenerated: Boolean(row.isAiGenerated),
    favoriteCount: row.favoriteCount ?? 0,
    averageRating: row.averageRating ? Math.round(row.averageRating * 10) / 10 : 0,
    reviewCount: row.reviewCount ?? 0,
  };
}

/**
 * RCP-01~06, SRV-01~05, AGE-02~05, REC-02:
 * 레시피 상세 단건 조회 (활성 아기 알레르기 포함 시 403으로 차단, HIDDEN은 404)
 */
export async function getRecipeDetailForBaby(
  userId: string,
  baby: BabyProfileView,
  recipeId: string,
  requestedServings?: number,
  prisma: PrismaClient = getPrisma(),
): Promise<RecipeDetailView> {
  if (!isValidUuid(recipeId)) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없거나 비노출 처리되었습니다.");
  }

  const row = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          ingredient: true,
          substitute: { select: { id: true, name: true } },
        },
      },
      sources: true,
    },
  });

  if (!row || row.status !== "ACTIVE") {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없거나 비노출 처리되었습니다.");
  }

  const dictMap = await loadIngredientDictionaryMap(prisma);
  if (!isRecipeSafeForBaby(row.ingredients, dictMap, baby)) {
    throw new AppError(
      403,
      "ALLERGY_BLOCKED",
      "선택한 아기 프로필의 알레르기·주의 식재료가 포함된 레시피이므로 안전을 위해 열람이 차단되었습니다.",
    );
  }

  const allergyProfile = buildBabyAllergyFilter(baby);

  const targetServings =
    requestedServings !== undefined ? servingsSchema.parse(requestedServings) : row.baseServings;

  const [favRow, logSummaries] = await Promise.all([
    prisma.favorite.findUnique({
      where: { userId_recipeId: { userId, recipeId: row.id } },
      select: { id: true },
    }),
    loadMealLogSummariesByRecipe(baby.id, prisma),
  ]);

  const card = toRecipeCardView(row, baby, new Set(favRow ? [row.id] : []), logSummaries);

  const parsedSteps = z.array(recipeStepSchema).parse(row.steps);
  const parsedTips = babyTipsSchema.parse(row.babyTips);
  const parsedStorage = storageInfoSchema.parse(row.storageInfo);

  const cautionIngredients = row.ingredients
    .filter((ri) => ri.ingredient.cautionNote)
    .map((ri) => ({
      name: ri.ingredient.name,
      cautionNote: ri.ingredient.cautionNote!,
    }));

  let nutrition = (row.nutrition as unknown as RecipeNutritionFacts) ?? null;
  if (!nutrition) {
    nutrition = computeRecipeNutrition(row.ingredients, dictMap, targetServings);
  }

  return {
    ...card,
    targetServings,
    portionGuide: getPortionGuideForStage(baby.ageStage),
    showPortionStorageTip: shouldShowPortionStorageTip(targetServings),
    aboveAgeWarningMessage: card.aboveAgeWarning
      ? `주의: 현재 아기 월령(${baby.currentAgeMonth}개월, ${baby.ageStageLabel})보다 높은 연령 단계(${card.ageStageLabels.join(", ")})용 레시피입니다. 식감과 크기를 더 작고 무르게 조절해 주세요.`
      : null,
    unsaltedFlavorGuide: row.saltLevel === "NONE" ? UNSALTED_FLAVOR_GUIDE : null,
    cautionIngredients,
    nutrition,
    ingredients: row.ingredients.map((ri) => {
      const scaled = scaleIngredientAmount(ri.amount, ri.unit, row.baseServings, targetServings);
      let safeSubstituteName: string | null = null;
      if (ri.substitute) {
        const subInfo = dictMap.get(ri.substitute.id);
        if (
          subInfo &&
          subInfo.minAgeMonth <= baby.currentAgeMonth &&
          !checkAllergyConflicts([{ ingredientId: ri.substitute.id }], dictMap, allergyProfile)
            .hasConflict
        ) {
          safeSubstituteName = ri.substitute.name;
        }
      }
      return {
        ingredientId: ri.ingredientId,
        name: ri.ingredient.name,
        baseAmount: ri.amount,
        baseUnit: ri.unit,
        displayAmount: scaled.displayAmount,
        prepNote: ri.prepNote,
        isOptional: ri.isOptional,
        substituteName: safeSubstituteName,
      };
    }),
    steps: parsedSteps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        order: s.order,
        instruction: s.instruction,
        timerSeconds: s.timerSeconds ?? null,
      })),
    babyTips: {
      textureTip: parsedTips.textureTip,
      cuttingSizeTip: parsedTips.cuttingSizeTip,
      seasoningTip: parsedTips.seasoningTip,
      stageVariations: parsedTips.stageVariations ?? {},
    },
    storageInfo: {
      fridgeDays: parsedStorage.fridgeDays ?? null,
      freezerDays: parsedStorage.freezerDays ?? null,
      reheatTip: parsedStorage.reheatTip,
      portionTip:
        parsedStorage.portionTip ??
        "2회분 이상 조리 시 한 끼 분량씩 소분해 완전히 식힌 뒤 밀폐 용기에 담아 냉장·냉동 보관하세요.",
    },
    sources: row.sources.map((src) => ({
      id: src.id,
      url: src.url,
      title: src.title,
      channelOrSite: src.channelOrSite,
      sourceType: src.sourceType,
      verificationStatus: src.verificationStatus,
    })),
    aiDisclaimer: AI_RECIPE_DISCLAIMER,
    medicalDisclaimer: MEDICAL_DISCLAIMER,
  };
}
