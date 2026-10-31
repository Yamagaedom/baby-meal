/**
 * 가입 API 속도 제한 (PRD 7장 보안, 11장 다중 계정 우회 방지)
 */
import { AppError } from "@/lib/http/errors";
import { SIGNUP_RATE_MAX_ATTEMPTS, SIGNUP_RATE_WINDOW_MS } from "./constants";

const attemptsByKey = new Map<string, number[]>();

export function checkSignupRateLimit(
  clientKey: string,
  nowMs: number = Date.now(),
  maxAttempts: number = SIGNUP_RATE_MAX_ATTEMPTS,
): void {
  const windowStart = nowMs - SIGNUP_RATE_WINDOW_MS;
  const existing = attemptsByKey.get(clientKey) ?? [];
  const active = existing.filter((ts) => ts > windowStart);

  if (active.length >= maxAttempts) {
    attemptsByKey.set(clientKey, active);
    throw new AppError(
      429,
      "RATE_LIMITED",
      "가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  active.push(nowMs);
  attemptsByKey.set(clientKey, active);
}

export function resetSignupRateLimit(): void {
  attemptsByKey.clear();
}
