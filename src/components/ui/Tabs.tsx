"use client";

import { useRef } from "react";

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
}

export interface TabsProps<T extends string = string> {
  options: TabOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}

export function Tabs<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % options.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = options.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const target = options[nextIdx];
      if (target) {
        onChange(target.id);
        refs.current[nextIdx]?.focus();
      }
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 border-b border-[var(--color-border)]"
    >
      {options.map((opt, idx) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center border-b-2 px-2 py-3 text-center text-sm leading-snug font-semibold break-keep transition-colors sm:flex-none sm:px-5 sm:text-sm ${
              active
                ? "border-[var(--color-primary)] text-[var(--color-primary-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
