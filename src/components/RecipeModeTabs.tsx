"use client";

import Link from "next/link";

export interface RecipeModeTabsProps {
  active: "recipes" | "ingredients";
}

export function RecipeModeTabs({ active }: RecipeModeTabsProps) {
  return (
    <nav
      aria-label="레시피 찾기 방식"
      className="grid grid-cols-2 rounded-lg bg-[var(--color-surface-muted)] p-1"
    >
      <Link
        href="/recipes"
        aria-current={active === "recipes" ? "page" : undefined}
        className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors ${
          active === "recipes"
            ? "bg-white text-[var(--color-primary)] shadow-xs"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        }`}
      >
        메뉴로 찾기
      </Link>
      <Link
        href="/ingredients"
        aria-current={active === "ingredients" ? "page" : undefined}
        className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors ${
          active === "ingredients"
            ? "bg-white text-[var(--color-primary)] shadow-xs"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        }`}
      >
        재료로 찾기
      </Link>
    </nav>
  );
}
