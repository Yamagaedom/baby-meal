import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  authenticateWithSocialProfile,
  changePassword,
  checkSignupRateLimit,
  deleteAccount,
  getAuthenticatedUser,
  linkSocialAccountToUser,
  listUserSocialAccounts,
  loginUser,
  logoutSession,
  reissueRecoveryCode,
  resetPasswordWithRecoveryCode,
  resetSignupRateLimit,
  signupUser,
  unlinkSocialAccountFromUser,
} from "@/features/auth";

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb("features/auth — 계정 도메인 및 이메일·SNS 연동 검증 (ACC-01~08)", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const createdLoginIds: string[] = [];

  beforeEach(() => {
    resetSignupRateLimit();
  });

  afterAll(async () => {
    if (createdLoginIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          OR: [{ loginId: { in: createdLoginIds } }, { email: { in: createdLoginIds } }],
        },
      });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("ACC-02~05: 가입 시 비밀번호·복구 코드가 평문이 아닌 해시로 저장되며 중복 ID와 미동의를 거부한다", async () => {
    const loginId = `authu${Date.now().toString().slice(-7)}`;
    createdLoginIds.push(loginId);

    // 동의 미체크 거부 (ACC-05)
    await expect(
      signupUser({ loginId, password: "password1", agreeIrrecoverable: false }, prisma),
    ).rejects.toThrow();

    const signed = await signupUser(
      { loginId, password: "password1", agreeIrrecoverable: true },
      prisma,
    );

    expect(signed.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

    // DB 평문 미저장 확인 (ACC-03, ACC-04)
    const dbRow = await prisma.user.findUniqueOrThrow({ where: { id: signed.user.id } });
    expect(dbRow.passwordHash).not.toBe("password1");
    expect(dbRow.passwordHash).toContain("$argon2");
    expect(dbRow.recoveryCodeHash).not.toBe(signed.recoveryCode);
    expect(dbRow.recoveryCodeHash).not.toContain(signed.recoveryCode.slice(0, 4));
    expect(dbRow.recoveryCodeHash).toContain("$argon2");

    // 중복 ID 거부 (ACC-02)
    await expect(
      signupUser({ loginId, password: "password1", agreeIrrecoverable: true }, prisma),
    ).rejects.toMatchObject({ status: 409, code: "DUPLICATE_LOGIN_ID" });
  });

  it("이메일 가입 및 카카오·구글·네이버 SNS 로그인 시 동일 이메일 계정을 자동으로 통합하고 연동/해제를 지원한다", async () => {
    const email = `mom_${Date.now().toString().slice(-7)}@example.com`;
    createdLoginIds.push(email);

    // 1. 이메일로 회원가입
    const signed = await signupUser(
      { loginId: email, email, password: "password1", agreeIrrecoverable: true },
      prisma,
    );
    expect(signed.user.email).toBe(email);
    expect(signed.user.loginId).toBe(email);

    // 이메일로 일반 로그인 확인
    const emailLogged = await loginUser({ loginId: email, password: "password1" }, prisma);
    expect(emailLogged.user.id).toBe(signed.user.id);

    // 2. 동일 이메일로 카카오 SNS 로그인 → 신규 계정 생성 대신 기존 이메일 계정에 자동 통합
    const kakaoRes = await authenticateWithSocialProfile(
      {
        provider: "KAKAO",
        email,
        displayName: "카카오맘",
      },
      prisma,
    );
    expect(kakaoRes.isNewUser).toBe(false);
    expect(kakaoRes.autoLinkedByEmail).toBe(true);
    expect(kakaoRes.user.id).toBe(signed.user.id);

    // 3. 마이페이지에서 구글·네이버 추가 연동 후 목록 조회 및 네이버 연동 해제
    await linkSocialAccountToUser(
      signed.user.id,
      { provider: "GOOGLE", email, displayName: "구글맘" },
      prisma,
    );
    await linkSocialAccountToUser(
      signed.user.id,
      { provider: "NAVER", email, displayName: "네이버맘" },
      prisma,
    );

    const allLinked = await listUserSocialAccounts(signed.user.id, prisma);
    expect(allLinked.map((a) => a.provider)).toEqual(["KAKAO", "GOOGLE", "NAVER"]);

    const afterUnlink = await unlinkSocialAccountFromUser(signed.user.id, "NAVER", prisma);
    expect(afterUnlink.map((a) => a.provider)).toEqual(["KAKAO", "GOOGLE"]);

    // 4. 신규 이메일로 구글 SNS 최초 시작 → 새 계정 자동 생성
    const newSocialEmail = `new_${Date.now().toString().slice(-7)}@gmail.com`;
    createdLoginIds.push(newSocialEmail);
    const newGoogleRes = await authenticateWithSocialProfile(
      {
        provider: "GOOGLE",
        email: newSocialEmail,
        displayName: "신규구글맘",
      },
      prisma,
    );
    expect(newGoogleRes.isNewUser).toBe(true);
    expect(newGoogleRes.user.email).toBe(newSocialEmail);
    expect(newGoogleRes.hasBabyProfile).toBe(false);
  });

  it("ACC-06: 로그인 5회 연속 실패 시 10분간 잠기며, 10분 경과 후 정상 로그인된다", async () => {
    const loginId = `locku${Date.now().toString().slice(-7)}`;
    createdLoginIds.push(loginId);

    await signupUser({ loginId, password: "password1", agreeIrrecoverable: true }, prisma);
    const t0 = new Date("2026-10-31T12:00:00Z");

    // 1~4회 실패 → 401
    for (let i = 1; i <= 4; i += 1) {
      await expect(
        loginUser({ loginId, password: "wrongpass1", rememberMe: false }, prisma, t0),
      ).rejects.toMatchObject({ status: 401 });
    }

    // 5회째 실패 → 423 잠금
    await expect(
      loginUser({ loginId, password: "wrongpass1", rememberMe: false }, prisma, t0),
    ).rejects.toMatchObject({ status: 423, code: "ACCOUNT_LOCKED" });

    // 잠금 중(5분 경과)에는 올바른 비밀번호도 차단
    const t5m = new Date(t0.getTime() + 5 * 60_000);
    await expect(
      loginUser({ loginId, password: "password1", rememberMe: false }, prisma, t5m),
    ).rejects.toMatchObject({ status: 423, code: "ACCOUNT_LOCKED" });

    // 10분 경과 후 올바른 비밀번호로 잠금 해제 및 세션 생성
    const t11m = new Date(t0.getTime() + 11 * 60_000);
    const logged = await loginUser(
      { loginId, password: "password1", rememberMe: true },
      prisma,
      t11m,
    );
    expect(logged.user.loginId).toBe(loginId);

    const authed = await getAuthenticatedUser(logged.sessionToken, prisma, t11m);
    expect(authed?.id).toBe(logged.user.id);

    await logoutSession(logged.sessionToken, prisma);
    expect(await getAuthenticatedUser(logged.sessionToken, prisma, t11m)).toBeNull();
  });

  it("ACC-04 & ACC-07: 복구 코드 재설정 시 기존 코드가 폐기되고, 탈퇴 후 동일 ID 재가입 시 이전 데이터가 없다", async () => {
    const loginId = `recovu${Date.now().toString().slice(-7)}`;
    createdLoginIds.push(loginId);

    const { user, recoveryCode } = await signupUser(
      { loginId, password: "password1", agreeIrrecoverable: true },
      prisma,
    );

    await prisma.baby.create({
      data: {
        userId: user.id,
        nickname: "첫째",
        ageMonthAtInput: 16,
        ageInputDate: new Date("2026-10-31"),
        saltLevel: "NONE",
      },
    });

    // 복구 코드(하이픈 생략 소문자 입력도 정규화 지원)로 비밀번호 재설정
    const { newRecoveryCode } = await resetPasswordWithRecoveryCode(
      {
        loginId,
        recoveryCode: recoveryCode.replace(/-/g, "").toLowerCase(),
        newPassword: "newpassword2",
      },
      prisma,
    );
    expect(newRecoveryCode).not.toBe(recoveryCode);

    // 폐기된 이전 복구 코드 재사용 차단
    await expect(
      resetPasswordWithRecoveryCode({ loginId, recoveryCode, newPassword: "password3" }, prisma),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_RECOVERY" });

    // 비밀번호 변경 및 복구 코드 재발급 (ACC-07)
    await changePassword(
      user.id,
      { currentPassword: "newpassword2", newPassword: "password4" },
      prisma,
    );
    const reissued = await reissueRecoveryCode(user.id, { currentPassword: "password4" }, prisma);
    expect(reissued.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

    // 회원 탈퇴 후 동일 ID로 재가입 시 이전 아기 프로필이 전혀 없어야 함 (ACC-07)
    await deleteAccount(user.id, { currentPassword: "password4" }, prisma);

    const reSigned = await signupUser(
      { loginId, password: "password5", agreeIrrecoverable: true },
      prisma,
    );
    const babiesAfterRejoin = await prisma.baby.count({ where: { userId: reSigned.user.id } });
    expect(babiesAfterRejoin).toBe(0);
  });

  it("가입 속도 제한이 초과 요청을 429로 차단한다", () => {
    checkSignupRateLimit("127.0.0.1", 1000, 2);
    checkSignupRateLimit("127.0.0.1", 2000, 2);
    expect(() => checkSignupRateLimit("127.0.0.1", 3000, 2)).toThrowError(
      expect.objectContaining({ status: 429, code: "RATE_LIMITED" }),
    );
  });
});
