"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { BabyProfileView } from "@/features/profile";
import { SALT_LEVEL_LABELS } from "@/features/recipe/constants-client";
import { purgeUnsafeOfflineFavorites, setOfflineActiveBabyId } from "@/lib/offline-favorites";

interface AppHeaderNavProps {
  loginId: string;
  babies: BabyProfileView[];
  activeBaby: BabyProfileView | null;
}

export const APP_NAV_ITEMS = [
  { href: "/", label: "홈", shortLabel: "홈", icon: "home" },
  { href: "/ingredients", label: "재료로 찾기", shortLabel: "재료", icon: "ingredients" },
  { href: "/recipes", label: "레시피", shortLabel: "레시피", icon: "book" },
  { href: "/logs", label: "기록", shortLabel: "기록", icon: "logs" },
  { href: "/my", label: "마이", shortLabel: "마이", icon: "profile" },
] as const;

function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * 상단 헤더와 데스크톱 메뉴. 작은 화면에서는 하단 메뉴를 사용합니다.
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
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-[1120px] min-w-0 flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-0 items-center text-base font-semibold tracking-tight text-[var(--color-text)]"
        >
          오늘 뭐 먹지, 아가?
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
                    className={`inline-flex min-h-12 items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
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
              className="min-h-11 max-w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-text-secondary)]"
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
          className="border-t border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-5 py-2 text-sm font-medium text-[var(--color-warning-text)]"
        >
          {activeBaby.overMaxAgeNotice}
        </div>
      )}
    </header>
  );
}

/**
 * 모바일·태블릿 한 손 조작 하단 고정 5탭 내비게이션 (< 1024px)
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="하단 주 메뉴"
      className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--color-border)] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 gap-0.5">
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.href === "/ingredients" ? "재료 (재료로 찾기)" : item.label}
                className={`flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-1 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--color-primary)] text-[var(--color-primary-text)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <Icon name={item.icon} />
                <span className="max-w-full">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
