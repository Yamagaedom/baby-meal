"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PwaProviderAndOfflineBanner } from "@/components/PwaProviderAndOfflineBanner";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { Badge, Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "로그인에 실패했습니다.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PwaProviderAndOfflineBanner />
      <main
        id="main-content"
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8"
      >
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-none sm:p-7">
          <div className="flex items-center gap-2.5">
            <div>
              <Badge variant="primary">12~48개월 유아식·간식 가이드</Badge>
              <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                오늘 뭐 먹지, 아가?
              </h1>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            아기의 생년월일(자동 월령)·무염/저염 단계·알레르기에 맞춘 유아식과 간식 아이디어를 매일
            편안하게 받아보세요.
          </p>

          <div className="mt-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            <p>
              <strong className="text-[var(--color-text)]"> 이메일 + SNS 간편 로그인:</strong>{" "}
              이메일 주소 또는 카카오·구글·네이버 계정으로 간편하게 시작하고 동일 이메일 계정을 자동
              통합할 수 있습니다. (기존 아이디 로그인도 그대로 호환됩니다.)
            </p>
            <p className="mt-1">
              <strong className="text-[var(--color-text)]"> 안전 안내:</strong> AI 생성 레시피는
              사람이 검수하지 않으며 의료적 조언을 대체하지 않습니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div
                id="login-form-error"
                role="alert"
                className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-sm font-semibold text-[var(--color-danger-text)]"
              >
                {error}
              </div>
            )}

            <Input
              id="login-id"
              label="이메일 또는 아이디"
              type="text"
              autoComplete="username"
              required
              aria-describedby={error ? "login-form-error" : undefined}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: mom@example.com 또는 기존 아이디"
            />

            <Input
              id="login-password"
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={error ? "login-form-error" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
            />

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-primary)]"
              />
              <span>로그인 유지 (30일)</span>
            </label>

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <SocialAuthButtons mode="login" defaultEmail={loginId} rememberMe={rememberMe} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4 text-sm">
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
            >
              이메일 / SNS 회원가입
            </Link>
            <Link
              href="/reset-password"
              className="inline-flex min-h-11 items-center font-medium text-[var(--color-text-secondary)] underline underline-offset-4 hover:text-[var(--color-text)]"
            >
              복구 코드로 비밀번호 재설정
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
