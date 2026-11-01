import Link from "next/link";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="브레드크럼 네비게이션" className={`flex w-full min-w-0 items-center overflow-hidden text-xs text-[var(--color-text-secondary)] ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5 min-w-0 w-full">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={idx} className="inline-flex items-center gap-1.5 min-w-0">
              {idx > 0 && (
                <span className="text-[var(--color-border-strong)] select-none shrink-0" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`truncate max-w-[200px] sm:max-w-xs ${
                    isLast ? "font-semibold text-[var(--color-text)]" : ""
                  }`}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 hover:text-[var(--color-text)] hover:underline underline-offset-4 transition-colors"
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
