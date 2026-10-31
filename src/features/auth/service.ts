/**
 * 계정 도메인 서비스 (PRD 3.10 ACC-01~08)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { loginIdSchema, passwordSchema } from "@/lib/validation";
import {
  DEFAULT_SESSION_HOURS,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  REMEMBER_ME_DAYS,
} from "./constants";
import {
  generateRecoveryCode,
  generateSessionToken,
  hashSecret,
  hashSessionToken,
  normalizeRecoveryCode,
  verifySecret,
} from "./crypto";

export const signupInputSchema = z.object({
  loginId: loginIdSchema,
  password: passwordSchema,
  agreeIrrecoverable: z.literal(true, {
    error: "계정 분실 시 복구 불가 안내에 동의해 주세요.",
  }),
});

export const loginInputSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  rememberMe: z.boolean().optional().default(false),
});

export const resetPasswordInputSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력해 주세요."),
  recoveryCode: z.string().trim().min(8, "복구 코드를 입력해 주세요."),
  newPassword: passwordSchema,
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  newPassword: passwordSchema,
});

export const verifyPasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
});

export interface AuthUserSummary {
  id: string;
  loginId: string;
  createdAt: Date;
}

function buildSessionExpiry(rememberMe: boolean, now: Date): Date {
  const ms = rememberMe
    ? REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000
    : DEFAULT_SESSION_HOURS * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

/** ACC-01~05: 회원가입 및 복구 코드 1회 발급 */
export async function signupUser(
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{
  user: AuthUserSummary;
  recoveryCode: string;
  sessionToken: string;
  expiresAt: Date;
}> {
  const input = signupInputSchema.parse(rawInput);

  const existing = await prisma.user.findUnique({
    where: { loginId: input.loginId },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_LOGIN_ID", "이미 사용 중인 아이디입니다.");
  }

  const recoveryCode = generateRecoveryCode();
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hashSecret(input.password),
    hashSecret(normalizeRecoveryCode(recoveryCode)),
  ]);

  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = buildSessionExpiry(false, now);

  try {
    const user = await prisma.user.create({
      data: {
        loginId: input.loginId,
        passwordHash,
        recoveryCodeHash,
        sessions: {
          create: {
            tokenHash,
            expiresAt,
          },
        },
      },
      select: {
        id: true,
        loginId: true,
        createdAt: true,
      },
    });

    return { user, recoveryCode, sessionToken, expiresAt };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      throw new AppError(409, "DUPLICATE_LOGIN_ID", "이미 사용 중인 아이디입니다.");
    }
    throw err;
  }
}

/** ACC-06: 로그인 (5회 연속 실패 시 10분 잠금, 자동 로그인 옵션) */
export async function loginUser(
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{
  user: AuthUserSummary;
  sessionToken: string;
  expiresAt: Date;
  rememberMe: boolean;
}> {
  const input = loginInputSchema.parse(rawInput);

  const user = await prisma.user.findUnique({
    where: { loginId: input.loginId.toLowerCase() },
  });

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  // 잠금 상태 확인
  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    const remainingMinutes = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000),
    );
    throw new AppError(
      423,
      "ACCOUNT_LOCKED",
      `로그인 시도가 ${MAX_FAILED_LOGINS}회 실패하여 계정이 잠겼습니다. 약 ${remainingMinutes}분 후 다시 시도해 주세요.`,
    );
  }

  // 이전 잠금이 이미 만료된 상태였다면 실패 횟수 기준을 0에서 다시 시작
  const baseFailCount =
    user.lockedUntil && user.lockedUntil.getTime() <= now.getTime() ? 0 : user.failedLoginCount;

  const valid = await verifySecret(user.passwordHash, input.password);
  if (!valid) {
    const nextFailCount = baseFailCount + 1;
    const shouldLock = nextFailCount >= MAX_FAILED_LOGINS;
    const lockedUntil = shouldLock ? new Date(now.getTime() + LOCK_DURATION_MS) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailCount,
        lockedUntil,
      },
    });

    if (shouldLock) {
      throw new AppError(
        423,
        "ACCOUNT_LOCKED",
        `로그인 시도가 ${MAX_FAILED_LOGINS}회 연속 실패하여 10분간 계정이 잠겼습니다.`,
      );
    }

    throw new AppError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = buildSessionExpiry(input.rememberMe, now);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    user: { id: user.id, loginId: user.loginId, createdAt: user.createdAt },
    sessionToken,
    expiresAt,
    rememberMe: input.rememberMe,
  };
}

