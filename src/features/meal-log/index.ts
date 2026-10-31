/**
 * 먹은 기록 및 입맛 리포트 도메인 (PRD 3.8 LOG-01~07, 3.9 AI-13)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { recomputeRecipeQualityScore } from "@/features/ai-generation/quality";
import { type BabyProfileView, buildBabyAllergyFilter } from "@/features/profile";
import {
  isRecipeSafeForBaby,
  loadIngredientDictionaryMap,
  summarizeRatingsForBadge,
} from "@/features/recipe";
import { kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import { type IngredientGroup, MEAL_TIMES } from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import { checkAllergyConflicts } from "@/lib/safety";
import { isValidCalendarDateString } from "@/lib/validation";

export const RATING_LABELS = {
  GOOD: "잘 먹었어요",
  OK: "보통이에요",
  REFUSED: "안 먹었어요",
} as const;

export const AMOUNT_EATEN_LABELS = {
  ALL: "다 먹음",
  HALF: "절반",
  LITTLE: "조금",
} as const;

export const REACTION_OPTIONS = ["발진", "두드러기", "구토", "설사", "입주변붉어짐"] as const;

export const createMealLogInputSchema = z.object({
  recipeId: z.string().uuid(),
  rating: z.enum(["GOOD", "OK", "REFUSED"]),
  amountEaten: z.enum(["ALL", "HALF", "LITTLE"]).nullable().optional(),
  mealTime: z.enum(MEAL_TIMES).nullable().optional(),
  eatenDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.")
    .refine(isValidCalendarDateString, "유효한 달력 날짜가 아닙니다.")
    .optional(),
  memo: z.string().trim().max(300, "메모는 300자 이하로 입력해 주세요.").optional(),
  reactions: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  suspectedIngredientIds: z.array(z.string().uuid()).optional().default([]),
});

export interface MealLogItemView {
  id: string;
  recipeId: string;
  recipeName: string;
  eatenDate: string;
  eatenAtIso: string;
  mealTime: string | null;
  rating: "GOOD" | "OK" | "REFUSED";
  ratingLabel: string;
  amountEaten: "ALL" | "HALF" | "LITTLE" | null;
  amountEatenLabel: string | null;
  memo: string | null;
  reactions: string[];
}

export interface RecipeLogSummaryView {
  recipeId: string;
  recipeName: string;
  totalCount: number;
  goodCount: number;
  okCount: number;
  refusedCount: number;
  badgeText: string | null;
  lastEatenDate: string;
}

export interface TasteReportView {
  /** 잘 먹은 TOP 메뉴 (LOG-07) */
  topMenus: {
    recipeId: string;
    recipeName: string;
    goodCount: number;
    totalCount: number;
  }[];
  /** 잘 먹은 TOP 식재료 (LOG-07) */
  topIngredients: {
    ingredientId: string;
    name: string;
    group: IngredientGroup;
    goodCount: number;
  }[];
  /** 거부 반응이 많았던 식재료 (LOG-07) */
  refusedIngredients: {
    ingredientId: string;
    name: string;
    group: IngredientGroup;
    refusedCount: number;
  }[];
  /** 아직 먹어보지 않은 안전 추천 식재료 (LOG-07 — 알레르기·월령 제한 자동 제외) */
  untriedIngredients: {
    ingredientId: string;
    name: string;
    group: IngredientGroup;
  }[];
}

/**
 * LOG-01~04, AI-13: 먹은 기록 저장 + 이상 반응 시 선택 식재료를 알레르기 의심(SUSPECTED) 목록에 즉시 등록 + 레시피 품질 점수 갱신
 */
export async function createMealLogForBaby(
  baby: BabyProfileView,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{ logId: string; addedSuspectedCount: number }> {
  const input = createMealLogInputSchema.parse(rawInput);

  if (input.eatenDate && input.eatenDate > kstDateString(now)) {
    throw new AppError(
      400,
      "FUTURE_DATE_NOT_ALLOWED",
      "미래 날짜로는 먹은 기록을 남길 수 없습니다.",
    );
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: input.recipeId },
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
      "알레르기 식재료가 포함된 레시피에는 기록할 수 없습니다.",
    );
  }

  const recipeIngredientSet = new Set(recipe.ingredients.map((ri) => ri.ingredientId));
  const validSuspectedIds = Array.from(new Set(input.suspectedIngredientIds)).filter((id) =>
    recipeIngredientSet.has(id),
  );

  const eatenAt = input.eatenDate ? new Date(`${input.eatenDate}T03:00:00.000Z`) : now;

  const created = await prisma.$transaction(async (tx) => {
    const log = await tx.mealLog.create({
      data: {
        babyId: baby.id,
        recipeId: recipe.id,
        eatenAt,
        mealTime: input.mealTime ?? null,
        rating: input.rating,
        amountEaten: input.amountEaten ?? null,
        memo: input.memo || null,
        reactions: input.reactions,
      },
    });

    if (validSuspectedIds.length > 0) {
      await tx.allergy.createMany({
        data: validSuspectedIds.map((ingredientId) => ({
          babyId: baby.id,
          ingredientId,
          status: "SUSPECTED" as const,
        })),
        skipDuplicates: true,
      });
    }

    return log;
  });

  // AI-13: 먹은 기록 평점을 레시피 qualityScore에 즉시 반영
  await recomputeRecipeQualityScore(recipe.id, prisma);

  return {
    logId: created.id,
    addedSuspectedCount: validSuspectedIds.length,
  };
}

