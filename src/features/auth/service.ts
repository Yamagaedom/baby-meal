/**
 * 계정 도메인 서비스 (PRD 3.10 ACC-01~08 + 이메일 로그인 및 카카오·구글·네이버 SNS 연동)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import {
  type SocialProviderType,
  accountIdentifierSchema,
  emailSchema,
  passwordSchema,
  socialProviderSchema,
} from "@/lib/validation";
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

export const signupInputSchema = z
  .object({
    loginId: z.string().optional(),
    email: z.string().optional(),
    password: passwordSchema,
    agreeIrrecoverable: z
      .boolean()
      .optional()
      .default(true)
      .refine((v) => v === true, {
        message: "계정 분실 시 복구 불가 안내에 동의해 주세요.",
      }),
  })
  .superRefine((val, ctx) => {
    const rawIdentifier = (val.email?.trim() || val.loginId?.trim() || "").toLowerCase();
    const parsed = accountIdentifierSchema.safeParse(rawIdentifier);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["loginId"],
        message:
          parsed.error.issues[0]?.message ??
          "이메일 주소 또는 영문 소문자·숫자 아이디(4~20자)를 입력해 주세요.",
      });
    }
    if (val.email && val.email.trim().length > 0) {
      const emailCheck = emailSchema.safeParse(val.email);
      if (!emailCheck.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: emailCheck.error.issues[0]?.message ?? "올바른 이메일 주소를 입력해 주세요.",
        });
      }
    }
  });

export const loginInputSchema = z
  .object({
    loginId: z.string().optional(),
    email: z.string().optional(),
    identifier: z.string().optional(),
    password: z.string().min(1, "비밀번호를 입력해 주세요."),
    rememberMe: z.boolean().optional().default(false),
  })
  .refine(
    (val) =>
      Boolean(
        val.identifier?.trim().length || val.email?.trim().length || val.loginId?.trim().length,
      ),
    {
      message: "이메일 또는 아이디를 입력해 주세요.",
      path: ["loginId"],
    },
  );

export const resetPasswordInputSchema = z
  .object({
    loginId: z.string().optional(),
    email: z.string().optional(),
    recoveryCode: z.string().trim().min(8, "복구 코드를 입력해 주세요."),
    newPassword: passwordSchema,
  })
  .refine((val) => Boolean(val.email?.trim().length || val.loginId?.trim().length), {
    message: "이메일 또는 아이디를 입력해 주세요.",
    path: ["loginId"],
  });

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  newPassword: passwordSchema,
});

export const verifyPasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
});

export const deleteAccountInputSchema = z.object({
  currentPassword: z.string().optional(),
  confirmSocialDelete: z.boolean().optional(),
});

export const socialAuthInputSchema = z.object({
  provider: socialProviderSchema,
  email: emailSchema,
  providerUserId: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().max(40).optional(),
  rememberMe: z.boolean().optional().default(true),
});

export const updateEmailInputSchema = z.object({
  email: emailSchema,
});

export interface AuthUserSummary {
  id: string;
  loginId: string;
  email: string | null;
  createdAt: Date;
}

export interface LinkedSocialAccountView {
  id: string;
  provider: SocialProviderType;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  connectedAt: string;
}

function buildSessionExpiry(rememberMe: boolean, now: Date): Date {
  const ms = rememberMe
    ? REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000
    : DEFAULT_SESSION_HOURS * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

/** ACC-01~05: 회원가입 (이메일 또는 아이디) 및 복구 코드 1회 발급 */
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
  const rawIdentifier = (input.email?.trim() || input.loginId?.trim() || "").toLowerCase();
  const identifier = accountIdentifierSchema.parse(rawIdentifier);
  const isEmailIdentifier = identifier.includes("@");

  const explicitEmail =
    input.email && input.email.trim().length > 0 ? emailSchema.parse(input.email) : null;
  const resolvedEmail = isEmailIdentifier ? identifier : explicitEmail;
  const resolvedLoginId = isEmailIdentifier
    ? identifier
    : (input.loginId?.trim().toLowerCase() ?? identifier);

  const duplicateCheckConditions: { loginId?: string; email?: string }[] = [
    { loginId: resolvedLoginId },
  ];
  if (resolvedEmail) {
    duplicateCheckConditions.push({ email: resolvedEmail }, { loginId: resolvedEmail });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: duplicateCheckConditions },
    select: { id: true, email: true, loginId: true },
  });
  if (existing) {
    throw new AppError(
      409,
      "DUPLICATE_LOGIN_ID",
      isEmailIdentifier || (resolvedEmail && existing.email === resolvedEmail)
        ? "이미 가입된 이메일입니다. 로그인하거나 SNS 간편 로그인을 이용해 주세요."
        : "이미 사용 중인 아이디입니다.",
    );
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
        loginId: resolvedLoginId,
        email: resolvedEmail,
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
        email: true,
        createdAt: true,
      },
    });

    return { user, recoveryCode, sessionToken, expiresAt };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      throw new AppError(
        409,
        "DUPLICATE_LOGIN_ID",
        isEmailIdentifier ? "이미 가입된 이메일입니다." : "이미 사용 중인 아이디입니다.",
      );
    }
    throw err;
  }
}

