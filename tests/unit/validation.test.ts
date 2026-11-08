import { describe, expect, it } from "vitest";
import {
  accountIdentifierSchema,
  babyAgeMonthSchema,
  babyNicknameSchema,
  emailSchema,
  loginIdSchema,
  passwordSchema,
  servingsSchema,
  socialProviderSchema,
} from "@/lib/validation";

describe("lib/validation — 공통 입력 검증 (ACC-02/03/08, 이메일/SNS, PRF-01, SRV-01)", () => {
  it("ACC-02 & ACC-08: 기존 로그인 ID 스키마는 영문 소문자·숫자 4~20자만 허용하고 이메일/전화번호를 차단한다", () => {
    expect(loginIdSchema.safeParse("mommy123").success).toBe(true);
    expect(loginIdSchema.safeParse("abc").success).toBe(false);
    expect(loginIdSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(loginIdSchema.safeParse("Mommy123").success).toBe(false);
    expect(loginIdSchema.safeParse("user@example.com").success).toBe(false);
    expect(loginIdSchema.safeParse("01012345678").success).toBe(false);
    expect(loginIdSchema.safeParse("010-1234-5678").success).toBe(false);
    expect(loginIdSchema.safeParse("baby2026").success).toBe(true);
  });

  it("이메일 및 통합 계정 식별자 스키마는 이메일 주소와 기존 아이디를 모두 허용하고 전화번호는 차단한다", () => {
    expect(emailSchema.safeParse("Mom@Example.com").success).toBe(true);
    expect(emailSchema.parse("  Mom@Example.com ")).toBe("mom@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);

    expect(accountIdentifierSchema.safeParse("parent@kakao.com").success).toBe(true);
    expect(accountIdentifierSchema.safeParse("happymom24").success).toBe(true);
    expect(accountIdentifierSchema.safeParse("010-1234-5678").success).toBe(false);
    expect(accountIdentifierSchema.safeParse("01012345678").success).toBe(false);

    expect(socialProviderSchema.safeParse("KAKAO").success).toBe(true);
    expect(socialProviderSchema.safeParse("GOOGLE").success).toBe(true);
    expect(socialProviderSchema.safeParse("NAVER").success).toBe(true);
    expect(socialProviderSchema.safeParse("FACEBOOK").success).toBe(false);
  });

  it("ACC-03: 비밀번호는 8자 이상 영문+숫자 조합이어야 한다", () => {
    expect(passwordSchema.safeParse("pass1234").success).toBe(true);
    expect(passwordSchema.safeParse("pass123").success).toBe(false);
    expect(passwordSchema.safeParse("passwordonly").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("PRF-01 & SRV-01: 아기 월령(12~48), 닉네임, 분량(1~5회분) 검증", () => {
    expect(babyAgeMonthSchema.safeParse(12).success).toBe(true);
    expect(babyAgeMonthSchema.safeParse(48).success).toBe(true);
    expect(babyAgeMonthSchema.safeParse(11).success).toBe(false);
    expect(babyAgeMonthSchema.safeParse(49).success).toBe(false);

    expect(babyNicknameSchema.safeParse("튼튼이").success).toBe(true);
    expect(babyNicknameSchema.safeParse("baby@test.com").success).toBe(false);
    expect(babyNicknameSchema.safeParse("010-9999-8888").success).toBe(false);

    expect(servingsSchema.safeParse(1).success).toBe(true);
    expect(servingsSchema.safeParse(5).success).toBe(true);
    expect(servingsSchema.safeParse(0).success).toBe(false);
    expect(servingsSchema.safeParse(6).success).toBe(false);
  });
});
