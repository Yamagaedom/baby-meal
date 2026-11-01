"use client";

import { useId, useState, type ReactNode } from "react";

export interface AccordionItem {
  id: string;
  title: string;
  badge?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
}

export function Accordion({ items, allowMultiple = true, className = "" }: AccordionProps) {
  const instanceId = useId();
  const [openIds, setOpenIds] = useState<string[]>(() =>
    items.filter((item) => item.defaultOpen).map((item) => item.id),
  );

  function toggleItem(id: string) {
    setOpenIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((openId) => openId !== id);
      }
      return allowMultiple ? [...prev, id] : [id];
    });
  }

  return (
    <div
      className={`divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-none ${className}`}
    >
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const headerId = `${instanceId}-header-${item.id}`;
        const panelId = `${instanceId}-panel-${item.id}`;

        return (
          <div key={item.id} className="transition-colors">
            <h3>
              <button
                type="button"
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(item.id)}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {item.icon && (
                    <span className="shrink-0 text-base" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0">{item.title}</span>
                  {item.badge && <span className="shrink-0">{item.badge}</span>}
                </span>
                <span
                  className={`shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-[var(--color-primary)]" : ""
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
              className={`px-5 pt-1 pb-4 text-sm leading-relaxed text-[var(--color-text-secondary)] transition-all ${
                isOpen ? "animate-fadeIn block" : "hidden"
              }`}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