/** ACC-06: 이메일 또는 아이디 로그인 (5회 연속 실패 시 10분 잠금, 자동 로그인 옵션) */
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
  const identifier = (input.identifier || input.email || input.loginId || "").trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ loginId: identifier }, { email: identifier }],
    },
  });

  if (!user) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "이메일(또는 아이디)과 비밀번호를 다시 확인해 주세요.",
    );
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

    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "이메일(또는 아이디)과 비밀번호를 다시 확인해 주세요.",
    );
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
    user: {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      createdAt: user.createdAt,
    },
    sessionToken,
    expiresAt,
    rememberMe: input.rememberMe,
  };
}

/**
 * SNS 소셜 로그인 및 동일 이메일 자동 계정 통합 (카카오 · 구글 · 네이버)
 * 1) 이미 연동된 (provider, providerUserId) 계정이 있으면 즉시 해당 계정으로 로그인
 * 2) 동일 이메일로 가입된 기존 계정이 있으면 자동으로 SocialAccount를 연결하고 기존 계정으로 로그인
 * 3) 신규 이메일이면 새 User + SocialAccount를 생성하고 로그인 세션 발급
 */
export async function authenticateWithSocialProfile(
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{
  user: AuthUserSummary;
  sessionToken: string;
  expiresAt: Date;
  rememberMe: boolean;
  isNewUser: boolean;
  autoLinkedByEmail: boolean;
  hasBabyProfile: boolean;
}> {
  const input = socialAuthInputSchema.parse(rawInput);
  const normalizedEmail = input.email.trim().toLowerCase();
  const providerUserId =
    input.providerUserId?.trim() || `${input.provider.toLowerCase()}:${normalizedEmail}`;
  const displayName = input.displayName?.trim() || normalizedEmail.split("@")[0] || null;

  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = buildSessionExpiry(input.rememberMe, now);

  // 1. 이미 해당 SNS 계정이 연동되어 있는지 확인
  const existingSocial = await prisma.socialAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId,
      },
    },
    include: {
      user: {
        select: { id: true, loginId: true, email: true, createdAt: true },
      },
    },
  });

  if (existingSocial) {
    const [, , babyCount] = await Promise.all([
      prisma.session.create({
        data: {
          userId: existingSocial.user.id,
          tokenHash,
          expiresAt,
        },
      }),
      !existingSocial.user.email
        ? prisma.user.update({
            where: { id: existingSocial.user.id },
            data: { email: normalizedEmail },
          })
        : Promise.resolve(null),
      prisma.baby.count({ where: { userId: existingSocial.user.id } }),
    ]);

    return {
      user: {
        ...existingSocial.user,
        email: existingSocial.user.email ?? normalizedEmail,
      },
      sessionToken,
      expiresAt,
      rememberMe: input.rememberMe,
      isNewUser: false,
      autoLinkedByEmail: false,
      hasBabyProfile: babyCount > 0,
    };
  }

  // 2. 동일 이메일을 가진 기존 User가 있는지 확인 (동일 이메일 자동 통합)
  const matchedUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { loginId: normalizedEmail }],
    },
    select: { id: true, loginId: true, email: true, createdAt: true },
  });

  if (matchedUser) {
    await prisma.$transaction([
      prisma.socialAccount.upsert({
        where: {
          userId_provider: {
            userId: matchedUser.id,
            provider: input.provider,
          },
        },
        update: {
          providerUserId,
          email: normalizedEmail,
          displayName,
        },
        create: {
          userId: matchedUser.id,
          provider: input.provider,
          providerUserId,
          email: normalizedEmail,
          displayName,
        },
      }),
      ...(matchedUser.email !== normalizedEmail
        ? [
            prisma.user.update({
              where: { id: matchedUser.id },
              data: { email: normalizedEmail },
            }),
          ]
        : []),
      prisma.session.create({
        data: {
          userId: matchedUser.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const babyCount = await prisma.baby.count({ where: { userId: matchedUser.id } });

    return {
      user: {
        ...matchedUser,
        email: normalizedEmail,
      },
      sessionToken,
      expiresAt,
      rememberMe: input.rememberMe,
      isNewUser: false,
      autoLinkedByEmail: true,
      hasBabyProfile: babyCount > 0,
    };
  }

  // 3. 신규 회원 생성 + SNS 계정 연결
  const generatedSecret = generateSessionToken();
  const recoveryCode = generateRecoveryCode();
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hashSecret(generatedSecret),
    hashSecret(normalizeRecoveryCode(recoveryCode)),
  ]);

  const createdUser = await prisma.user.create({
    data: {
      loginId: normalizedEmail,
      email: normalizedEmail,
      passwordHash,
      recoveryCodeHash,
      socialAccounts: {
        create: {
          provider: input.provider,
          providerUserId,
          email: normalizedEmail,
          displayName,
        },
      },
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
      email: true,
      createdAt: true,
    },
  });

  return {
    user: createdUser,
    sessionToken,
    expiresAt,
    rememberMe: input.rememberMe,
    isNewUser: true,
    autoLinkedByEmail: false,
    hasBabyProfile: false,
  };
}

/** 마이페이지: 현재 로그인 사용자의 SNS 연동 목록 조회 */
export async function listUserSocialAccounts(
  userId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<LinkedSocialAccountView[]> {
  const rows = await prisma.socialAccount.findMany({
    where: { userId },
    orderBy: { connectedAt: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    providerUserId: r.providerUserId,
    email: r.email,
    displayName: r.displayName,
    connectedAt: r.connectedAt.toISOString(),
  }));
}

/** 마이페이지: 로그인 상태에서 SNS 계정 추가 연결 */
export async function linkSocialAccountToUser(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<LinkedSocialAccountView[]> {
  const input = socialAuthInputSchema.parse(rawInput);
  const normalizedEmail = input.email.trim().toLowerCase();
  const providerUserId =
    input.providerUserId?.trim() || `${input.provider.toLowerCase()}:${normalizedEmail}`;
  const displayName = input.displayName?.trim() || normalizedEmail.split("@")[0] || null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // 이미 다른 사용자에게 연결된 SNS 계정인지 확인
  const existingSocial = await prisma.socialAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId,
      },
    },
  });
  if (existingSocial && existingSocial.userId !== userId) {
    throw new AppError(409, "SOCIAL_ALREADY_LINKED", "이미 다른 계정에 연동된 SNS 계정입니다.");
  }

  // 사용자에게 아직 대표 이메일이 없을 때 해당 이메일을 다른 사용자가 쓰고 있지 않으면 자동 반영
  let shouldSetUserEmail = false;
  if (!user.email) {
    const emailOwner = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [{ email: normalizedEmail }, { loginId: normalizedEmail }],
      },
      select: { id: true },
    });
    shouldSetUserEmail = !emailOwner;
  }

  await prisma.$transaction([
    prisma.socialAccount.upsert({
      where: {
        userId_provider: {
          userId,
          provider: input.provider,
        },
      },
      update: {
        providerUserId,
        email: normalizedEmail,
        displayName,
      },
      create: {
        userId,
        provider: input.provider,
        providerUserId,
        email: normalizedEmail,
        displayName,
      },
    }),
    ...(shouldSetUserEmail
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { email: normalizedEmail },
          }),
        ]
      : []),
  ]);

  return listUserSocialAccounts(userId, prisma);
}

