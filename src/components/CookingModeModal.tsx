"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface CookingStep {
  order: number;
  instruction: string;
  timerSeconds: number | null;
}

interface CookingModeModalProps {
  recipeName: string;
  steps: CookingStep[];
  onClose: () => void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CookingModeModal({ recipeName, steps, onClose }: CookingModeModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [wakeLockState, setWakeLockState] = useState<"active" | "unsupported" | "denied">(
    "unsupported",
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const dialogEl = dialogRef.current;
    const firstBtn = dialogEl?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstBtn?.focus();

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function acquireWakeLock() {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      if (!nav.wakeLock || typeof nav.wakeLock.request !== "function") {
        if (!cancelled) setWakeLockState("unsupported");
        return;
      }

      try {
        sentinel = await nav.wakeLock.request("screen");
        if (!cancelled) setWakeLockState("active");
      } catch {
        if (!cancelled) setWakeLockState("denied");
      }
    }

    void acquireWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
      prevFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" && stepIndex < steps.length - 1) {
        e.preventDefault();
        setStepIndex((i) => i + 1);
        setTimerRunning(false);
        setRemainingSeconds(null);
        return;
      }
      if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault();
        setStepIndex((i) => i - 1);
        setTimerRunning(false);
        setRemainingSeconds(null);
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const items = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, stepIndex, steps.length]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const currentStep = steps[stepIndex] ?? steps[0];

  function goStep(nextIdx: number) {
    setStepIndex(nextIdx);
    setTimerRunning(false);
    setRemainingSeconds(null);
  }

  function handleToggleTimer(defaultSeconds: number) {
    if (timerRunning) {
      setTimerRunning(false);
      return;
    }
    setRemainingSeconds((prev) => (prev && prev > 0 ? prev : defaultSeconds));
    setTimerRunning(true);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (deltaX < -50 && stepIndex < steps.length - 1) {
      goStep(stepIndex + 1);
    } else if (deltaX > 50 && stepIndex > 0) {
      goStep(stepIndex - 1);
    }
  }

  const displaySecs = remainingSeconds ?? currentStep?.timerSeconds ?? 0;
  const mins = Math.floor(displaySecs / 60);
  const secs = displaySecs % 60;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cooking-mode-title"
      data-testid="cooking-mode-dialog"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 m-0! flex flex-col overflow-y-auto bg-[var(--color-cooking)] p-5 text-white sm:p-8"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-between">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div>
            <h2 id="cooking-mode-title" className="text-lg font-semibold sm:text-xl">
              조리 모드 — {recipeName}
            </h2>
            <p
              data-testid="wake-lock-status"
              className="mt-1 text-xs text-[var(--color-cooking-muted)]"
            >
              {wakeLockState === "active"
                ? "✓ 화면 꺼짐 방지(Wake Lock)가 활성화되었습니다. 좌우로 스와이프해 단계를 넘길 수 있어요."
                : " 이 브라우저 환경에서는 화면 자동 꺼짐 방지를 지원하지 않아 안내만 표시됩니다. 좌우 스와이프·방향키로 단계를 넘길 수 있어요."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            조리 모드 닫기
          </button>
        </header>

        <div className="my-8 space-y-6" aria-live="polite">
          <div className="space-y-2">
            <div
              className="text-base font-semibold text-[var(--color-warning-border)]"
              data-testid="cooking-step-indicator"
            >
              단계 {stepIndex + 1} / {steps.length}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-white/15">
              <div
                className="h-full rounded-sm bg-[var(--color-warning-border)] transition-all"
                style={{ width: `${((stepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }}
              />
            </div>
          </div>

          <p
            data-testid="cooking-step-instruction"
            className="text-2xl leading-relaxed font-semibold text-white sm:text-3xl"
          >
            {currentStep?.instruction}
          </p>

          {currentStep?.timerSeconds && (
            <div>
              <button
                type="button"
                onClick={() => handleToggleTimer(currentStep.timerSeconds!)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--color-warning-border)] px-6 py-3 font-mono text-base font-semibold text-[var(--color-text)] hover:bg-[var(--color-warning-hover)]"
              >
                <Icon name="timer" /> {timerRunning ? "타이머 일시정지" : "타이머 시작"} ({mins}:
                {String(secs).padStart(2, "0")})
              </button>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => goStep(stepIndex - 1)}
            className="min-h-12 flex-1 rounded-md border border-white/35 px-4 py-3 text-base font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            ← 이전 단계
          </button>

          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              data-testid="cooking-next-step-btn"
              onClick={() => goStep(stepIndex + 1)}
              className="min-h-12 flex-1 rounded-md bg-[var(--color-primary-soft)] px-4 py-3 text-base font-semibold text-[var(--color-primary-text)] hover:bg-white"
            >
              다음 단계 →
            </button>
          ) : (
            <button
              type="button"
              data-testid="cooking-finish-btn"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-md bg-[var(--color-success-border)] px-4 py-3 text-base font-semibold text-[var(--color-secondary-text)]"
            >
              조리 완료!
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
