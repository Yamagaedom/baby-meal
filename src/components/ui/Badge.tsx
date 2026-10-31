import type { ReactNode } from "react";

export type BadgeVariant =
  "neutral" | "primary" | "age" | "salt" | "ai" | "rating" | "allergy" | "warning" | "success";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

/* 색상뿐 아니라 텍스트로도 의미를 전달하는 4px 상태 라벨 */
const BADGE_CLASSES: Record<BadgeVariant, string> = {
  neutral:
    "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
  primary:
    "border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]",
  age: "border-[var(--color-secondary-border)] bg-[var(--color-secondary-soft)] text-[var(--color-secondary-text)]",
  salt: "border-[var(--color-info-border)] bg-[var(--color-info-soft)] text-[var(--color-info-text)]",
  ai: "border-[var(--color-ai-border)] bg-[var(--color-ai-soft)] text-[var(--color-ai-text)]",
  rating:
    "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-secondary-text)]",
  allergy:
    "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]",
  warning:
    "border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]",
  success:
    "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-secondary-text)]",
};

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-sm border px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASSES[variant]} ${className}`}
    >
      <span>{children}</span>
    </span>
  );
}
