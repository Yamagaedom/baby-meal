"use client";

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  label?: string;
  compact?: boolean;
}

/**
 * 1~5회분 분량 스테퍼 (SRV-01~05)
 * - 빠른 1~5회분 선택 버튼(기존 E2E data-testid 호환) + 키보드·터치 친화형 −/+ 조절 + aria-live 음성 안내
 */
export function Stepper({
  value,
  min = 1,
  max = 5,
  onChange,
  label = "조리 분량 선택",
  compact = false,
}: StepperProps) {
  const values = Array.from({ length: max - min + 1 }, (_, idx) => min + idx);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="조리 분량 1회분 줄이기"
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - 1))}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-white text-lg font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:border-[var(--color-disabled-border)] disabled:bg-[var(--color-disabled)] disabled:text-[var(--color-text-muted)]"
          >
            −
          </button>

          {compact ? (
            <span className="min-w-14 text-center text-sm font-semibold">{value}회분</span>
          ) : (
            values.map((n) => {
              const active = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  data-testid={`serving-btn-${n}`}
                  aria-pressed={active}
                  onClick={() => onChange(n)}
                  className={`min-h-11 min-w-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  {n}회분
                </button>
              );
            })
          )}

          <button
            type="button"
            aria-label="조리 분량 1회분 늘리기"
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + 1))}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-white text-lg font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:border-[var(--color-disabled-border)] disabled:bg-[var(--color-disabled)] disabled:text-[var(--color-text-muted)]"
          >
            +
          </button>
        </div>

        <span
          role="status"
          aria-live="polite"
          className={compact ? "sr-only" : "text-xs font-semibold text-[var(--color-primary-text)]"}
        >
          현재 {value}회분 기준으로 재료 분량이 계산되었습니다
        </span>
      </div>
    </div>
  );
}