/** 세션 토큰으로 현재 로그인 사용자 조회 */
export async function getAuthenticatedUser(
  rawSessionToken: string | undefined | null,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<AuthUserSummary | null> {
  if (!rawSessionToken) return null;
  const tokenHash = hashSessionToken(rawSessionToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, loginId: true, createdAt: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

/** 로그아웃 */
export async function logoutSession(
  rawSessionToken: string | undefined | null,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  if (!rawSessionToken) return;
  const tokenHash = hashSessionToken(rawSessionToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/** ACC-04: 복구 코드로 비밀번호 재설정 → 기존 복구 코드 폐기 후 새 복구 코드 발급 */
export async function resetPasswordWithRecoveryCode(
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<{ newRecoveryCode: string }> {
  const input = resetPasswordInputSchema.parse(rawInput);

  const user = await prisma.user.findUnique({
    where: { loginId: input.loginId.toLowerCase() },
  });

  if (!user) {
    throw new AppError(400, "INVALID_RECOVERY", "아이디 또는 복구 코드가 올바르지 않습니다.");
  }

  const normalizedCode = normalizeRecoveryCode(input.recoveryCode);
  const validCode = await verifySecret(user.recoveryCodeHash, normalizedCode);
  if (!validCode) {
    throw new AppError(400, "INVALID_RECOVERY", "아이디 또는 복구 코드가 올바르지 않습니다.");
  }

  const newRecoveryCode = generateRecoveryCode();
  const [newPasswordHash, newRecoveryCodeHash] = await Promise.all([
    hashSecret(input.newPassword),
    hashSecret(normalizeRecoveryCode(newRecoveryCode)),
  ]);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        recoveryCodeHash: newRecoveryCodeHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return { newRecoveryCode };
}

/** ACC-07: 비밀번호 변경 (현재 기기 외 다른 모든 활성 세션 즉시 폐기) */
export async function changePassword(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  currentRawSessionToken?: string | null,
): Promise<void> {
  const input = changePasswordInputSchema.parse(rawInput);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const valid = await verifySecret(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new AppError(400, "WRONG_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
  }

  const newPasswordHash = await hashSecret(input.newPassword);
  const keepTokenHash = currentRawSessionToken ? hashSessionToken(currentRawSessionToken) : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.session.deleteMany({
      where: {
        userId,
        ...(keepTokenHash ? { tokenHash: { not: keepTokenHash } } : {}),
      },
    }),
  ]);
}

/** ACC-07: 복구 코드 재발급 */
export async function reissueRecoveryCode(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<{ recoveryCode: string }> {
  const input = verifyPasswordInputSchema.parse(rawInput);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const valid = await verifySecret(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new AppError(400, "WRONG_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
  }

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashSecret(normalizeRecoveryCode(recoveryCode));

  await prisma.user.update({
    where: { id: userId },
    data: { recoveryCodeHash },
  });

  return { recoveryCode };
}

/** ACC-07: 회원 탈퇴 시 모든 데이터 즉시 삭제 */
export async function deleteAccount(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const input = verifyPasswordInputSchema.parse(rawInput);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const valid = await verifySecret(user.passwordHash, input.currentPassword);
  if (!valid) {
    throw new AppError(400, "WRONG_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
  }

  await prisma.user.delete({ where: { id: userId } });
}
