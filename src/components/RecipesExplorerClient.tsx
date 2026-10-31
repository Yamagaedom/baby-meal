"use client";

import { useState } from "react";
import Link from "next/link";
import { OfflineRecipeReader } from "@/components/PwaProviderAndOfflineBanner";
import { RecipeCard } from "@/components/RecipeCard";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  RecipeCardSkeleton,
  Select,
} from "@/components/ui";
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
              aria-label="레시피 이름 또는 식재료 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴명 또는 식재료 검색 (예: 소고기, 당근, 진밥)"
            />
          </div>
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
        </form>
      </section>

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
            description="필터 조건을 완화하거나 초기화 버튼을 눌러 전체 메뉴를 확인해 보세요."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                필터 초기화하기
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((recipe) =>
              offlineFallbackMode ? (
                <div
                  key={recipe.id}
                  className="flex flex-col justify-between rounded-lg border border-[var(--color-border)] bg-white p-5"
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
                <RecipeCard
                  key={recipe.id}
                  babyId={babyId}
                  profileSaltLevel={babySaltLevel}
                  recipe={recipe}
                />
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
