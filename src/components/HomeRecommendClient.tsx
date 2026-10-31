"use client";

import Link from "next/link";
import { useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { Badge, Button, EmptyState, ErrorState, RecipeCardSkeleton, Tabs } from "@/components/ui";
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
  const [viewTab, setViewTab] = useState<"all" | "meal" | "snack">("all");
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
    <div className="space-y-10">
      <section className="pt-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
              {baby.displayName}의 오늘 추천 메뉴
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {baby.currentAgeMonth}개월 · {baby.ageStageLabel} ·{" "}
              {SALT_LEVEL_LABELS[baby.saltLevel]} · 권장 식감: {baby.textureGuide}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/ingredients"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
            >
              냉장고 재료로 찾기
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshRecommendations}
              disabled={loading}
            >
              <span>{loading ? "불러오는 중..." : "다른 메뉴 보기"}</span>
            </Button>
          </div>
        </div>

        {baby.allergies.length > 0 && (
          <div
            data-testid="active-allergy-bar"
            className="mt-5 border-b border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-secondary)]"
          >
            제외 중인 알레르기·주의 식재료:{" "}
            {baby.allergies
              .map((a) => `${a.label}${a.status === "SUSPECTED" ? "(의심)" : "(확정)"}`)
              .join(", ")}
          </div>
        )}

        <div className="mt-4">
          <Tabs
            ariaLabel="추천 메뉴 분류 보기"
            value={viewTab}
            onChange={setViewTab}
            options={[
              { id: "all", label: "전체 추천" },
              { id: "meal", label: "식사만" },
              { id: "snack", label: "간식만" },
            ]}
          />
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={handleRefreshRecommendations} />}

      {loading ? (
        <RecipeCardSkeleton count={4} />
      ) : (
        <>
          {(viewTab === "all" || viewTab === "meal") && (
            <section aria-labelledby="today-meals-heading" className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2
                  id="today-meals-heading"
                  className="text-xl font-semibold text-[var(--color-text)]"
                >
                  오늘의 식사 추천
                </h2>
                <Link
                  href="/recipes"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-primary-text)] underline-offset-4 hover:underline"
                >
                  전체 레시피 보기 →
                </Link>
              </div>

              {!hasAnyMeal ? (
                <EmptyState
                  title="현재 조건에 맞는 식사 레시피가 없어요"
                  description="전체 레시피 탭에서 다른 연령·간 단계도 안전하게 살펴보세요."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          )}

          {(viewTab === "all" || viewTab === "snack") && (
            <section aria-labelledby="today-snacks-heading" className="space-y-3.5">
              <h2
                id="today-snacks-heading"
                className="text-xl font-semibold text-[var(--color-text)]"
              >
                오늘의 간식 추천
              </h2>

              {data.snacks.length === 0 ? (
                <EmptyState
                  title="현재 조건에 맞는 간식 레시피가 없어요"
                  description="냉장고 재료를 선택해 맞춤 간식 레시피를 찾아보세요."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.snacks.map((snack) => (
                    <RecipeCard
                      key={snack.id}
                      babyId={baby.id}
                      profileSaltLevel={baby.saltLevel}
                      recipe={snack}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* PRD 5장 IA: 홈 화면 최근 잘 먹은 메뉴 섹션 */}
      <section
        aria-labelledby="recent-good-heading"
        className="border-t border-[var(--color-border)] pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="recent-good-heading" className="text-xl font-semibold text-[var(--color-text)]">
              {withParticle(baby.displayName, "이", "가")} 잘 먹은 메뉴
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              먹었어요 기록에서 좋은 반응을 남긴 레시피입니다.
            </p>
          </div>
          <Link
            href="/logs"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
          >
            전체 기록 보기 →
          </Link>
        </div>

        {recentGoodMenus.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-secondary)]">
            아직 기록된 &ldquo;잘 먹었어요&rdquo; 메뉴가 없어요. 요리 후 레시피 상세 화면에서 아기
            반응을 남겨보세요!
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {recentGoodMenus.map((menu) => (
              <li key={menu.recipeId}>
                <Link
                  href={`/recipes/${menu.recipeId}`}
                  className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40"
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
