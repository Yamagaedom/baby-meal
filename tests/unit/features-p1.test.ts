import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { signupUser } from "@/features/auth";
import { createMealLogForBaby, getTasteReportForBaby } from "@/features/meal-log";
import {
  deductUserPantryItems,
  listPantryItemsForUser,
  saveUserPantryItems,
} from "@/features/pantry";
import { createBabyProfile } from "@/features/profile";
import {
  buildPersonalizationProfileFromLogs,
  computeRecipeRecommendationScore,
  getTodayRecommendations,
} from "@/features/recommend";
import { getPrisma } from "@/lib/db";

describe("P1 기능 통합 검증 — 개인화·최근메뉴하향·내냉장고·입맛리포트 (REC-05/06, ING-07, LOG-07, AI-13)", () => {
  const prisma = getPrisma();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("REC-05, REC-06: 잘 먹은 메뉴·재료는 점수가 상승하고 최근 3일 이내 먹은 메뉴는 순위가 대폭 하향된다", () => {
    const now = new Date("2026-10-31T09:00:00.000Z");
    const oneDayAgo = new Date("2026-10-30T09:00:00.000Z");
    const fiveDaysAgo = new Date("2026-10-26T09:00:00.000Z");

    const profile = buildPersonalizationProfileFromLogs(
      [
        {
          recipeId: "recipe-fav-old",
          eatenAt: fiveDaysAgo,
          rating: "GOOD",
          primaryIngredientIds: ["ing-beef", "ing-zucchini"],
        },
        {
          recipeId: "recipe-eaten-yesterday",
          eatenAt: oneDayAgo,
          rating: "GOOD",
          primaryIngredientIds: ["ing-beef"],
        },
        {
          recipeId: "recipe-refused-old",
          eatenAt: fiveDaysAgo,
          rating: "REFUSED",
          primaryIngredientIds: ["ing-broccoli"],
        },
      ],
      now,
    );

    const favOldScore = computeRecipeRecommendationScore(
      {
        id: "recipe-fav-old",
        qualityScore: 1.2,
        primaryIngredientIds: ["ing-beef", "ing-zucchini"],
      },
      profile,
    );
    const neutralScore = computeRecipeRecommendationScore(
      {
        id: "recipe-neutral",
        qualityScore: 0,
        primaryIngredientIds: ["ing-carrot"],
      },
      profile,
    );
    const refusedScore = computeRecipeRecommendationScore(
      {
        id: "recipe-refused-old",
        qualityScore: -0.9,
        primaryIngredientIds: ["ing-broccoli"],
      },
      profile,
    );
    const recentScore = computeRecipeRecommendationScore(
      {
        id: "recipe-eaten-yesterday",
        qualityScore: 1.2,
        primaryIngredientIds: ["ing-beef"],
      },
      profile,
    );

    expect(favOldScore.totalScore).toBeGreaterThan(neutralScore.totalScore);
    expect(neutralScore.totalScore).toBeGreaterThan(refusedScore.totalScore);
    expect(recentScore.isRecentlyEaten).toBe(true);
    expect(recentScore.totalScore).toBeLessThan(refusedScore.totalScore);
  });

  it("ING-07, LOG-07, AI-13: 내 냉장고 저장·차감, 먹은 기록에 따른 qualityScore 반영 및 입맛 리포트 집계가 정상 동작한다", async () => {
    const suffix = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
    const signup = await signupUser({
      loginId: `p1user${suffix}`,
      password: "safepass1234",
      agreeIrrecoverable: true,
    });
    createdUserIds.push(signup.user.id);

    const { baby } = await createBabyProfile(signup.user.id, {
      nickname: "하늘이",
      ageMonth: 20,
      saltLevel: "LOW",
      allergens: ["EGG"],
    });

    // 1) ING-07: 내 냉장고 저장 및 알레르기 재료 자동 필터링 + 차감
    const [potato, carrot, egg] = await Promise.all([
      prisma.ingredient.findUniqueOrThrow({ where: { name: "감자" } }),
      prisma.ingredient.findUniqueOrThrow({ where: { name: "당근" } }),
      prisma.ingredient.findUniqueOrThrow({ where: { name: "달걀" } }),
    ]);

    const saveRes = await saveUserPantryItems(signup.user.id, {
      ingredientIds: [potato.id, carrot.id, egg.id],
    });
    expect(saveRes.savedCount).toBe(3);

    // 달걀 알레르기 아기 기준으로 냉장고 목록 조회 시 달걀은 안전 제외되어 2개만 반환
    const safePantry = await listPantryItemsForUser(signup.user.id, baby);
    expect(safePantry.map((p) => p.name).sort()).toEqual(["감자", "당근"]);

    const deductRes = await deductUserPantryItems(signup.user.id, {
      ingredientIds: [potato.id],
    });
    expect(deductRes.deductedCount).toBe(1);

    const afterDeduct = await listPantryItemsForUser(signup.user.id, baby);
    expect(afterDeduct.map((p) => p.name)).toEqual(["당근"]);

    // 2) LOG-07 & AI-13: 홈 추천 메뉴에 GOOD 기록 저장 후 입맛 리포트와 qualityScore 반영 검증
    const home = await getTodayRecommendations(signup.user.id, baby);
    const mealCard = home.meals.breakfast ?? home.meals.lunch!;
    expect(mealCard).toBeTruthy();

    await createMealLogForBaby(baby, {
      recipeId: mealCard.id,
      rating: "GOOD",
      amountEaten: "ALL",
      mealTime: "LUNCH",
    });

    const updatedRecipe = await prisma.recipe.findUniqueOrThrow({
      where: { id: mealCard.id },
      select: { qualityScore: true },
    });
    expect(updatedRecipe.qualityScore).toBeGreaterThan(0);

    const report = await getTasteReportForBaby(baby);
    expect(report.topMenus.some((m) => m.recipeId === mealCard.id)).toBe(true);
    expect(report.topIngredients.length).toBeGreaterThan(0);
    expect(report.untriedIngredients.length).toBeGreaterThan(0);
    // 달걀 알레르기 아기에게 달걀류는 미시도 추천 식재료로 절대 노출되지 않아야 함
    expect(report.untriedIngredients.some((u) => u.group === "EGG")).toBe(false);
  });
});
