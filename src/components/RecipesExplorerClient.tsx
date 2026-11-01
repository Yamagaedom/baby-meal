"use client";

import { useState } from "react";
import Link from "next/link";
import { OfflineRecipeReader } from "@/components/PwaProviderAndOfflineBanner";
import { RecipeCard } from "@/components/RecipeCard";
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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  const advancedCount = [stage, saltLevel, tool, ingredientGroup].filter(Boolean).length;
  const totalFilterCount = [category, stage, saltLevel, maxCookMinutes, tool, ingredientGroup].filter(Boolean).length;

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
          setOfflineFallbackMode(true);
          return;
        }
        setError("레시피 목록을 불러오지 못했어요.");
        return;
      }
      const data = await res.json();
      const fetchedItems: RecipeCardView[] = data.items ?? [];
      setItems(fetchedItems);
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
        setOfflineFallbackMode(true);
      } else {
        setError("오프라인 상태입니다. 인터넷 연결을 확인해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-sm">
        <span className="inline-flex min-h-11 items-center font-semibold" aria-current="page">
          전체 레시피
        </span>
        <Link href="/ingredients" className="inline-flex min-h-11 items-center underline">
          재료로 찾기
        </Link>
      </div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
              전체 레시피 탐색
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              다른 연령·간 단계도 탐색할 수 있으나, 아기 알레르기·주의 식재료 필터는 안전을 위해
              항상 적용됩니다.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            필터 초기화
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void applyFilters();
          }}
          className="space-y-4"
        >
          {/* 출처 유형 탭 & 정렬 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="출처 유형">
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
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setSourceType(tab.value);
                      void applyFilters({ sourceType: tab.value });
                    }}
                    className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="w-40">
              <Select
                id="filter-sort"
                label=""
                value={sortBy}
                onChange={(e) => {
                  const val = e.target.value as "QUALITY" | "POPULAR" | "RATING" | "LATEST";
                  setSortBy(val);
                  void applyFilters({ sortBy: val });
                }}
              >
                <option value="QUALITY">추천순</option>
                <option value="POPULAR">인기순 (즐겨찾기)</option>
                <option value="RATING">평점순 (별점)</option>
                <option value="LATEST">최신 등록순</option>
              </Select>
            </div>
          </div>

          <div>
            <Input
              type="search"
              aria-label="레시피 이름 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴명 또는 식재료 검색 (예: 소고기, 당근, 진밥)"
            />
          </div>

          {/* 퀵 필터 칩스 (노션 UI 레퍼런스: Chips / Horizontal Scroll) */}
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
            {[
              {
                id: "all",
                label: "전체",
                active:
                  !category &&
                  !stage &&
                  !saltLevel &&
                  !maxCookMinutes &&
                  !query &&
                  !tool &&
                  !ingredientGroup &&
                  !favoritesOnly,
                onClick: handleReset,
              },
              {
                id: "stage-1",
                label: "초기 이유식",
                active: stage === "1",
                onClick: () => {
                  const next = stage === "1" ? "" : "1";
                  setStage(next);
                  void applyFilters({ stage: next });
                },
              },
              {
                id: "stage-2",
                label: "중기 이유식",
                active: stage === "2",
                onClick: () => {
                  const next = stage === "2" ? "" : "2";
                  setStage(next);
                  void applyFilters({ stage: next });
                },
              },
              {
                id: "stage-3",
                label: "후기·완료기",
                active: stage === "3",
                onClick: () => {
                  const next = stage === "3" ? "" : "3";
                  setStage(next);
                  void applyFilters({ stage: next });
                },
              },
              {
                id: "beef",
                label: "소고기",
                active: query === "소고기",
                onClick: () => {
                  const next = query === "소고기" ? "" : "소고기";
                  setQuery(next);
                  void applyFilters({ query: next });
                },
              },
              {
                id: "quick",
                label: "10분 초간단",
                active: maxCookMinutes === "10",
                onClick: () => {
                  const next = maxCookMinutes === "10" ? "" : "10";
                  setMaxCookMinutes(next);
                  void applyFilters({ maxCookMinutes: next });
                },
              },
              {
                id: "nosalt",
                label: "무염 안심",
                active: saltLevel === "NONE",
                onClick: () => {
                  const next = saltLevel === "NONE" ? "" : "NONE";
                  setSaltLevel(next);
                  void applyFilters({ saltLevel: next });
                },
              },
              {
                id: "snack",
                label: "간식만",
                active: category === "SNACK",
                onClick: () => {
                  const next = category === "SNACK" ? "" : "SNACK";
                  setCategory(next);
                  void applyFilters({ category: next });
                },
              },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                className={`inline-flex min-h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition-all ${
                  chip.active
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* 모바일 화면 (sm:hidden): 바텀 시트 열기 버튼 & 빠른 토글 */}
          <div className="flex sm:hidden flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-text)] shadow-xs transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <Icon name="filter" width={16} height={16} />
              <span>상세 필터</span>
              {totalFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-xs font-bold text-white">
                  {totalFilterCount}
                </span>
              )}
            </button>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => {
                  setFavoritesOnly(e.target.checked);
                  void applyFilters({ favoritesOnly: e.target.checked });
                }}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span>즐겨찾기만</span>
            </label>

            <Button type="submit" disabled={loading} size="sm">
              {loading ? "검색 중..." : "검색"}
            </Button>
          </div>

          {/* 데스크톱 화면 (hidden sm:block): 기존 인라인 필터 그리드 유지 */}
          <div className="hidden sm:block space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="filter-category"
                label="분류"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  void applyFilters({ category: e.target.value });
                }}
              >
                <option value="">전체 (식사+간식)</option>
                <option value="MEAL">식사</option>
                <option value="SNACK">간식</option>
              </Select>
              <Select
                id="filter-time"
                label="조리시간"
                value={maxCookMinutes}
                onChange={(e) => {
                  setMaxCookMinutes(e.target.value);
                  void applyFilters({ maxCookMinutes: e.target.value });
                }}
              >
                <option value="">전체</option>
                <option value="10">10분 이하</option>
                <option value="20">20분 이하</option>
                <option value="30">30분 이하</option>
                <option value="30_PLUS">30분 초과</option>
              </Select>
            </div>
            <button
              type="button"
              aria-expanded={advancedOpen}
              aria-controls="advanced-recipe-filters"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
            >
              {advancedOpen ? "추가 필터 접기" : "필터 더보기"}
              {advancedCount > 0 ? ` (${advancedCount}개 적용)` : ""}
            </button>
            <div id="advanced-recipe-filters" hidden={!advancedOpen}>
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
                <Select
                  id="filter-stage"
                  label="연령 단계"
                  value={stage}
                  onChange={(e) => {
                    setStage(e.target.value);
                    void applyFilters({ stage: e.target.value });
                  }}
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
                  onChange={(e) => {
                    setSaltLevel(e.target.value);
                    void applyFilters({ saltLevel: e.target.value });
                  }}
                >
                  <option value="">아기 프로필 기준</option>
                  {SALT_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {SALT_LEVEL_LABELS[lvl]}
                    </option>
                  ))}
                </Select>
                <Select
                  id="filter-tool"
                  label="조리도구"
                  value={tool}
                  onChange={(e) => {
                    setTool(e.target.value);
                    void applyFilters({ tool: e.target.value });
                  }}
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
                  onChange={(e) => {
                    setIngredientGroup(e.target.value);
                    void applyFilters({ ingredientGroup: e.target.value });
                  }}
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

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3.5 py-2 text-sm font-semibold text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => {
                    setFavoritesOnly(e.target.checked);
                    void applyFilters({ favoritesOnly: e.target.checked });
                  }}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>즐겨찾기만 보기</span>
              </label>

              <Button type="submit" disabled={loading}>
                {loading ? "검색 중..." : "검색"}
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* 모바일 상세 필터 바텀 시트 (노션 UI 레퍼런스: Bottom Sheet / Drawer) */}
      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="레시피 상세 필터"
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
              결과 {items.length}건 보기
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <Select
            id="mobile-filter-category"
            label="식사 분류"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
            }}
          >
            <option value="">전체 (식사+간식)</option>
            <option value="MEAL">식사</option>
            <option value="SNACK">간식</option>
          </Select>

          <Select
            id="mobile-filter-stage"
            label="연령 단계"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
            }}
          >
            <option value="">전체 단계</option>
            {AGE_STAGE_VALUES.map((st) => (
              <option key={st} value={String(st)}>
                {AGE_STAGE_LABELS[st]}
              </option>
            ))}
          </Select>

          <Select
            id="mobile-filter-salt"
            label="간(염분) 단계"
            value={saltLevel}
            onChange={(e) => {
              setSaltLevel(e.target.value);
            }}
          >
            <option value="">아기 프로필 기준</option>
            {SALT_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {SALT_LEVEL_LABELS[lvl]}
              </option>
            ))}
          </Select>

          <Select
            id="mobile-filter-time"
            label="조리시간"
            value={maxCookMinutes}
            onChange={(e) => {
              setMaxCookMinutes(e.target.value);
            }}
          >
            <option value="">전체</option>
            <option value="10">10분 이하</option>
            <option value="20">20분 이하</option>
            <option value="30">30분 이하</option>
            <option value="30_PLUS">30분 초과</option>
          </Select>

          <Select
            id="mobile-filter-tool"
            label="조리도구"
            value={tool}
            onChange={(e) => {
              setTool(e.target.value);
            }}
          >
            <option value="">전체</option>
            {COMMON_TOOLS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          <Select
            id="mobile-filter-group"
            label="주재료 분류"
            value={ingredientGroup}
            onChange={(e) => {
              setIngredientGroup(e.target.value);
            }}
          >
            <option value="">전체</option>
            {INGREDIENT_GROUPS.map((grp) => (
              <option key={grp} value={grp}>
                {INGREDIENT_GROUP_LABELS[grp]}
              </option>
            ))}
          </Select>
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

      <section className="space-y-3.5" aria-live="polite">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          검색 결과 ({items.length}건)
        </h2>
        {loading ? (
          <RecipeCardSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            title="조건에 맞는 레시피가 없어요"
            description="필터 조건을 완화하거나 초기화하여 다른 맛있는 유아식을 찾아보세요."
            icon={<Icon name="book" width={28} height={28} />}
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <Button variant="primary" size="sm" onClick={handleReset}>
                  필터 초기화하기
                </Button>
                <Link
                  href="/"
                  className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-border)] px-3.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  AI 맞춤 추천 받기
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((recipe) =>
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
                  <RecipeCard
                    babyId={babyId}
                    profileSaltLevel={babySaltLevel}
                    recipe={recipe}
                  />
                </div>
              ),
            )}
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