/**
 * LOG-07: 아기 입맛 리포트 산출
 * - 잘 먹은 TOP 메뉴 / 식재료, 거부 반응 식재료, 아직 시도하지 않은 안전 식재료 추천
 */
export async function getTasteReportForBaby(
  baby: BabyProfileView,
  prisma: PrismaClient = getPrisma(),
): Promise<TasteReportView> {
  const [rows, allIngredientRows] = await Promise.all([
    prisma.mealLog.findMany({
      where: { babyId: baby.id },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                ingredient: {
                  select: { id: true, name: true, group: true, isPantryBasic: true },
                },
              },
            },
          },
        },
      },
      orderBy: { eatenAt: "desc" },
    }),
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  const dictMap = new Map(
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

  const safeRows = rows.filter(
    (r) =>
      r.recipe.status === "ACTIVE" && isRecipeSafeForBaby(r.recipe.ingredients, dictMap, baby),
  );

  const menuStats = new Map<
    string,
    { recipeName: string; goodCount: number; totalCount: number }
  >();
  const ingStats = new Map<
    string,
    { name: string; group: IngredientGroup; goodCount: number; refusedCount: number }
  >();
  const triedIngredientIds = new Set<string>();

  for (const r of safeRows) {
    const m = menuStats.get(r.recipeId) ?? {
      recipeName: r.recipe.name,
      goodCount: 0,
      totalCount: 0,
    };
    m.totalCount += 1;
    if (r.rating === "GOOD") m.goodCount += 1;
    menuStats.set(r.recipeId, m);

    for (const ri of r.recipe.ingredients) {
      triedIngredientIds.add(ri.ingredientId);
      if (ri.isOptional || ri.ingredient.isPantryBasic || ri.ingredient.group === "SEASONING") {
        continue;
      }
      const stat = ingStats.get(ri.ingredientId) ?? {
        name: ri.ingredient.name,
        group: ri.ingredient.group,
        goodCount: 0,
        refusedCount: 0,
      };
      if (r.rating === "GOOD") stat.goodCount += 1;
      if (r.rating === "REFUSED") stat.refusedCount += 1;
      ingStats.set(ri.ingredientId, stat);
    }
  }

  const topMenus = Array.from(menuStats.entries())
    .filter(([, v]) => v.goodCount > 0)
    .map(([recipeId, v]) => ({ recipeId, ...v }))
    .sort((a, b) => b.goodCount - a.goodCount || b.totalCount - a.totalCount)
    .slice(0, 5);

  const topIngredients = Array.from(ingStats.entries())
    .filter(([, v]) => v.goodCount > 0)
    .map(([ingredientId, v]) => ({
      ingredientId,
      name: v.name,
      group: v.group,
      goodCount: v.goodCount,
    }))
    .sort((a, b) => b.goodCount - a.goodCount)
    .slice(0, 8);

  const refusedIngredients = Array.from(ingStats.entries())
    .filter(([, v]) => v.refusedCount > v.goodCount && v.refusedCount > 0)
    .map(([ingredientId, v]) => ({
      ingredientId,
      name: v.name,
      group: v.group,
      refusedCount: v.refusedCount,
    }))
    .sort((a, b) => b.refusedCount - a.refusedCount)
    .slice(0, 8);

  // 아직 시도하지 않은 추천 식재료: 아기 월령 허용 + 알레르기 무충돌 + 양념/가공 제외 + 영양군 고르게 추천
  const allergyFilter = buildBabyAllergyFilter(baby);
  const preferredGroups: IngredientGroup[] = [
    "VEGETABLE",
    "MEAT",
    "LEGUME_TOFU",
    "SEAFOOD",
    "GRAIN",
    "FRUIT",
    "DAIRY",
    "EGG",
  ];

  const untriedCandidates = allIngredientRows.filter(
    (ing) =>
      !triedIngredientIds.has(ing.id) &&
      !ing.isPantryBasic &&
      ing.group !== "SEASONING" &&
      ing.group !== "PROCESSED" &&
      ing.minAgeMonth <= baby.currentAgeMonth &&
      !checkAllergyConflicts([{ ingredientId: ing.id }], dictMap, allergyFilter).hasConflict,
  );

  const untriedIngredients: TasteReportView["untriedIngredients"] = [];
  for (const grp of preferredGroups) {
    const match = untriedCandidates.find(
      (c) => c.group === grp && !untriedIngredients.some((u) => u.ingredientId === c.id),
    );
    if (match) {
      untriedIngredients.push({
        ingredientId: match.id,
        name: match.name,
        group: match.group,
      });
    }
    if (untriedIngredients.length >= 8) break;
  }

  for (const c of untriedCandidates) {
    if (untriedIngredients.length >= 8) break;
    if (!untriedIngredients.some((u) => u.ingredientId === c.id)) {
      untriedIngredients.push({
        ingredientId: c.id,
        name: c.name,
        group: c.group,
      });
    }
  }

  return {
    topMenus,
    topIngredients,
    refusedIngredients,
    untriedIngredients,
  };
}

