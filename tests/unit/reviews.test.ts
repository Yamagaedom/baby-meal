import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { signupUser } from "@/features/auth";
import {
  deleteRecipeReview,
  formatAuthorName,
  getRecipeReviews,
  reviewInputSchema,
  upsertRecipeReview,
} from "@/features/reviews";

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describe("features/reviews — 단위 유효성 검증", () => {
  it("작성자 닉네임 포맷이 개인정보를 보호한다 (ACC-08)", () => {
    expect(formatAuthorName("도윤", "testuser123")).toBe("도윤 부모님");
    expect(formatAuthorName(null, "parent1234")).toBe("par***");
    expect(formatAuthorName(null, "ab")).toBe("ab***");
    expect(formatAuthorName(null, null)).toBe("튼튼이 부모님");
  });

  it("별점 및 후기 글자 수 제약 조건(Zod)이 정확히 동작한다", () => {
    // 유효한 입력
    expect(
      reviewInputSchema.parse({
        rating: 5,
        content: "아이가 너무 맛있게 잘 먹어요!",
        babyAgeMonth: 14,
      }),
    ).toBeDefined();

    // 별점 범위 밖 (0점, 6점)
    expect(() =>
      reviewInputSchema.parse({
        rating: 0,
        content: "내용입니다",
      }),
    ).toThrow();

    expect(() =>
      reviewInputSchema.parse({
        rating: 6,
        content: "내용입니다",
      }),
    ).toThrow();

    // 5자 미만 본문 거부
    expect(() =>
      reviewInputSchema.parse({
        rating: 4,
        content: "좋아",
      }),
    ).toThrow();
  });
});

describeWithDb("features/reviews — DB 통합 검증 (별점·후기·평균 계산)", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it("후기 등록 시 레시피의 averageRating 및 reviewCount가 자동 갱신된다", async () => {
    const ts = String(Date.now()).slice(-6);
    const userA = await signupUser(
      {
        loginId: `reva${ts}`,
        password: "Password123!",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    const userB = await signupUser(
      {
        loginId: `revb${ts}`,
        password: "Password123!",
        agreeIrrecoverable: true,
      },
      prisma,
    );

    // 테스트용 레시피 1개 생성
    const testRecipe = await prisma.recipe.create({
      data: {
        name: `테스트 레시피 ${ts}`,
        category: "MEAL",
        mealCategories: ["LUNCH"],
        ageStages: [1],
        saltLevel: "NONE",
        cookMinutes: 15,
        baseServings: 2,
        sodiumMgPerServing: 10,
        allergens: [],
        steps: [{ order: 1, instruction: "조리합니다" }],
        babyTips: {
          textureTip: "부드럽게",
          cuttingSizeTip: "5mm",
          seasoningTip: "무염",
        },
        storageInfo: {
          fridgeDays: 2,
          freezerDays: 7,
          reheatTip: "데우기",
        },
        status: "ACTIVE",
        averageRating: 0.0,
        reviewCount: 0,
      },
    });

    try {
      // 1. 유저 A가 5점 후기 작성
      const revA = await upsertRecipeReview(
        testRecipe.id,
        userA.user.id,
        "도윤 부모님",
        {
          rating: 5,
          content: "14개월 아기가 남김없이 다 먹었어요!",
          babyAgeMonth: 14,
        },
        prisma,
      );
      expect(revA.rating).toBe(5);

      const afterA = await prisma.recipe.findUnique({
        where: { id: testRecipe.id },
        select: { averageRating: true, reviewCount: true },
      });
      expect(afterA?.averageRating).toBe(5.0);
      expect(afterA?.reviewCount).toBe(1);

      // 2. 유저 B가 4점 후기 작성
      await upsertRecipeReview(
        testRecipe.id,
        userB.user.id,
        "하은 부모님",
        {
          rating: 4,
          content: "약간 뻑뻑해서 채수를 조금 더 넣었습니다.",
          babyAgeMonth: 16,
        },
        prisma,
      );

      const afterB = await prisma.recipe.findUnique({
        where: { id: testRecipe.id },
        select: { averageRating: true, reviewCount: true },
      });
      // (5 + 4) / 2 = 4.5
      expect(afterB?.averageRating).toBe(4.5);
      expect(afterB?.reviewCount).toBe(2);

      // 3. 후기 목록 및 통계 조회
      const queryResult = await getRecipeReviews(testRecipe.id, userA.user.id, prisma);
      expect(queryResult.stats.averageRating).toBe(4.5);
      expect(queryResult.stats.totalReviews).toBe(2);
      expect(queryResult.stats.ratingCounts[5]).toBe(1);
      expect(queryResult.stats.ratingCounts[4]).toBe(1);
      expect(queryResult.reviews.find((r) => r.id === revA.id)?.isMyReview).toBe(true);

      // 4. 유저 A가 본인 후기 삭제 시 평균 평점 재계산
      await deleteRecipeReview(testRecipe.id, revA.id, userA.user.id, prisma);

      const afterDelete = await prisma.recipe.findUnique({
        where: { id: testRecipe.id },
        select: { averageRating: true, reviewCount: true },
      });
      expect(afterDelete?.averageRating).toBe(4.0);
      expect(afterDelete?.reviewCount).toBe(1);
    } finally {
      // 정리: 레시피 삭제 시 후기도 Cascade 삭제됨
      await prisma.recipe.delete({ where: { id: testRecipe.id } });
    }
  });
});
