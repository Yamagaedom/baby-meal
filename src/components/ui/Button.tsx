"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white border border-transparent hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-text)]",
  secondary:
    "bg-[var(--color-secondary)] text-white border border-transparent hover:bg-[var(--color-secondary-hover)] active:bg-[var(--color-secondary-active)]",
  outline:
    "bg-white text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-pressed)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-danger)] text-white border border-transparent hover:bg-[var(--color-danger-text)] active:bg-[var(--color-danger-active)]",
};

/* 모든 버튼은 모바일 한 손 터치 기준 최소 높이 44px(min-h-11) 보장 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 py-2 text-sm rounded-md",
  md: "min-h-11 px-4 py-2.5 text-base rounded-md",
  lg: "min-h-12 px-5 py-3 text-base rounded-md",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex max-w-full flex-wrap items-center justify-center gap-2 text-center font-medium transition-colors select-none disabled:cursor-not-allowed disabled:border-[var(--color-disabled-border)] disabled:bg-[var(--color-disabled)] disabled:text-[var(--color-text-muted)] ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
