"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PwaProviderAndOfflineBanner } from "@/components/PwaProviderAndOfflineBanner";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { Badge, Button, Input } from "@/components/ui";

const INTRO_CARDS = [
  {
    title: "생년월일·월령 자동 맞춤",
    desc: "생년월일만 넣으면 12~48개월 월령·식감·염분 단계가 자동 반영돼요.",
  },
  {
    title: "냉장고 재료 + AI 레시피",
    desc: "집에 있는 재료로 바로 만들 수 있는 메뉴를 찾아드려요.",
  },
  {
    title: "이메일 · SNS 간편 연동",
    desc: "이메일 가입 후 카카오·구글·네이버 SNS 로그인을 자유롭게 연결해요.",
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
      const trimmed = loginId.trim();
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: trimmed,
          ...(trimmed.includes("@") ? { email: trimmed } : {}),
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
              {issuedRecoveryCode ? "2 / 3단계 · 복구 코드 보관" : "1 / 3단계 · 이메일·SNS 가입"}
            </Badge>
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              무료 · SNS 연동 지원
            </span>
          </div>

          <h1 className="mt-2.5 text-xl font-semibold text-[var(--color-text)]">회원가입</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            이메일 주소(권장)나 아이디로 가입하거나, 카카오·구글·네이버 계정으로 바로 시작할 수
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
            <>
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
                  label="아이디 (이메일 주소 또는 영문 아이디)"
                  hint="이메일(예: mom@example.com)로 가입하면 카카오·구글·네이버 SNS 로그인과 동일 이메일로 자동 통합됩니다."
                  type="text"
                  autoComplete="username"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="예: mom@example.com 또는 happymom24"
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
                    비밀번호 분실 시 재설정에 사용할 1회용 복구 코드 발급 안내를 확인했으며, 서비스
                    이용에 동의합니다. (필수)
                  </span>
                </label>

                <Button type="submit" fullWidth disabled={submitting}>
                  {submitting ? "가입 처리 중..." : "회원가입 및 복구 코드 발급"}
                </Button>
              </form>

              <SocialAuthButtons mode="signup" defaultEmail={loginId} />

              <div className="mt-5 pt-2 text-center text-sm text-[var(--color-text-secondary)]">
                이미 계정이 있으신가요?{" "}
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
                >
                  로그인
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
