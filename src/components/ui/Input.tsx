"use client";

import { type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
}

export function Input({
  id,
  label,
  hint,
  error,
  hideLabel = false,
  className = "",
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedByIds: string[] = [];
  if (hint) describedByIds.push(hintId);
  if (error) describedByIds.push(errorId);

  return (
    <div className="w-full min-w-0">
      {label && (
        <label
          htmlFor={inputId}
          className={hideLabel ? "sr-only" : "block text-sm font-semibold text-[var(--color-text)]"}
        >
          {label}
        </label>
      )}
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds.length > 0 ? describedByIds.join(" ") : undefined}
        className={`${label || hint ? "mt-1.5" : ""} min-h-11 w-full max-w-full rounded-md border bg-white px-3.5 py-2.5 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] ${
          error
            ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]"
            : "border-[var(--color-border-strong)] focus:border-[var(--color-primary)]"
        } ${className}`}
        {...rest}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-xs font-semibold text-[var(--color-danger-text)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
