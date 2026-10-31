"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PwaProviderAndOfflineBanner } from "@/components/PwaProviderAndOfflineBanner";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { Badge, Button, Input } from "@/components/ui";

const INTRO_CARDS = [
  {
    title: "월령·간 단계 맞춤",
    desc: "12~48개월 아기 식감과 무염·저염 기준에 맞춰 추천해요.",
  },
  {
    title: "냉장고 재료 + AI 레시피",
    desc: "집에 있는 재료로 바로 만들 수 있는 메뉴를 찾아드려요.",
  },
  {
    title: "개인정보 제로 계정",
    desc: "실명·연락처·생년월일 없이 ID와 비밀번호만 사용해요.",
  },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreeIrrecoverable, setAgreeIrrecoverable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmError(null);

    if (password !== passwordConfirm) {
      setConfirmError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          password,
          agreeIrrecoverable,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "회원가입에 실패했습니다.");
        return;
      }

      setIssuedRecoveryCode(data.recoveryCode);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PwaProviderAndOfflineBanner />
      <main
        id="main-content"
        className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8"
      >
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-none sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="primary">
              {issuedRecoveryCode ? "2 / 3단계 · 복구 코드 보관" : "1 / 3단계 · 간편 가입"}
            </Badge>
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              무료 · 개인정보 미수집
            </span>
          </div>

          <h1 className="mt-2.5 text-xl font-semibold text-[var(--color-text)]">회원가입</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            개인정보(이메일·전화번호·이름·생년월일) 없이 아이디와 비밀번호만으로 바로 이용할 수
            있습니다.
          </p>

          {!issuedRecoveryCode && (
            <section
              aria-label="서비스 핵심 안내"
              className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {INTRO_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs"
                >
                  <p className="font-semibold text-[var(--color-text)]">{card.title}</p>
                  <p className="mt-1 leading-relaxed text-[var(--color-text-secondary)]">
                    {card.desc}
                  </p>
                </div>
              ))}
            </section>
          )}

          {issuedRecoveryCode ? (
            <div className="mt-5">
              <RecoveryCodeCard
                loginId={loginId}
                recoveryCode={issuedRecoveryCode}
                confirmLabel="다음 (아기 프로필 등록)"
                onConfirm={() => {
                  router.push("/onboarding");
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div
                  id="signup-form-error"
                  role="alert"
                  className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-sm font-semibold text-[var(--color-danger-text)]"
                >
                  {error}
                </div>
              )}

              <Input
                id="signup-login-id"
                label="아이디 (영문 소문자·숫자 4~20자)"
                hint="개인정보 보호를 위해 실명·이메일·전화번호를 아이디로 사용하지 마세요."
                type="text"
                autoComplete="username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="예: happymom24"
              />

              <Input
                id="signup-password"
                label="비밀번호 (영문 + 숫자 포함 8~64자)"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="영문과 숫자를 함께 입력해 주세요"
              />

              <Input
                id="signup-password-confirm"
                label="비밀번호 확인"
                type="password"
                autoComplete="new-password"
                required
                error={confirmError}
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value);
                  if (confirmError) setConfirmError(null);
                }}
                placeholder="비밀번호를 한 번 더 입력해 주세요"
              />

              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5 text-xs leading-relaxed text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={agreeIrrecoverable}
                  onChange={(e) => setAgreeIrrecoverable(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span>
                  이메일·전화번호를 수집하지 않으므로, 아이디·비밀번호와 복구 코드를 모두 분실하면
                  계정을 복구할 수 없음에 동의합니다. (필수)
                </span>
              </label>

              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "가입 처리 중..." : "회원가입 및 복구 코드 발급"}
              </Button>

              <div className="pt-2 text-center text-sm text-[var(--color-text-secondary)]">
                이미 계정이 있으신가요?{" "}
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
                >
                  로그인
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
