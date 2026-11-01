"use client";

import { useEffect, type ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 백드롭 오버레이 (딤) */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 바텀 시트 컨테이너 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottom-sheet-title" : undefined}
        className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-[var(--color-border)] bg-white shadow-2xl transition-transform animate-slideUp"
      >
        {/* 드래그 핸들 바 */}
        <div className="flex w-full justify-center pt-3 pb-1" onClick={onClose}>
          <div className="h-1.5 w-10 rounded-full bg-[var(--color-border-strong)]" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          {title ? (
            <h2 id="bottom-sheet-title" className="text-base font-bold text-[var(--color-text)]">
              {title}
            </h2>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* 푸터 영역 (액션 버튼) */}
        {footer && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] px-5 py-3 pb-[max(env(safe-area-inset-bottom),14px)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
