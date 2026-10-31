"use client";

import Link from "next/link";
import { ErrorState } from "@/components/ui";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 py-6">
      <ErrorState
        title="인증 화면을 불러오지 못했어요"
        message="네트워크 상태를 확인한 뒤 잠시 후 다시 시도해 주세요."
        onRetry={reset}
      />
      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
        >
          로그인 화면으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
