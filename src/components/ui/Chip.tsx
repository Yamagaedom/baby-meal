"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
  tone?: "default" | "danger" | "warning";
}

export function Chip({
  selected = false,
  onClick,
  onRemove,
  removeLabel,
  children,
  tone = "default",
}: ChipProps) {
  if (onRemove) {
    const toneClasses =
      tone === "danger"
        ? "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"
        : tone === "warning"
          ? "border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] text-[var(--color-text)]";

    return (
      <span
        className={`inline-flex min-h-11 max-w-full items-center gap-1 rounded-md border pl-3 text-sm font-medium ${toneClasses}`}
      >
        <span className="min-w-0 break-words">{children}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
        >
          <Icon name="close" width="16" height="16" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 max-w-full flex-wrap items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]"
          : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
      }`}
    >
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}
