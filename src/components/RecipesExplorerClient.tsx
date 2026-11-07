"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OfflineRecipeReader } from "@/components/PwaProviderAndOfflineBanner";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeModeTabs } from "@/components/RecipeModeTabs";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  RecipeCardSkeleton,
  Select,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RecipeCardView, RecipeDetailView } from "@/features/recipe";
import {
  AGE_STAGE_LABELS,
  COMMON_TOOLS,
  INGREDIENT_GROUP_LABELS,
  SALT_LEVEL_LABELS,
} from "@/features/recipe/constants-client";
import { AGE_STAGE_VALUES, INGREDIENT_GROUPS, SALT_LEVELS } from "@/lib/domain/types";
import { listOfflineFavorites, pruneInactiveOfflineFavorites } from "@/lib/offline-favorites";

interface RecipesExplorerClientProps {
  babyId: string;
  babySaltLevel: import("@/lib/domain/types").SaltLevel;
  initialItems: RecipeCardView[];
}

export function RecipesExplorerClient({
  babyId,
  babySaltLevel,
  initialItems,
}: RecipesExplorerClientProps) {
  const [items, setItems] = useState<RecipeCardView[]>(initialItems);
  const [visibleCount, setVisibleCount] = useState(12);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [stage, setStage] = useState("");
  const [saltLevel, setSaltLevel] = useState("");
  const [maxCookMinutes, setMaxCookMinutes] = useState("");
  const [tool, setTool] = useState("");
  const [ingredientGroup, setIngredientGroup] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sourceType, setSourceType] = useState<"ALL" | "SEED" | "AI">("ALL");
  const [sortBy, setSortBy] = useState<"QUALITY" | "POPULAR" | "RATING" | "LATEST">("QUALITY");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineFallbackMode, setOfflineFallbackMode] = useState(false);
  const [offlineReaderRecipe, setOfflineReaderRecipe] = useState<RecipeDetailView | null>(null);

  const isFirstRender = useRef(true);

  const sheetFilterCount = [
    category,
    stage,
    saltLevel,
    maxCookMinutes,
    tool,
    ingredientGroup,
    favoritesOnly ? "fav" : "",
    sourceType !== "ALL" ? sourceType : "",
  ].filter(Boolean).length;

  const hasAnyActiveFilter = sheetFilterCount > 0 || Boolean(query.trim()) || sortBy !== "QUALITY";

  async function applyFilters(
    overrides?: Partial<{
      category: string;
      stage: string;
      saltLevel: string;
      maxCookMinutes: string;
      tool: string;
      ingredientGroup: string;
      favoritesOnly: boolean;
      sourceType: "ALL" | "SEED" | "AI";
      sortBy: "QUALITY" | "POPULAR" | "RATING" | "LATEST";
      query: string;
    }>,
  ) {
    const next = {
      category: overrides?.category ?? category,
      stage: overrides?.stage ?? stage,
      saltLevel: overrides?.saltLevel ?? saltLevel,
      maxCookMinutes: overrides?.maxCookMinutes ?? maxCookMinutes,
      tool: overrides?.tool ?? tool,
      ingredientGroup: overrides?.ingredientGroup ?? ingredientGroup,
      favoritesOnly: overrides?.favoritesOnly ?? favoritesOnly,
      sourceType: overrides?.sourceType ?? sourceType,
      sortBy: overrides?.sortBy ?? sortBy,
      query: overrides?.query ?? query,
    };

    const params = new URLSearchParams({ babyId });
    if (next.category) params.set("category", next.category);
    if (next.stage) params.set("stage", next.stage);
    if (next.saltLevel) params.set("saltLevel", next.saltLevel);
    if (next.maxCookMinutes) params.set("maxCookMinutes", next.maxCookMinutes);
    if (next.tool) params.set("tool", next.tool);
    if (next.ingredientGroup) params.set("ingredientGroup", next.ingredientGroup);
    if (next.favoritesOnly) params.set("favoritesOnly", "true");
    if (next.sourceType && next.sourceType !== "ALL") params.set("sourceType", next.sourceType);
    if (next.sortBy && next.sortBy !== "QUALITY") params.set("sortBy", next.sortBy);
    if (next.query.trim()) params.set("q", next.query.trim());

    setLoading(true);
    setError(null);
    setOfflineFallbackMode(false);
    try {
      const res = await fetch(`/api/recipes?${params.toString()}`);
      if (!res.ok) {
        if (next.favoritesOnly) {
          const cached = listOfflineFavorites(babyId).map((e) => e.recipe);
          setItems(cached);
          setVisibleCount(12);
          setOfflineFallbackMode(true);
          return;
        }
        setError("레시피 목록을 불러오지 못했어요.");
        return;
      }
      const data = await res.json();
      const fetchedItems: RecipeCardView[] = data.items ?? [];
      setItems(fetchedItems);
      setVisibleCount(12);
      if (
        next.favoritesOnly &&
        !next.category &&
        !next.stage &&
        !next.saltLevel &&
        !next.maxCookMinutes &&
        !next.tool &&
        !next.ingredientGroup &&
        !next.query.trim()
      ) {
        pruneInactiveOfflineFavorites(
          babyId,
          fetchedItems.map((item) => item.id),
        );
      }
    } catch {
      const cached = listOfflineFavorites(babyId).map((e) => e.recipe);
      if (next.favoritesOnly || cached.length > 0) {
        setItems(cached);
        setVisibleCount(12);
        setOfflineFallbackMode(true);
      } else {
        setError("오프라인 상태입니다. 인터넷 연결을 확인해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  // 검색어 입력 시 300ms 디바운스 자동 검색 (별도 '검색' 버튼 불필요)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void applyFilters({ query });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleReset() {
    setCategory("");
    setStage("");
    setSaltLevel("");
    setMaxCookMinutes("");
    setTool("");
    setIngredientGroup("");
    setFavoritesOnly(false);
    setSourceType("ALL");
    setSortBy("QUALITY");
    setQuery("");
    void applyFilters({
      category: "",
      stage: "",
      saltLevel: "",
      maxCookMinutes: "",
      tool: "",
      ingredientGroup: "",
      favoritesOnly: false,
      sourceType: "ALL",
      sortBy: "QUALITY",
      query: "",
    });
  }

  const quickChips = [
    {
      id: "all",
      label: "전체",
      active: !hasAnyActiveFilter,
      onClick: handleReset,
    },
    {
      id: "favorites",
      label: "즐겨찾기",
      active: favoritesOnly,
      onClick: () => {
        const next = !favoritesOnly;
        setFavoritesOnly(next);
        void applyFilters({ favoritesOnly: next });
      },
    },
    {
      id: "meal",
      label: "식사",
      active: category === "MEAL",
      onClick: () => {
        const next = category === "MEAL" ? "" : "MEAL";
        setCategory(next);
        void applyFilters({ category: next });
      },
    },
    {
      id: "snack",
      label: "간식",
      active: category === "SNACK",
      onClick: () => {
        const next = category === "SNACK" ? "" : "SNACK";
        setCategory(next);
        void applyFilters({ category: next });
      },
    },
    {
      id: "quick",
      label: "10분 이내",
      active: maxCookMinutes === "10",
      onClick: () => {
        const next = maxCookMinutes === "10" ? "" : "10";
        setMaxCookMinutes(next);
        void applyFilters({ maxCookMinutes: next });
      },
    },
    {
      id: "nosalt",
      label: "무염",
      active: saltLevel === "NONE",
      onClick: () => {
        const next = saltLevel === "NONE" ? "" : "NONE";
        setSaltLevel(next);
        void applyFilters({ saltLevel: next });
      },
    },
    {
      id: "stage-1",
      label: "완료기",
      active: stage === "1",
      onClick: () => {
        const next = stage === "1" ? "" : "1";
        setStage(next);
        void applyFilters({ stage: next });
      },
    },
    {
      id: "stage-2",
      label: "유아식 1단계",
      active: stage === "2",
      onClick: () => {
        const next = stage === "2" ? "" : "2";
        setStage(next);
        void applyFilters({ stage: next });
      },
    },
  ];

  return (
    <div className="space-y-5">
      <RecipeModeTabs active="recipes" />

      <section className="space-y-3">
        <div>
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[28px]">
            전체 레시피 탐색
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] sm:text-sm">
            아기 알레르기·주의 식재료는 항상 자동 제외됩니다.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void applyFilters();
          }}
          className="space-y-2.5"
        >
          {/* 1줄: 자동 검색창 + 통합 필터 버튼 */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                type="search"
                aria-label="레시피 이름 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="메뉴·재료 검색 (예: 소고기, 진밥)"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <Icon name="filter" width={16} height={16} />
              <span>필터</span>
              {sheetFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-xs font-bold text-white">
                  {sheetFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* 2줄: 한 줄 빠른 필터 칩 */}
          <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
            {quickChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={chip.active}
                onClick={chip.onClick}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  chip.active
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* 통합 상세 필터 바텀 시트 */}
      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="레시피 필터"
        footer={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                handleReset();
                setFilterSheetOpen(false);
              }}
            >
              초기화
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => {
                void applyFilters();
                setFilterSheetOpen(false);
              }}
            >
              필터 적용
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[var(--color-text)]">
              레시피 출처
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: "ALL", label: "전체" },
                  { value: "SEED", label: "전문가 추천" },
                  { value: "AI", label: "AI 맞춤 추천" },
                ] as const
              ).map((tab) => {
                const active = sourceType === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSourceType(tab.value)}
                    className={`min-h-11 rounded-md border px-2 text-xs font-semibold transition-colors ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-sm font-semibold text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span>즐겨찾기만 보기</span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="filter-category"
              label="식사 분류"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">전체 (식사+간식)</option>
              <option value="MEAL">식사</option>
              <option value="SNACK">간식</option>
            </Select>

            <Select
              id="filter-stage"
              label="연령 단계"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">전체 단계</option>
              {AGE_STAGE_VALUES.map((st) => (
                <option key={st} value={String(st)}>
                  {AGE_STAGE_LABELS[st]}
                </option>
              ))}
            </Select>

            <Select
              id="filter-salt"
              label="간(염분) 단계"
              value={saltLevel}
              onChange={(e) => setSaltLevel(e.target.value)}
            >
              <option value="">아기 프로필 기준</option>
              {SALT_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {SALT_LEVEL_LABELS[lvl]}
                </option>
              ))}
            </Select>

            <Select
              id="filter-time"
              label="조리시간"
              value={maxCookMinutes}
              onChange={(e) => setMaxCookMinutes(e.target.value)}
            >
              <option value="">전체</option>
              <option value="10">10분 이하</option>
              <option value="20">20분 이하</option>
              <option value="30">30분 이하</option>
              <option value="30_PLUS">30분 초과</option>
            </Select>

            <Select
              id="filter-tool"
              label="조리도구"
              value={tool}
              onChange={(e) => setTool(e.target.value)}
            >
              <option value="">전체</option>
              {COMMON_TOOLS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>

            <Select
              id="filter-group"
              label="주재료 분류"
              value={ingredientGroup}
              onChange={(e) => setIngredientGroup(e.target.value)}
            >
              <option value="">전체</option>
              {INGREDIENT_GROUPS.map((grp) => (
                <option key={grp} value={grp}>
                  {INGREDIENT_GROUP_LABELS[grp]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </BottomSheet>

      {offlineFallbackMode && (
        <div
          role="status"
          data-testid="offline-favorites-fallback-notice"
          className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4 text-sm font-semibold text-[var(--color-warning-text)]"
        >
          오프라인 보관함에 저장된 즐겨찾기 레시피를 표시하고 있습니다. 카드를 눌러 오프라인
          조리법을 바로 열람할 수 있어요.
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => void applyFilters()} />}

      <section className="space-y-3" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
              {items.length}개 레시피
            </h2>
            {hasAnyActiveFilter && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-[var(--color-primary-text)] hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>

          <label className="inline-flex items-center">
            <span className="sr-only">레시피 정렬</span>
            <select
              id="filter-sort"
              aria-label="레시피 정렬"
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as "QUALITY" | "POPULAR" | "RATING" | "LATEST";
                setSortBy(val);
                void applyFilters({ sortBy: val });
              }}
              className="min-h-11 rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              <option value="QUALITY">추천순</option>
              <option value="POPULAR">인기순</option>
              <option value="RATING">평점순</option>
              <option value="LATEST">최신순</option>
            </select>
          </label>
        </div>

        {loading ? (
          <RecipeCardSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            title="조건에 맞는 레시피가 없어요"
            description="필터를 초기화하거나 보유 재료로 맞춤 레시피를 찾아보세요."
            icon={<Icon name="book" width={28} height={28} />}
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <Button variant="primary" size="sm" onClick={handleReset}>
                  필터 초기화
                </Button>
                <Link
                  href="/ingredients"
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--color-border-strong)] px-3.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  재료로 찾기
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {items.slice(0, visibleCount).map((recipe) =>
              offlineFallbackMode ? (
                <div
                  key={recipe.id}
                  className="animate-fadeInUp flex flex-col justify-between rounded-lg border border-[var(--color-border)] bg-white p-5"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">
                      {recipe.name}
                    </h3>
                    {recipe.summary && (
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {recipe.summary}
                      </p>
                    )}
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => {
                        const found = listOfflineFavorites(babyId).find(
                          (e) => e.recipe.id === recipe.id,
                        );
                        if (found) setOfflineReaderRecipe(found.recipe);
                      }}
                    >
                      오프라인 조리법 열기
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={recipe.id} className="animate-fadeInUp">
                  <RecipeCard babyId={babyId} profileSaltLevel={babySaltLevel} recipe={recipe} />
                </div>
              ),
            )}
          </div>
        )}

        {!loading && items.length > visibleCount && (
          <div>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setVisibleCount((count) => count + 12)}
            >
              레시피 더보기 ({Math.min(visibleCount, items.length)} / {items.length})
            </Button>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(offlineReaderRecipe)}
        onClose={() => setOfflineReaderRecipe(null)}
        title={
          offlineReaderRecipe ? `${offlineReaderRecipe.name} (오프라인 열람)` : "오프라인 열람"
        }
        maxWidthClass="max-w-2xl"
      >
        {offlineReaderRecipe && <OfflineRecipeReader recipe={offlineReaderRecipe} />}
      </Modal>
    </div>
  );
}
