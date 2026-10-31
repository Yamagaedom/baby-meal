/**
 * 비밀번호·복구 코드·세션 토큰 암호화 유틸 (ACC-03, ACC-04, ACC-06)
 * - 비밀번호와 복구 코드는 argon2 단방향 해시로만 저장한다 (평문 저장 절대 금지).
 * - 세션 토큰은 쿠키에 원본을 담고 DB에는 SHA-256 해시만 저장한다.
 */
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 문자(0/O, 1/I) 제외

/** 16자리 1회용 복구 코드 생성 (형식: XXXX-XXXX-XXXX-XXXX) — ACC-04 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(16);
  const chars: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    chars.push(RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length]);
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

/** 사용자 입력 복구 코드 정규화 (공백·하이픈 제거 후 대문자화, 재포맷) */
export function normalizeRecoveryCode(input: string): string {
  const cleaned = input.replace(/[-\s]/g, "").toUpperCase();
  if (cleaned.length === 16) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}`;
  }
  return input.trim().toUpperCase();
}

export async function hashSecret(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifySecret(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
