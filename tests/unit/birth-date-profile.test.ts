import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { EXPANDED_RECIPES } from "@/data/expanded-recipes";
import { signupUser } from "@/features/auth";
import { createBabyProfile, getOwnedBabyOrThrow, updateBabyProfile } from "@/features/profile";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("생년월일 기반 월령 자동 반영 및 확장 레시피 카탈로그 DB 검증", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("생년월일 저장 시 KST 생일 경과에 따라 월령·단계가 자동 반영되고 지원 범위 밖 날짜를 차단한다", async () => {
    const u = await signupUser(
      {
        loginId: `bday${Date.now().toString().slice(-7)}`,
        password: "password1",
        agreeIrrecoverable: true,
      },
      prisma,
    );
    createdUserIds.push(u.user.id);

    const dayBefore16m = new Date("2026-11-09T12:00:00+09:00");
    const on16mBirthday = new Date("2026-11-10T09:00:00+09:00");

    // 범위 밖(11개월 / 50개월 / 미래 날짜) 생년월일 차단
    await expect(
      createBabyProfile(u.user.id, { birthDate: "2025-12-01" }, prisma, dayBefore16m),
    ).rejects.toMatchObject({ status: 400, code: "AGE_OUT_OF_RANGE" });
    await expect(
      createBabyProfile(u.user.id, { birthDate: "2022-08-01" }, prisma, dayBefore16m),
    ).rejects.toMatchObject({ status: 400, code: "AGE_OUT_OF_RANGE" });
    await expect(
      createBabyProfile(u.user.id, { birthDate: "2026-12-01" }, prisma, dayBefore16m),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_BIRTH_DATE" });

    // 2025-07-10 출생: 2026-11-09 기준 만 15개월(완료기, stage 1, 기본 무염)
    const created = await createBabyProfile(
      u.user.id,
      {
        nickname: "생일자동아가",
        birthDate: "2025-07-10",
      },
      prisma,
      dayBefore16m,
    );
    expect(created.baby.birthDate).toBe("2025-07-10");
    expect(created.baby.currentAgeMonth).toBe(15);
    expect(created.baby.ageStage).toBe(1);
    expect(created.baby.saltLevel).toBe("NONE");

    // 하루 뒤(생일 당일 2026-11-10) 조회 시 별도 수정 없이 자동으로 만 16개월(유아식 1단계, stage 2) 반영
    const nextDayView = await getOwnedBabyOrThrow(
      u.user.id,
      created.baby.id,
      prisma,
      on16mBirthday,
    );
    expect(nextDayView.birthDate).toBe("2025-07-10");
    expect(nextDayView.currentAgeMonth).toBe(16);
    expect(nextDayView.ageStage).toBe(2);
    expect(nextDayView.ageStageLabel).toBe("유아식 1단계");

    // 생년월일 수정 (26개월 시점 생년월일로 변경)
    const updatedBday = await updateBabyProfile(
      u.user.id,
      created.baby.id,
      { birthDate: "2024-09-01" },
      prisma,
      on16mBirthday,
    );
    expect(updatedBday.baby.birthDate).toBe("2024-09-01");
    expect(updatedBday.baby.currentAgeMonth).toBe(26);
    expect(updatedBday.baby.ageStage).toBe(3);

    // 수동 월령 모드로 전환 (birthDate: null)
    const manualMode = await updateBabyProfile(
      u.user.id,
      created.baby.id,
      { birthDate: null, ageMonth: 20 },
      prisma,
      on16mBirthday,
    );
    expect(manualMode.baby.birthDate).toBeNull();
    expect(manualMode.baby.currentAgeMonth).toBe(20);
    expect(manualMode.baby.ageStage).toBe(2);
  });

  it("확장 레시피 50개 이상이 DB에 ACTIVE + VERIFIED 출처로 적재되어 있다", async () => {
    const activeTotal = await prisma.recipe.count({ where: { status: "ACTIVE" } });
    expect(activeTotal).toBeGreaterThanOrEqual(202);

    const expandedSlugs = EXPANDED_RECIPES.map((r) => r.slug);
    const savedExpanded = await prisma.recipe.findMany({
      where: { slug: { in: expandedSlugs }, status: "ACTIVE" },
      include: { sources: true },
    });
    expect(savedExpanded.length).toBe(EXPANDED_RECIPES.length);
    expect(
      savedExpanded.every((r) => r.sources.some((s) => s.verificationStatus === "VERIFIED")),
    ).toBe(true);
  });
});