/**
 * LOG-05, LOG-06, LOG-07: 날짜별(캘린더) 뷰 + 메뉴별 누적 뷰 + 입맛 리포트 조회
 * (비노출 레시피 및 현재 아기 알레르기·의심 식재료 포함 레시피는 안전 정책에 따라 노출 제외)
 */
export async function getMealLogsForBaby(
  baby: BabyProfileView,
  options: { yearMonth?: string } = {},
  prisma: PrismaClient = getPrisma(),
): Promise<{
  logs: MealLogItemView[];
  calendarByDate: Record<string, MealLogItemView[]>;
  byRecipe: RecipeLogSummaryView[];
  tasteReport: TasteReportView;
}> {
  if (options.yearMonth !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(options.yearMonth)) {
    throw new AppError(400, "VALIDATION_ERROR", "조회 연월(YYYY-MM) 형식이 올바르지 않습니다.");
  }

  const [rows, dictMap, tasteReport] = await Promise.all([
    prisma.mealLog.findMany({
      where: { babyId: baby.id },
      include: {
        recipe: {
          include: {
            ingredients: { select: { ingredientId: true } },
          },
        },
      },
      orderBy: { eatenAt: "desc" },
    }),
    loadIngredientDictionaryMap(prisma),
    getTasteReportForBaby(baby, prisma),
  ]);

  const safeRows = rows.filter(
    (r) => r.recipe.status === "ACTIVE" && isRecipeSafeForBaby(r.recipe.ingredients, dictMap, baby),
  );

  const allItems: MealLogItemView[] = safeRows.map((r) => ({
    id: r.id,
    recipeId: r.recipeId,
    recipeName: r.recipe.name,
    eatenDate: kstDateString(r.eatenAt),
    eatenAtIso: r.eatenAt.toISOString(),
    mealTime: r.mealTime,
    rating: r.rating,
    ratingLabel: RATING_LABELS[r.rating],
    amountEaten: r.amountEaten,
    amountEatenLabel: r.amountEaten ? AMOUNT_EATEN_LABELS[r.amountEaten] : null,
    memo: r.memo,
    reactions: r.reactions,
  }));

  const filteredByMonth = options.yearMonth
    ? allItems.filter((item) => item.eatenDate.startsWith(options.yearMonth!))
    : allItems;

  const calendarByDate: Record<string, MealLogItemView[]> = {};
  for (const item of filteredByMonth) {
    const arr = calendarByDate[item.eatenDate] ?? [];
    arr.push(item);
    calendarByDate[item.eatenDate] = arr;
  }

  const groupedByRecipe = new Map<
    string,
    { name: string; ratings: ("GOOD" | "OK" | "REFUSED")[]; lastEatenDate: string }
  >();
  for (const item of allItems) {
    const existing = groupedByRecipe.get(item.recipeId);
    if (!existing) {
      groupedByRecipe.set(item.recipeId, {
        name: item.recipeName,
        ratings: [item.rating],
        lastEatenDate: item.eatenDate,
      });
    } else {
      existing.ratings.push(item.rating);
    }
  }

  const byRecipe: RecipeLogSummaryView[] = Array.from(groupedByRecipe.entries()).map(
    ([recipeId, val]) => {
      const summary = summarizeRatingsForBadge(val.ratings);
      return {
        recipeId,
        recipeName: val.name,
        totalCount: summary.totalCount,
        goodCount: summary.goodCount,
        okCount: summary.okCount,
        refusedCount: summary.refusedCount,
        badgeText: summary.badgeText,
        lastEatenDate: val.lastEatenDate,
      };
    },
  );

  return {
    logs: filteredByMonth,
    calendarByDate,
    byRecipe,
    tasteReport,
  };
}
