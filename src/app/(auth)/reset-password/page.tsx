"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PwaProviderAndOfflineBanner } from "@/components/PwaProviderAndOfflineBanner";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { Badge, Button, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newIssuedCode, setNewIssuedCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmError(null);

    if (newPassword !== newPasswordConfirm) {
      setConfirmError("새 비밀번호와 확인 입력이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          recoveryCode,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "비밀번호 재설정에 실패했습니다.");
        return;
      }

      setNewIssuedCode(data.newRecoveryCode);
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
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8"
      >
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-none sm:p-7">
          <Badge variant="primary">1회용 복구 코드 인증</Badge>
          <h1 className="mt-2 text-xl font-semibold text-[var(--color-text)]">
            복구 코드로 비밀번호 재설정
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            가입한 이메일(또는 아이디)과 16자리 복구 코드로 새 비밀번호를 설정합니다. 사용 즉시 기존
            코드는 폐기되고 새 복구 코드가 발급됩니다.
          </p>

          {newIssuedCode ? (
            <div className="mt-5">
              <RecoveryCodeCard
                loginId={loginId}
                recoveryCode={newIssuedCode}
                confirmLabel="로그인 화면으로 이동"
                onConfirm={() => {
                  router.push("/login");
                }}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div
                  id="reset-form-error"
                  role="alert"
                  className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-sm font-semibold text-[var(--color-danger-text)]"
                >
                  {error}
                </div>
              )}

              <Input
                id="reset-login-id"
                label="이메일 또는 아이디"
                type="text"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="가입한 이메일 또는 아이디 입력"
              />

              <Input
                id="reset-code"
                label="복구 코드"
                type="text"
                required
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="font-mono"
              />

              <Input
                id="reset-new-password"
                label="새 비밀번호 (영문 + 숫자 포함 8~64자)"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                id="reset-new-password-confirm"
                label="새 비밀번호 확인"
                type="password"
                required
                error={confirmError}
                value={newPasswordConfirm}
                onChange={(e) => {
                  setNewPasswordConfirm(e.target.value);
                  if (confirmError) setConfirmError(null);
                }}
              />

              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "재설정 중..." : "비밀번호 재설정"}
              </Button>

              <div className="pt-2 text-center text-sm text-[var(--color-text-secondary)]">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-[var(--color-text)]"
                >
                  로그인으로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
