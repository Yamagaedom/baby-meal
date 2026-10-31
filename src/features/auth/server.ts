/**
 * Next.js 서버 쿠키/세션 헬퍼 (ACC-01, ACC-06)
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/http/errors";
import { ACTIVE_BABY_COOKIE_NAME, SESSION_COOKIE_NAME } from "./constants";
import { type AuthUserSummary, getAuthenticatedUser } from "./service";

export async function getRawSessionTokenFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getSessionUserFromCookies(): Promise<AuthUserSummary | null> {
  const token = await getRawSessionTokenFromCookies();
  return getAuthenticatedUser(token);
}

/** API 라우트에서 인증 강제 (미로그인 시 401 AppError) */
export async function requireApiUser(): Promise<AuthUserSummary> {
  const user = await getSessionUserFromCookies();
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  return user;
}

/** 서버 컴포넌트에서 인증 강제 (미로그인 시 /login 이동) */
export async function requirePageUser(): Promise<AuthUserSummary> {
  const user = await getSessionUserFromCookies();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
  rememberMe: boolean,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(rememberMe ? { expires: expiresAt } : {}),
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(ACTIVE_BABY_COOKIE_NAME);
}

export async function getActiveBabyIdCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_BABY_COOKIE_NAME)?.value;
}

export async function setActiveBabyIdCookie(babyId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE_NAME, babyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
