"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center bg-[var(--color-canvas)] px-4 py-12 text-[var(--color-text)]">
        <main
          id="main-content"
          role="alert"
          className="w-full max-w-md space-y-4 rounded-lg border border-[var(--color-danger-border)] bg-white p-6 text-center shadow-none"
        >
          <p className="text-3xl" aria-hidden="true"></p>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            일시적인 오류가 발생했어요
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            화면을 표시하는 중 예기치 않은 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              홈으로 이동
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