/** 마이페이지: SNS 계정 연동 해제 */
export async function unlinkSocialAccountFromUser(
  userId: string,
  providerRaw: string,
  prisma: PrismaClient = getPrisma(),
): Promise<LinkedSocialAccountView[]> {
  const provider = socialProviderSchema.parse(providerRaw.toUpperCase());

  await prisma.socialAccount.deleteMany({
    where: {
      userId,
      provider,
    },
  });

  return listUserSocialAccounts(userId, prisma);
}

/** 마이페이지: 계정 대표 이메일 등록·변경 (기존 아이디 가입 계정 호환) */
export async function updateUserEmail(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<AuthUserSummary> {
  const { email } = updateEmailInputSchema.parse(rawInput);

  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [{ email }, { loginId: email }],
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(409, "DUPLICATE_EMAIL", "이미 다른 계정에서 사용 중인 이메일입니다.");
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { loginId: true },
  });
  if (!current) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const nextLoginId = current.loginId.includes("@") ? email : current.loginId;

  return prisma.user.update({
    where: { id: userId },
    data: {
      email,
      loginId: nextLoginId,
    },
    select: {
      id: true,
      loginId: true,
      email: true,
      createdAt: true,
    },
  });
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
        select: { id: true, loginId: true, email: true, createdAt: true },
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
  const identifier = (input.email || input.loginId || "").trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ loginId: identifier }, { email: identifier }],
    },
  });

  if (!user) {
    throw new AppError(
      400,
      "INVALID_RECOVERY",
      "이메일(또는 아이디)과 복구 코드가 올바르지 않습니다.",
    );
  }

  const normalizedCode = normalizeRecoveryCode(input.recoveryCode);
  const validCode = await verifySecret(user.recoveryCodeHash, normalizedCode);
  if (!validCode) {
    throw new AppError(
      400,
      "INVALID_RECOVERY",
      "이메일(또는 아이디)과 복구 코드가 올바르지 않습니다.",
    );
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

/** ACC-07: 회원 탈퇴 시 모든 데이터(세션, SNS 연동, 아기 프로필 등) 즉시 삭제 */
export async function deleteAccount(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const parsed = deleteAccountInputSchema.parse(rawInput);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      socialAccounts: {
        select: { id: true },
      },
    },
  });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  if (parsed.currentPassword && parsed.currentPassword.trim().length > 0) {
    const valid = await verifySecret(user.passwordHash, parsed.currentPassword);
    if (!valid) {
      throw new AppError(400, "WRONG_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
    }
  } else if (parsed.confirmSocialDelete && user.socialAccounts.length > 0) {
    // SNS 연동 계정은 비밀번호 없이 2단계 탈퇴 확인으로 탈퇴 허용
  } else {
    verifyPasswordInputSchema.parse(rawInput);
  }

  await prisma.user.delete({ where: { id: userId } });
}
