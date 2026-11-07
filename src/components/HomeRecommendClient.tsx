"use client";

import Link from "next/link";
import { useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { Badge, Button, EmptyState, ErrorState, RecipeCardSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { BabyProfileView } from "@/features/profile";
import type { RecipeCardView } from "@/features/recipe";
import { SALT_LEVEL_LABELS } from "@/features/recipe/constants-client";
import { withParticle } from "@/lib/presentation";

interface TodayData {
  meals: {
    breakfast: RecipeCardView | null;
    lunch: RecipeCardView | null;
    dinner: RecipeCardView | null;
    extraMeals: RecipeCardView[];
  };
  snacks: RecipeCardView[];
}

interface RecentGoodMenu {
  recipeId: string;
  recipeName: string;
  goodCount: number;
  totalCount: number;
}

interface HomeRecommendClientProps {
  baby: BabyProfileView;
  initialData: TodayData;
  recentGoodMenus?: RecentGoodMenu[];
}

export function HomeRecommendClient({
  baby,
  initialData,
  recentGoodMenus = [],
}: HomeRecommendClientProps) {
  const [data, setData] = useState<TodayData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefreshRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const nextSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await fetch(
        `/api/recommend/today?babyId=${encodeURIComponent(baby.id)}&seed=${encodeURIComponent(nextSeed)}`,
      );
      if (!res.ok) {
        setError("추천 메뉴를 새로 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const json = await res.json();
      setData({ meals: json.meals, snacks: json.snacks });
    } catch {
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const slotEntries: { label: string; recipe: RecipeCardView | null }[] = [
    { label: "아침 식사", recipe: data.meals.breakfast },
    { label: "점심 식사", recipe: data.meals.lunch },
    { label: "저녁 식사", recipe: data.meals.dinner },
  ];
  const hasAnyMeal = slotEntries.some((s) => s.recipe !== null);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[26px]">
              {baby.displayName}의 오늘 추천 메뉴
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">
              {baby.currentAgeMonth}개월 · {baby.ageStageLabel} ·{" "}
              {SALT_LEVEL_LABELS[baby.saltLevel]}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshRecommendations}
            disabled={loading}
            className="shrink-0 px-2.5 text-xs font-semibold text-[var(--color-primary-text)]"
          >
            <Icon name="refresh" width={15} height={15} />
            <span>{loading ? "변경 중" : "다른 메뉴"}</span>
          </Button>
        </div>

        {baby.allergies.length > 0 && (
          <div
            data-testid="active-allergy-bar"
            className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]"
          >
            제외 중:{" "}
            {baby.allergies
              .map((a) => `${a.label}${a.status === "SUSPECTED" ? "(의심)" : ""}`)
              .join(", ")}
          </div>
        )}
      </section>

      {error && <ErrorState message={error} onRetry={handleRefreshRecommendations} />}

      {loading ? (
        <RecipeCardSkeleton count={3} />
      ) : (
        <>
          <section aria-labelledby="today-meals-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="today-meals-heading"
                className="text-lg font-semibold text-[var(--color-text)]"
              >
                오늘의 식사 추천
              </h2>
              <Link
                href="/recipes"
                className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-[var(--color-primary-text)] hover:underline"
              >
                전체 보기
              </Link>
            </div>

            {!hasAnyMeal ? (
              <EmptyState
                title="현재 조건에 맞는 식사 레시피가 없어요"
                description="레시피 탭에서 다른 연령·간 단계도 안전하게 살펴보세요."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {slotEntries.map(
                  (slot) =>
                    slot.recipe && (
                      <RecipeCard
                        key={slot.recipe.id}
                        babyId={baby.id}
                        profileSaltLevel={baby.saltLevel}
                        recipe={slot.recipe}
                        extraBadge={slot.label}
                      />
                    ),
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="today-snacks-heading" className="space-y-3">
            <h2
              id="today-snacks-heading"
              className="text-lg font-semibold text-[var(--color-text)]"
            >
              오늘의 간식 추천
            </h2>

            {data.snacks.length === 0 ? (
              <EmptyState
                title="현재 조건에 맞는 간식 레시피가 없어요"
                description="레시피 탭의 재료로 찾기에서 맞춤 간식을 찾아보세요."
              />
            ) : (
              <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-2 md:gap-3.5 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
                {data.snacks.map((snack) => (
                  <div
                    key={snack.id}
                    className="w-[min(272px,calc(100vw-3.25rem))] shrink-0 snap-start md:w-auto md:shrink"
                  >
                    <RecipeCard babyId={baby.id} profileSaltLevel={baby.saltLevel} recipe={snack} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 최근 잘 먹은 메뉴 섹션 */}
      <section
        aria-labelledby="recent-good-heading"
        className="border-t border-[var(--color-border)] pt-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recent-good-heading" className="text-lg font-semibold text-[var(--color-text)]">
            {withParticle(baby.displayName, "이", "가")} 잘 먹은 메뉴
          </h2>
          <Link
            href="/logs"
            className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-[var(--color-primary-text)] hover:underline"
          >
            전체 기록
          </Link>
        </div>

        {recentGoodMenus.length === 0 ? (
          <p className="mt-2.5 rounded-lg bg-[var(--color-surface-muted)] p-3.5 text-xs text-[var(--color-text-secondary)] sm:text-sm">
            아직 기록된 메뉴가 없어요. 요리 후 상세 화면에서 아기 반응을 남겨보세요.
          </p>
        ) : (
          <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentGoodMenus.slice(0, 3).map((menu) => (
              <li key={menu.recipeId}>
                <Link
                  href={`/recipes/${menu.recipeId}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3.5 py-2 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40"
                >
                  <span className="truncate">{menu.recipeName}</span>
                  <Badge variant="rating">잘 먹음 {menu.goodCount}회</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
