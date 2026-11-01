import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { signupUser } from "@/features/auth";
import {
  calculateIngredientMatch,
  recommendRecipesByIngredients,
  searchIngredientsForBaby,
} from "@/features/ingredient-search";
import { createMealLogForBaby, getMealLogsForBaby } from "@/features/meal-log";
import {
  createBabyProfile,
  getOwnedBabyOrThrow,
  listBabyProfiles,
} from "@/features/profile";
import { getRecipeDetailForBaby, loadIngredientDictionaryMap } from "@/features/recipe";
import {
  getTodayRecommendations,
  searchRecipesForBaby,
  toggleRecipeFavorite,
} from "@/features/recommend";
import { submitRecipeReport } from "@/features/report";

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("P0 도메인 통합 검증 — 프로필·추천·재료검색·기록·신고 (PRF, REC, RCP, ING, LOG, AI-12)", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const createdUserIds: string[] = [];
  let hiddenRecipeIdsToRestore: string[] = [];

  afterAll(async () => {
    if (hiddenRecipeIdsToRestore.length > 0) {
      await prisma.recipe.updateMany({
        where: { id: { in: hiddenRecipeIdsToRestore } },
        data: { status: "ACTIVE" },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("PRF-01~06: 범위 밖 월령(11/49) 거부, 최대 5명 제한, 미매핑 알레르기 경고, 타 계정 아기 ID 403 차단", async () => {
    const u1 = await signupUser(
      {
        loginId: `prfu1${Date.now().toString().slice(-6)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    const u2 = await signupUser(
      {
        loginId: `prfu2${Date.now().toString().slice(-6)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(u1.user.id, u2.user.id);

    // 월령 11/49 서버 거부
    await expect(createBabyProfile(u1.user.id, { ageMonth: 11 }, prisma)).rejects.toThrow();
    await expect(createBabyProfile(u1.user.id, { ageMonth: 49 }, prisma)).rejects.toThrow();

    // 동의어("계란")는 매핑되고 미등록 단어("우주선열매")는 경고 반환
    const first = await createBabyProfile(
      u1.user.id,
      {
        nickname: "첫째",
        ageMonth: 14,
        customAllergyTerms: ["계란", "우주선열매"],
      },
      prisma,
    );
    expect(first.baby.ageStage).toBe(1);
    expect(first.baby.saltLevel).toBe("NONE");
    expect(first.baby.allergies.some((a) => a.label === "달걀")).toBe(true);
    expect(first.warnings[0]).toContain("우주선열매");

    // 다른 계정(u2)이 u1의 아기 ID 조회 시도 → 403 차단
    await expect(getOwnedBabyOrThrow(u2.user.id, first.baby.id, prisma)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN_BABY",
    });

    // 최대 5명 제한 확인
    for (let i = 2; i <= 5; i += 1) {
      await createBabyProfile(u1.user.id, { nickname: `아가${i}`, ageMonth: 20 }, prisma);
    }
    expect(await listBabyProfiles(u1.user.id, prisma)).toHaveLength(5);
    await expect(
      createBabyProfile(u1.user.id, { nickname: "여섯째", ageMonth: 20 }, prisma),
    ).rejects.toMatchObject({ status: 400, code: "MAX_BABIES_REACHED" });
  });

  it("REC-02 & RCP-01~06 & AGE-02: 달걀 알레르기 프로필에서 달걀·식빵 레시피가 추천·검색·즐겨찾기·단건 조회 어디서도 노출되지 않는다", async () => {
    const u = await signupUser(
      {
        loginId: `recu${Date.now().toString().slice(-7)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(u.user.id);

    const { baby } = await createBabyProfile(
      u.user.id,
      {
        nickname: "알레르기테스트",
        ageMonth: 15, // 완료기(1단계)
        saltLevel: "LOW",
        allergens: ["EGG"],
      },
      prisma,
    );

    const eggCustard = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "tofu-egg-steamed-custard" },
    });
    const frenchToast = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "french-toast-apple-finger" }, // 식빵(EGG 하위 성분) + 달걀
    });

    // 1) 오늘의 추천에서 제외
    const today = await getTodayRecommendations(u.user.id, baby, { seed: "test-seed" }, prisma);
    const todayIds = [
      today.meals.breakfast?.id,
      today.meals.lunch?.id,
      today.meals.dinner?.id,
      ...today.meals.extraMeals.map((m) => m.id),
      ...today.snacks.map((s) => s.id),
    ].filter(Boolean);
    expect(todayIds).not.toContain(eggCustard.id);
    expect(todayIds).not.toContain(frenchToast.id);

    // 2) 전체 탐색(상위 연령 단계 수동 탐색 포함)에서도 달걀 포함 레시피 절대 미노출
    const allStage2 = await searchRecipesForBaby(u.user.id, baby, { stage: 2 }, prisma);
    expect(allStage2.some((r) => r.id === eggCustard.id)).toBe(false);
    expect(allStage2.some((r) => r.id === frenchToast.id)).toBe(false);
    expect(allStage2.every((r) => !r.allergens.some((a) => a.code === "EGG"))).toBe(true);

    // AGE-02: 15개월(1단계) 아기가 2단계 전용 레시피 조회 시 aboveAgeWarning 표시
    const braisedPotato = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "beef-potato-braised-low-sodium" }, // ageStages: [2, 3, 4]
    });
    const detail = await getRecipeDetailForBaby(u.user.id, baby, braisedPotato.id, 4, prisma);
    const oneServing = await getRecipeDetailForBaby(u.user.id, baby, braisedPotato.id, 1, prisma);
    expect(detail.nutrition).toEqual(oneServing.nutrition);
    expect(detail.aboveAgeWarning).toBe(true);
    expect(detail.aboveAgeWarningMessage).toContain("주의");
    expect(detail.showPortionStorageTip).toBe(true);

    // 3) 직접 단건 조회 및 즐겨찾기 시도 → 403 ALLERGY_BLOCKED 차단
    await expect(
      getRecipeDetailForBaby(u.user.id, baby, eggCustard.id, undefined, prisma),
    ).rejects.toMatchObject({ status: 403, code: "ALLERGY_BLOCKED" });

    await expect(
      toggleRecipeFavorite(u.user.id, baby, eggCustard.id, prisma),
    ).rejects.toMatchObject({ status: 403, code: "ALLERGY_BLOCKED" });
  });

  it("ING-01~06: 재료 기반 매칭 점수(선택 재료 제외, 기본 양념 포함) 및 부족 재료 표시", async () => {
    const dictMap = await loadIngredientDictionaryMap(prisma);
    const potato = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "potato" } });
    const beef = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "beef-lean" } });
    const carrot = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "carrot" } });
    const water = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "water" } });
    const sesameOil = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "sesame-oil" } });

    // 필수 3개(감자, 소고기, 물[기본양념]) + 선택 1개(참기름) → 감자·소고기 보유 + 기본양념 ON이면 100% "모든 재료 보유"
    const fullMatch = calculateIngredientMatch(
      [
        { ingredientId: potato.id, isOptional: false },
        { ingredientId: beef.id, isOptional: false },
        { ingredientId: water.id, isOptional: false },
        { ingredientId: sesameOil.id, isOptional: true },
      ],
      [potato.id, beef.id],
      dictMap,
      new Set([water.id, sesameOil.id]),
      true,
    );
    expect(fullMatch.matchRate).toBe(100);
    expect(fullMatch.availabilityBadge).toBe("모든 재료 보유");

    // 당근 1개 부족 시 → 67%, "1개 부족: 당근"
    const partialMatch = calculateIngredientMatch(
      [
        { ingredientId: potato.id, isOptional: false },
        { ingredientId: beef.id, isOptional: false },
        { ingredientId: carrot.id, isOptional: false },
      ],
      [potato.id, beef.id],
      dictMap,
      new Set(),
      false,
    );
    expect(partialMatch.matchRate).toBe(67);
    expect(partialMatch.availabilityBadge).toBe("1개 부족: 당근");

    // 실제 DB 추천 호출 검증
    const u = await signupUser(
      {
        loginId: `ingu${Date.now().toString().slice(-7)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(u.user.id);
    const { baby } = await createBabyProfile(
      u.user.id,
      { ageMonth: 20, saltLevel: "LOW", allergens: ["EGG"] },
      prisma,
    );

    const auto = await searchIngredientsForBaby(baby, "호박", prisma);
    expect(auto.results.some((r) => r.name === "애호박")).toBe(true);
    // 달걀 알레르기 아기의 인기 칩에는 달걀이 제외되어야 함
    expect(auto.popularChips.some((c) => c.slug === "egg")).toBe(false);

    const rec = await recommendRecipesByIngredients(
      u.user.id,
      baby,
      { ingredientIds: [potato.id, carrot.id, beef.id], assumeBasicPantry: true },
      prisma,
    );
    expect(rec.items.length).toBeGreaterThan(0);
    // 내림차순 정렬 확인
    for (let i = 1; i < rec.items.length; i += 1) {
      expect(rec.items[i - 1].matchRate).toBeGreaterThanOrEqual(rec.items[i].matchRate);
    }
  });

  it("LOG-01~06 & AI-12: 먹은 기록 의심 재료 즉시 반영 및 위험 신고 즉시 HIDDEN 전환", async () => {
    const u = await signupUser(
      {
        loginId: `logu${Date.now().toString().slice(-7)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(u.user.id);

    const { baby } = await createBabyProfile(
      u.user.id,
      { ageMonth: 18, saltLevel: "NONE" },
      prisma,
    );

    const compote = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "pear-steamed-warm-compote" },
      include: { ingredients: true },
    });
    const pearIng = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "pear" } });

    // 1) 정상 기록 후 평가 배지 확인
    await createMealLogForBaby(
      baby,
      {
        recipeId: compote.id,
        rating: "GOOD",
        amountEaten: "ALL",
        mealTime: "SNACK",
        eatenDate: "2026-10-31",
        memo: "따뜻하게 잘 먹음",
      },
      prisma,
    );

    const logsBefore = await getMealLogsForBaby(baby, { yearMonth: "2026-10" }, prisma);
    expect(logsBefore.logs).toHaveLength(1);
    expect(logsBefore.byRecipe[0].badgeText).toBe("잘 먹음 1회");

    // 2) 이상 반응으로 "배(pear)"를 의심 재료(SUSPECTED)로 등록
    await createMealLogForBaby(
      baby,
      {
        recipeId: compote.id,
        rating: "REFUSED",
        reactions: ["발진"],
        suspectedIngredientIds: [pearIng.id],
      },
      prisma,
    );

    const refreshedBaby = await getOwnedBabyOrThrow(u.user.id, baby.id, prisma);
    expect(
      refreshedBaby.allergies.some((a) => a.ingredientId === pearIng.id && a.status === "SUSPECTED"),
    ).toBe(true);

    // 의심 재료 추가 직후 배숙퓨레 단건 조회 및 추천에서 즉시 차단!
    await expect(
      getRecipeDetailForBaby(u.user.id, refreshedBaby, compote.id, undefined, prisma),
    ).rejects.toMatchObject({ status: 403, code: "ALLERGY_BLOCKED" });

    // 3) AI-12: 위험 재료 신고 1건 시 즉시 HIDDEN 전환 및 모든 목록 제외
    const avocadoCup = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "avocado-banana-yogurt-cup" },
    });
    hiddenRecipeIdsToRestore = [avocadoCup.id];

    const repRes = await submitRecipeReport(
      u.user.id,
      avocadoCup.id,
      { reason: "UNSAFE_INGREDIENT", memo: "테스트 위험 신고" },
      prisma,
    );
    expect(repRes.hiddenNow).toBe(true);

    // 중복 신고 시 409
    await expect(
      submitRecipeReport(u.user.id, avocadoCup.id, { reason: "OTHER" }, prisma),
    ).rejects.toMatchObject({ status: 409, code: "DUPLICATE_REPORT" });

    // HIDDEN 처리 후 조회 시 404 및 탐색 목록 미노출
    await expect(
      getRecipeDetailForBaby(u.user.id, refreshedBaby, avocadoCup.id, undefined, prisma),
    ).rejects.toMatchObject({ status: 404, code: "RECIPE_NOT_FOUND" });

    const searchAfterHide = await searchRecipesForBaby(u.user.id, refreshedBaby, {}, prisma);
    expect(searchAfterHide.some((r) => r.id === avocadoCup.id)).toBe(false);
  });
});
