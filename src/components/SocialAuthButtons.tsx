"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { SOCIAL_PROVIDER_META } from "@/features/auth/oauth";
import type { SocialProviderType } from "@/lib/validation";

interface SocialAuthButtonsProps {
  mode: "login" | "signup";
  defaultEmail?: string;
  rememberMe?: boolean;
}

const PROVIDERS: readonly SocialProviderType[] = ["KAKAO", "GOOGLE", "NAVER"] as const;

export function SocialAuthButtons({
  mode,
  defaultEmail = "",
  rememberMe = true,
}: SocialAuthButtonsProps) {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<SocialProviderType | null>(null);
  const [socialEmail, setSocialEmail] = useState("");
  const [socialName, setSocialName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectProvider(provider: SocialProviderType) {
    setError(null);
    if (selectedProvider === provider) {
      setSelectedProvider(null);
      return;
    }
    setSelectedProvider(provider);
    const trimmed = defaultEmail.trim().toLowerCase();
    if (trimmed.includes("@")) {
      setSocialEmail(trimmed);
    } else {
      setSocialEmail(SOCIAL_PROVIDER_META[provider].sampleEmail);
    }
  }

  async function handleSocialSubmit() {
    if (!selectedProvider) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          email: socialEmail.trim().toLowerCase(),
          displayName: socialName.trim() || undefined,
          rememberMe,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "SNS 로그인에 실패했습니다.");
        return;
      }

      router.push(data.redirectTo || "/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const actionVerb = mode === "login" ? "계속하기" : "시작하기";

  return (
    <section aria-label="SNS 간편 연동" className="mt-5">
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-[var(--color-border)]" />
        <span className="mx-3 shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
          또는 SNS 계정으로 간편 {actionVerb}
        </span>
        <div className="flex-grow border-t border-[var(--color-border)]" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const meta = SOCIAL_PROVIDER_META[provider];
          const isSelected = selectedProvider === provider;

          const styleClass =
            provider === "KAKAO"
              ? "border-[#E6CF00] bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]"
              : provider === "GOOGLE"
                ? "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                : "border-[#027A35] bg-[#F2FBF6] text-[#025926] hover:bg-[#E5F7ED]";

          return (
            <button
              key={provider}
              type="button"
              data-testid={`social-btn-${provider.toLowerCase()}`}
              aria-expanded={isSelected}
              onClick={() => handleSelectProvider(provider)}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${styleClass} ${
                isSelected ? "ring-2 ring-[var(--color-primary)] ring-offset-1" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-xs font-bold"
              >
                {provider === "KAKAO" ? "K" : provider === "GOOGLE" ? "G" : "N"}
              </span>
              <span>
                {meta.label}로 {actionVerb}
              </span>
            </button>
          );
        })}
      </div>

      {selectedProvider && (
        <div
          data-testid="social-auth-panel"
          className="mt-3 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {SOCIAL_PROVIDER_META[selectedProvider].label} 계정 연동 · 동일 이메일 자동 통합
            </p>
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="text-xs font-semibold text-[var(--color-text-secondary)] underline hover:text-[var(--color-text)]"
            >
              닫기
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {SOCIAL_PROVIDER_META[selectedProvider].label} 계정의 이메일 주소를 확인해 주세요. 동일
            이메일로 가입된 기존 계정이 있으면 아기 프로필과 식단 데이터가 자동으로 통합됩니다.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-2.5 text-xs font-semibold text-[var(--color-danger-text)]"
            >
              {error}
            </div>
          )}

          <div className="mt-3 space-y-3">
            <Input
              id="social-auth-email"
              label={`${SOCIAL_PROVIDER_META[selectedProvider].label} 계정 이메일`}
              type="email"
              value={socialEmail}
              onChange={(e) => setSocialEmail(e.target.value)}
              placeholder={SOCIAL_PROVIDER_META[selectedProvider].sampleEmail}
            />

            <Input
              id="social-auth-name"
              label="표시 이름 (선택)"
              type="text"
              value={socialName}
              onChange={(e) => setSocialName(e.target.value)}
              placeholder="예: 튼튼이맘"
            />

            <Button
              type="button"
              fullWidth
              data-testid="social-auth-submit"
              disabled={submitting || !socialEmail.trim()}
              onClick={() => void handleSocialSubmit()}
            >
              {submitting
                ? "연동 중..."
                : `${SOCIAL_PROVIDER_META[selectedProvider].label} 계정으로 계속하기`}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
