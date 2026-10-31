"use client";

import { type ReactNode, type SelectHTMLAttributes, useId } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
  children: ReactNode;
}

export function Select({
  id,
  label,
  hint,
  error,
  hideLabel = false,
  className = "",
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? `select-${generatedId}`;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  const describedByIds: string[] = [];
  if (hint) describedByIds.push(hintId);
  if (error) describedByIds.push(errorId);

  return (
    <div className="w-full min-w-0">
      {label && (
        <label
          htmlFor={selectId}
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
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds.length > 0 ? describedByIds.join(" ") : undefined}
        className={`${label || hint ? "mt-1.5" : ""} min-h-11 w-full max-w-full truncate rounded-md border bg-white px-3 py-2.5 text-base text-[var(--color-text)] ${
          error
            ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]"
            : "border-[var(--color-border-strong)]"
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
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
