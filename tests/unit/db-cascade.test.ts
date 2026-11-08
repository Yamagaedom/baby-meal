import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("DB 스키마 계정·SNS 연동 컬럼 및 회원 탈퇴 연쇄 삭제 검증 (ACC-07, ACC-08)", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it("ACC-08: users 테이블은 login_id·email 컬럼을 가지며 전화번호·실명 컬럼이 없고, babies 테이블은 선택 생년월일(birth_date)과 월령 컬럼을 갖는다", async () => {
    const userColumns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const userColNames = userColumns.map((c) => c.column_name.toLowerCase());
    expect(userColNames).toContain("login_id");
    expect(userColNames).toContain("email");
    expect(userColNames).not.toContain("phone");
    expect(userColNames).not.toContain("phone_number");
    expect(userColNames).not.toContain("name");
    expect(userColNames).not.toContain("real_name");

    const babyColumns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'babies'
    `;
    const babyColNames = babyColumns.map((c) => c.column_name.toLowerCase());
    expect(babyColNames).toContain("birth_date");
    expect(babyColNames).toContain("age_month_at_input");
    expect(babyColNames).toContain("age_input_date");
  });

  it("ACC-07: User 삭제 시 Session, SocialAccount, AiUsage, Baby, Allergy, MealLog, PantryItem, Favorite, Report가 연쇄 삭제된다", async () => {
    const sampleIngredient = await prisma.ingredient.findFirstOrThrow();
    const sampleRecipe = await prisma.recipe.findFirstOrThrow();

    const tempLoginId = `cascadetest${Date.now().toString().slice(-6)}`;
    const user = await prisma.user.create({
      data: {
        loginId: tempLoginId,
        email: `${tempLoginId}@example.com`,
        passwordHash: "hash",
        recoveryCodeHash: "recovery-hash",
      },
    });

    await prisma.socialAccount.create({
      data: {
        userId: user.id,
        provider: "KAKAO",
        providerUserId: `kakao:${tempLoginId}`,
        email: `${tempLoginId}@example.com`,
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `token-${user.id}`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    await prisma.aiUsage.create({
      data: {
        userId: user.id,
        usageDate: new Date("2026-10-31"),
        count: 2,
      },
    });

    const baby = await prisma.baby.create({
      data: {
        userId: user.id,
        nickname: "테스트아가",
        ageMonthAtInput: 15,
        ageInputDate: new Date("2026-10-31"),
        saltLevel: "NONE",
      },
    });

    await prisma.allergy.create({
      data: {
        babyId: baby.id,
        ingredientId: sampleIngredient.id,
        status: "CONFIRMED",
      },
    });

    await prisma.mealLog.create({
      data: {
        babyId: baby.id,
        recipeId: sampleRecipe.id,
        rating: "GOOD",
        amountEaten: "ALL",
        reactions: [],
      },
    });

    await prisma.pantryItem.create({
      data: {
        userId: user.id,
        ingredientId: sampleIngredient.id,
      },
    });

    await prisma.favorite.create({
      data: {
        userId: user.id,
        recipeId: sampleRecipe.id,
      },
    });

    await prisma.report.create({
      data: {
        userId: user.id,
        recipeId: sampleRecipe.id,
        reason: "OTHER",
      },
    });

    await prisma.recipeReview.create({
      data: {
        userId: user.id,
        recipeId: sampleRecipe.id,
        authorName: "탈퇴유저 부모님",
        rating: 5,
        content: "탈퇴 시 함께 삭제되어야 하는 후기입니다.",
      },
    });

    // 회원 탈퇴(삭제) 실행
    await prisma.user.delete({ where: { id: user.id } });

    const [
      remainingSessions,
      remainingSocialAccounts,
      remainingUsage,
      remainingBabies,
      remainingAllergies,
      remainingLogs,
      remainingPantry,
      remainingFavorites,
      remainingReports,
      remainingReviews,
    ] = await Promise.all([
      prisma.session.count({ where: { id: session.id } }),
      prisma.socialAccount.count({ where: { userId: user.id } }),
      prisma.aiUsage.count({ where: { userId: user.id } }),
      prisma.baby.count({ where: { id: baby.id } }),
      prisma.allergy.count({ where: { babyId: baby.id } }),
      prisma.mealLog.count({ where: { babyId: baby.id } }),
      prisma.pantryItem.count({ where: { userId: user.id } }),
      prisma.favorite.count({ where: { userId: user.id } }),
      prisma.report.count({ where: { userId: user.id } }),
      prisma.recipeReview.count({ where: { userId: user.id } }),
    ]);

    expect(remainingSessions).toBe(0);
    expect(remainingSocialAccounts).toBe(0);
    expect(remainingUsage).toBe(0);
    expect(remainingBabies).toBe(0);
    expect(remainingAllergies).toBe(0);
    expect(remainingLogs).toBe(0);
    expect(remainingPantry).toBe(0);
    expect(remainingFavorites).toBe(0);
    expect(remainingReports).toBe(0);
    expect(remainingReviews).toBe(0);
  });
});
