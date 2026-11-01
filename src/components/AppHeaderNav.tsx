"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { BabyProfileView } from "@/features/profile";
import { SALT_LEVEL_LABELS } from "@/features/recipe/constants-client";
import { purgeUnsafeOfflineFavorites, setOfflineActiveBabyId } from "@/lib/offline-favorites";

interface AppHeaderNavProps {
  loginId: string;
  babies: BabyProfileView[];
  activeBaby: BabyProfileView | null;
}

export const APP_NAV_ITEMS: readonly {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
}[] = [
  { href: "/", label: "홈", shortLabel: "홈", icon: "home" },
  { href: "/meal-plan", label: "식단", shortLabel: "식단", icon: "calendar" },
  { href: "/recipes", label: "레시피", shortLabel: "레시피", icon: "book" },
  { href: "/ingredients", label: "재료로 찾기", shortLabel: "재료", icon: "ingredients" },
  { href: "/logs", label: "기록", shortLabel: "기록", icon: "logs" },
  { href: "/my", label: "마이", shortLabel: "마이", icon: "profile" },
] as const;

export const BOTTOM_NAV_ITEMS: readonly {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
}[] = [
  { href: "/", label: "홈", shortLabel: "홈", icon: "home" },
  { href: "/meal-plan", label: "식단", shortLabel: "식단", icon: "calendar" },
  { href: "/recipes", label: "레시피", shortLabel: "레시피", icon: "book" },
  { href: "/ingredients", label: "재료로 찾기", shortLabel: "재료", icon: "ingredients" },
  { href: "/my", label: "마이", shortLabel: "마이", icon: "profile" },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/recipes" && pathname === "/recipes") return true;
  if (href === "/ingredients" && pathname.startsWith("/ingredients")) return true;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * 상단 헤더와 데스크톱 메뉴. 작은 화면에서는 하단 네비게이션 바(BottomNav)를 사용합니다.
 */
export function AppHeaderNav({ babies, activeBaby }: AppHeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // 활성 아기 ID 동기화 및 알레르기(확정·의심·직접 식재료)와 충돌하는 오프라인 즐겨찾기 캐시 자동 정화
  useEffect(() => {
    setOfflineActiveBabyId(activeBaby?.id ?? null);
    if (!activeBaby) return;
    const excludedAllergenCodes = Array.from(
      new Set(
        activeBaby.allergies.flatMap((a) => [
          ...(a.allergenType ? [a.allergenType] : []),
          ...(a.derivedAllergens ?? []),
        ]),
      ),
    );
    const excludedIngredientIds = activeBaby.allergies
      .map((a) => a.ingredientId)
      .filter((id): id is string => Boolean(id));
    const excludedIngredientNames = activeBaby.allergies
      .map((a) => a.ingredientName)
      .filter((name): name is string => Boolean(name));
    purgeUnsafeOfflineFavorites(activeBaby.id, {
      excludedAllergenCodes,
      excludedIngredientIds,
      excludedIngredientNames,
    });
  }, [activeBaby]);

  async function handleSwitchBaby(nextBabyId: string) {
    setSwitching(true);
    try {
      const res = await fetch("/api/babies/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ babyId: nextBabyId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] min-w-0 flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-0 items-center text-base font-bold tracking-tight text-[var(--color-text)] hover:opacity-90"
        >
          <span className="mr-2 text-sm font-black text-[var(--color-primary)]">●</span>
          <span>오늘 뭐 먹지, 아가?</span>
        </Link>
        <nav aria-label="주 메뉴" className="hidden flex-1 lg:block">
          <ul className="flex flex-wrap items-center gap-1">
            {APP_NAV_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-semibold transition-all ${
                      active
                        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {babies.length > 0 && activeBaby && (
          <div className="ml-auto max-w-full min-w-0">
            <label htmlFor="active-baby-select" className="sr-only">
              현재 아기 프로필 선택
            </label>
            <select
              id="active-baby-select"
              aria-label="현재 아기 프로필 선택"
              disabled={switching}
              value={activeBaby.id}
              onChange={(e) => void handleSwitchBaby(e.target.value)}
              className="min-h-10 max-w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] shadow-xs transition-colors hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              {babies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName} ({b.currentAgeMonth}개월 · {b.ageStageLabel} ·{" "}
                  {SALT_LEVEL_LABELS[b.saltLevel]})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {activeBaby?.isOverMaxAge && activeBaby.overMaxAgeNotice && (
        <div
          role="status"
          className="border-t border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-5 py-2 text-xs font-semibold text-[var(--color-warning-text)] sm:text-sm"
        >
          {activeBaby.overMaxAgeNotice}
        </div>
      )}
    </header>
  );
}

/**
 * 모바일·태블릿 한 손 조작 하단 고정 5탭 내비게이션 바 (< 1024px)
 * 노션 UI 레퍼런스: Bottom Navigation / Tab Bar (하단 탭바)
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="하단 주 메뉴"
      className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-md px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.href === "/ingredients" ? "재료 (재료로 찾기)" : item.label}
                className={`group flex min-h-[52px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 transition-all ${
                  active
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                <div
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-all ${
                    active
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] scale-105"
                      : "text-[var(--color-text-secondary)] group-hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  <Icon name={item.icon} width={20} height={20} />
                </div>
                <span
                  className={`text-[11px] leading-tight transition-colors ${
                    active ? "font-bold text-[var(--color-primary)]" : "font-medium"
                  }`}
                >
                  {item.shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
