/**
 * 출시 전 이슈(ISSUE-01 ~ ISSUE-13) 회귀 테스트 — docs/REVIEW.md 7장 대응
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { changePassword, getAuthenticatedUser, loginUser, signupUser } from "@/features/auth";
import { createMealLogForBaby, getMealLogsForBaby } from "@/features/meal-log";
import {
  addSuspectedIngredientsToBaby,
  createBabyProfile,
  deleteBabyProfile,
  getOwnedBabyOrThrow,
  removeBabyAllergyItem,
  updateBabyProfile,
} from "@/features/profile";
import { getRecipeDetailForBaby } from "@/features/recipe";
import { getTodayRecommendations, toggleRecipeFavorite } from "@/features/recommend";
import { listPendingRegenerationRecipes, submitRecipeReport } from "@/features/report";
import { toErrorResponse } from "@/lib/http/errors";
import { isValidCalendarDateString, isValidUuid } from "@/lib/validation";

describe("ISSUE-04/06 순수 검증 헬퍼", () => {
  it("isValidUuid: 정상 UUID만 허용", () => {
    expect(isValidUuid(randomUUID())).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });

  it("isValidCalendarDateString: 실존하지 않는 날짜 차단", () => {
    expect(isValidCalendarDateString("2026-10-31")).toBe(true);
    expect(isValidCalendarDateString("2028-02-29")).toBe(true);
    expect(isValidCalendarDateString("2026-02-31")).toBe(false);
    expect(isValidCalendarDateString("2026-99-99")).toBe(false);
    expect(isValidCalendarDateString("2026-1-1")).toBe(false);
  });

  it("toErrorResponse: 잘못된 JSON(SyntaxError) 400 INVALID_JSON, Prisma P2023 400 INVALID_ID", async () => {
    const jsonRes = toErrorResponse(new SyntaxError("Unexpected token"), "test");
    expect(jsonRes.status).toBe(400);
    expect((await jsonRes.json()).error.code).toBe("INVALID_JSON");

    const idRes = toErrorResponse({ code: "P2023", message: "invalid uuid" }, "test");
    expect(idRes.status).toBe(400);
    expect((await idRes.json()).error.code).toBe("INVALID_ID");
  });
});

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("출시 전 이슈 DB 회귀 검증 (ISSUE-01, 04, 05, 06, 07, 08, 09, 10, 11)", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const createdUserIds: string[] = [];
  const recipeIdsToRestore: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (recipeIdsToRestore.length > 0) {
      await prisma.report.deleteMany({ where: { recipeId: { in: recipeIdsToRestore } } });
      await prisma.recipe.updateMany({
        where: { id: { in: recipeIdsToRestore } },
        data: { status: "ACTIVE" },
      });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  async function newUser(prefix: string) {
    const res = await signupUser(
      {
        loginId: `${prefix}${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(res.user.id);
    return res;
  }

  it("ISSUE-01: 대체 재료가 아기 알레르기와 충돌하면 substituteName을 노출하지 않는다", async () => {
    const u = await newUser("iss01");
    const { baby } = await createBabyProfile(
      u.user.id,
      { ageMonth: 20, saltLevel: "NONE", allergens: ["SOYBEAN"] },
      prisma,
    );
    // 닭안심브로콜리우유리조또: 우유 → 무가당두유(SOYBEAN) 대체 지정
    const risotto = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "chicken-broccoli-risotto" },
    });
    const detail = await getRecipeDetailForBaby(u.user.id, baby, risotto.id, undefined, prisma);
    const milkRow = detail.ingredients.find((i) => i.name === "우유");
    expect(milkRow).toBeDefined();
    expect(milkRow?.substituteName).toBeNull();

    // 알레르기 없는 아기는 기존처럼 대체 재료 안내 노출
    const u2 = await newUser("iss01b");
    const { baby: freeBaby } = await createBabyProfile(u2.user.id, { ageMonth: 20 }, prisma);
    const freeDetail = await getRecipeDetailForBaby(
      u2.user.id,
      freeBaby,
      risotto.id,
      undefined,
      prisma,
    );
    expect(freeDetail.ingredients.find((i) => i.name === "우유")?.substituteName).toBe("무가당두유");
  });

  it("ISSUE-04: 잘못된 UUID 형식 경로 파라미터는 500이 아닌 404로 응답한다", async () => {
    const u = await newUser("iss04");
    const { baby } = await createBabyProfile(u.user.id, { ageMonth: 20 }, prisma);

    await expect(
      getRecipeDetailForBaby(u.user.id, baby, "not-a-uuid", undefined, prisma),
    ).rejects.toMatchObject({ status: 404, code: "RECIPE_NOT_FOUND" });
    await expect(toggleRecipeFavorite(u.user.id, baby, "abc", prisma)).rejects.toMatchObject({
      status: 404,
      code: "RECIPE_NOT_FOUND",
    });
    await expect(
      submitRecipeReport(u.user.id, "abc", { reason: "OTHER" }, prisma),
    ).rejects.toMatchObject({ status: 404, code: "RECIPE_NOT_FOUND" });
    await expect(getOwnedBabyOrThrow(u.user.id, "abc", prisma)).rejects.toMatchObject({
      status: 404,
      code: "BABY_NOT_FOUND",
    });
    await expect(
      removeBabyAllergyItem(u.user.id, baby.id, "abc", prisma),
    ).rejects.toMatchObject({ status: 404, code: "ALLERGY_NOT_FOUND" });
  });

  it("ISSUE-05: 의심(SUSPECTED) 식재료를 확정(CONFIRMED)으로 승격하고, 미등록 식재료 ID는 400으로 거부한다", async () => {
    const u = await newUser("iss05");
    const { baby } = await createBabyProfile(u.user.id, { ageMonth: 20 }, prisma);
    const pear = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "pear" } });

    await addSuspectedIngredientsToBaby(u.user.id, baby.id, [pear.id], prisma);
    const before = await getOwnedBabyOrThrow(u.user.id, baby.id, prisma);
    expect(before.allergies.find((a) => a.ingredientId === pear.id)?.status).toBe("SUSPECTED");

    const { baby: after } = await updateBabyProfile(
      u.user.id,
      baby.id,
      { ingredientIds: [pear.id] },
      prisma,
    );
    const pearRows = after.allergies.filter((a) => a.ingredientId === pear.id);
    expect(pearRows).toHaveLength(1);
    expect(pearRows[0].status).toBe("CONFIRMED");

    await expect(
      updateBabyProfile(u.user.id, baby.id, { ingredientIds: [randomUUID()] }, prisma),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_INGREDIENT" });
  });

  it("ISSUE-02 지원: 단일 알레르기 원재료(달걀) 직접 등록 시 derivedAllergens로 EGG가 산출된다", async () => {
    const u = await newUser("iss02");
    const egg = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "egg" } });
    const { baby } = await createBabyProfile(
      u.user.id,
      { ageMonth: 20, ingredientIds: [egg.id] },
      prisma,
    );
    expect(baby.allergies[0].derivedAllergens).toEqual(["EGG"]);
  });

  it("ISSUE-06: 존재하지 않는 날짜·미래 날짜·잘못된 연월 조회를 400으로 거부한다", async () => {
    const u = await newUser("iss06");
    const { baby } = await createBabyProfile(u.user.id, { ageMonth: 20 }, prisma);
    const compote = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "pear-steamed-warm-compote" },
    });
    const now = new Date("2026-10-31T03:00:00.000Z");

    await expect(
      createMealLogForBaby(
        baby,
        { recipeId: compote.id, rating: "GOOD", eatenDate: "2026-02-31" },
        prisma,
        now,
      ),
    ).rejects.toThrow();

    await expect(
      createMealLogForBaby(
        baby,
        { recipeId: compote.id, rating: "GOOD", eatenDate: "2026-11-05" },
        prisma,
        now,
      ),
    ).rejects.toMatchObject({ status: 400, code: "FUTURE_DATE_NOT_ALLOWED" });

    await expect(getMealLogsForBaby(baby, { yearMonth: "2026-13" }, prisma)).rejects.toMatchObject(
      { status: 400, code: "VALIDATION_ERROR" },
    );
  });

  it("ISSUE-07: 위험 신고 시 PENDING_REGEN(재생성 대기 큐)으로 전환되어 비노출되고 큐에서 조회된다", async () => {
    const u = await newUser("iss07");
    const { baby } = await createBabyProfile(u.user.id, { ageMonth: 30 }, prisma);
    const target = await prisma.recipe.findUniqueOrThrow({
      where: { slug: "almond-walnut-banana-rice-cake" },
    });
    recipeIdsToRestore.push(target.id);

    const res = await submitRecipeReport(
      u.user.id,
      target.id,
      { reason: "UNSAFE_INGREDIENT" },
      prisma,
    );
    expect(res.hiddenNow).toBe(true);
    expect(res.queuedForRegen).toBe(true);

    const reloaded = await prisma.recipe.findUniqueOrThrow({ where: { id: target.id } });
    expect(reloaded.status).toBe("PENDING_REGEN");

    const queue = await listPendingRegenerationRecipes(prisma);
    expect(queue.some((q) => q.id === target.id && q.reportCount >= 1)).toBe(true);

    await expect(
      getRecipeDetailForBaby(u.user.id, baby, target.id, undefined, prisma),
    ).rejects.toMatchObject({ status: 404, code: "RECIPE_NOT_FOUND" });
  });

  it("ISSUE-08: 비밀번호 변경 시 현재 세션을 제외한 다른 기기 세션이 즉시 폐기된다", async () => {
    const signup = await newUser("iss08");
    const other = await loginUser(
      { loginId: signup.user.loginId, password: "password1" },
      prisma,
    );

    await changePassword(
      signup.user.id,
      { currentPassword: "password1", newPassword: "newpass123" },
      prisma,
      signup.sessionToken,
    );

    expect(await getAuthenticatedUser(signup.sessionToken, prisma)).not.toBeNull();
    expect(await getAuthenticatedUser(other.sessionToken, prisma)).toBeNull();
  });

  it("ISSUE-09: 복합 가공식품 사전에 하위 알레르기 원재료가 반영되어 있다", async () => {
    const fishCake = await prisma.ingredient.findUniqueOrThrow({
      where: { slug: "fish-cake-white" },
    });
    expect(fishCake.allergens).toEqual(expect.arrayContaining(["SHRIMP", "CRAB"]));
    const curry = await prisma.ingredient.findUniqueOrThrow({
      where: { slug: "curry-powder-mild" },
    });
    expect(curry.allergens).toEqual(expect.arrayContaining(["SOYBEAN", "TOMATO", "BEEF"]));
    const pancake = await prisma.ingredient.findUniqueOrThrow({ where: { slug: "pancake-mix" } });
    expect(pancake.allergens).toEqual(expect.arrayContaining(["SOYBEAN", "MILK"]));
  });

  it("ISSUE-10: 같은 KST 날짜 안에서는 UTC 날짜가 바뀌어도 오늘의 추천 순서가 동일하다", async () => {
    const u = await newUser("iss10");
    const { baby } = await createBabyProfile(u.user.id, { ageMonth: 20 }, prisma);
    // 두 시각 모두 KST 2026-11-01 (UTC 기준으로는 10-31 / 11-01로 서로 다름)
    const a = await getTodayRecommendations(
      u.user.id,
      baby,
      { now: new Date("2026-10-31T16:30:00.000Z") },
      prisma,
    );
    const b = await getTodayRecommendations(
      u.user.id,
      baby,
      { now: new Date("2026-11-01T02:00:00.000Z") },
      prisma,
    );
    const ids = (r: typeof a) => [
      r.meals.breakfast?.id,
      r.meals.lunch?.id,
      r.meals.dinner?.id,
      ...r.snacks.map((s) => s.id),
    ];
    expect(ids(a)).toEqual(ids(b));
  });

  it("ISSUE-11: 마지막 남은 아기 프로필은 삭제할 수 없다", async () => {
    const u = await newUser("iss11");
    const { baby: first } = await createBabyProfile(u.user.id, { ageMonth: 20 }, prisma);
    await expect(deleteBabyProfile(u.user.id, first.id, prisma)).rejects.toMatchObject({
      status: 400,
      code: "MIN_ONE_BABY_REQUIRED",
    });

    const { baby: second } = await createBabyProfile(u.user.id, { ageMonth: 30 }, prisma);
    await deleteBabyProfile(u.user.id, second.id, prisma);
    await expect(getOwnedBabyOrThrow(u.user.id, second.id, prisma)).rejects.toMatchObject({
      status: 404,
    });
  });
});
