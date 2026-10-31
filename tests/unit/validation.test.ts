import { describe, expect, it } from "vitest";
import {
  babyAgeMonthSchema,
  babyNicknameSchema,
  loginIdSchema,
  passwordSchema,
  servingsSchema,
} from "@/lib/validation";

describe("lib/validation — 공통 입력 검증 (ACC-02/03/08, PRF-01, SRV-01)", () => {
  it("ACC-02 & ACC-08: 로그인 ID는 영문 소문자·숫자 4~20자만 허용하고 이메일/전화번호를 차단한다", () => {
    expect(loginIdSchema.safeParse("mommy123").success).toBe(true);
    expect(loginIdSchema.safeParse("abc").success).toBe(false); // 3자
    expect(loginIdSchema.safeParse("a".repeat(21)).success).toBe(false); // 21자
    expect(loginIdSchema.safeParse("Mommy123").success).toBe(false); // 대문자
    expect(loginIdSchema.safeParse("user@example.com").success).toBe(false); // 이메일
    expect(loginIdSchema.safeParse("01012345678").success).toBe(false); // 하이픈 없는 휴대폰 번호도 차단
    expect(loginIdSchema.safeParse("010-1234-5678").success).toBe(false); // 전화번호 하이픈 형식 차단
    expect(loginIdSchema.safeParse("baby2026").success).toBe(true); // 일반 영문+숫자 허용
  });

  it("ACC-03: 비밀번호는 8자 이상 영문+숫자 조합이어야 한다", () => {
    expect(passwordSchema.safeParse("pass1234").success).toBe(true);
    expect(passwordSchema.safeParse("pass123").success).toBe(false); // 7자
    expect(passwordSchema.safeParse("passwordonly").success).toBe(false); // 숫자 없음
    expect(passwordSchema.safeParse("12345678").success).toBe(false); // 영문 없음
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
