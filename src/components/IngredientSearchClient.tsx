"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeModeTabs } from "@/components/RecipeModeTabs";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  RecipeCardSkeleton,
} from "@/components/ui";
import type { AiQuotaStatus } from "@/features/ai-generation/types";
import type {
  IngredientMatchedRecipeView,
  IngredientOptionView,
} from "@/features/ingredient-search";
import type { RecipeDetailView } from "@/features/recipe";
import type { SaltLevel } from "@/lib/domain/types";

interface IngredientSearchClientProps {
  babyId: string;
  babyName: string;
  babySaltLevel: SaltLevel;
  initialPopularChips: IngredientOptionView[];
  initialPantryItems: IngredientOptionView[];
  initialQuota: AiQuotaStatus;
}

export function IngredientSearchClient({
  babyId,
  babyName,
  babySaltLevel,
  initialPopularChips,
  initialPantryItems,
  initialQuota,
}: IngredientSearchClientProps) {
  const [selected, setSelected] = useState<IngredientOptionView[]>(initialPantryItems);
  const [assumeBasicPantry, setAssumeBasicPantry] = useState(true);
  const [scope, setScope] = useState<"ON_HAND" | "SHOPPING" | "EXPLORE">("SHOPPING");
  const [maxMissing, setMaxMissing] = useState(3);
  const [browse, setBrowse] = useState(false);
  const [ingredientCount, setIngredientCount] = useState(40);
  const [diagnostics, setDiagnostics] = useState<{
    active: number;
    ageAndSalt: number;
    safe: number;
    matching: number;
  } | null>(null);
  const [requestNotice, setRequestNotice] = useState("");
  const [dishType, setDishType] = useState("ANY");
  const [fresh, setFresh] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientOptionView[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [items, setItems] = useState<IngredientMatchedRecipeView[]>([]);
  const [showAiSlot, setShowAiSlot] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 내 냉장고 (ING-07)
  const [pantrySaving, setPantrySaving] = useState(false);
  const [pantryError, setPantryError] = useState<string | null>(null);
  const [pantryNotice, setPantryNotice] = useState<string | null>(
    initialPantryItems.length > 0
      ? `내 냉장고에 저장된 재료 ${initialPantryItems.length}개를 불러왔습니다.`
      : null,
  );

  // 즉석 AI 생성 상태 (ING-06, AI-10, AI-11)
  const [quota, setQuota] = useState<AiQuotaStatus>(initialQuota);
  const [aiCategory, setAiCategory] = useState<"MEAL" | "SNACK">("MEAL");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<{
    recipe: RecipeDetailView;
    cached: boolean;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    fetch(`/api/ingredients?babyId=${encodeURIComponent(babyId)}&q=${encodeURIComponent(trimmed)}`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (!cancelled) {
          setSuggestions(data.results ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query, babyId]);

  useEffect(() => {
    if (initialPantryItems.length > 0) {
      void runRecommend(initialPantryItems, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runRecommend(
    nextSelected: IngredientOptionView[],
    nextPantry: boolean,
    nextScope = scope,
    nextMaxMissing = maxMissing,
  ) {
    if (nextSelected.length === 0 && nextScope !== "EXPLORE") {
      setItems([]);
      setShowAiSlot(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend/by-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          ingredientIds: nextSelected.map((i) => i.id),
          assumeBasicPantry: nextPantry,
          scope: nextScope,
          maxMissing: nextMaxMissing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "재료 기반 추천을 불러오지 못했습니다.");
        return;
      }
      setItems(data.items ?? []);
      setVisibleCount(12);
      setDiagnostics(data.diagnostics ?? null);
      setShowAiSlot(Boolean(data.showAiGenerationSlot));
      setHasSearched(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function toggleIngredient(option: IngredientOptionView) {
    const exists = selected.some((s) => s.id === option.id);
    const next = exists ? selected.filter((s) => s.id !== option.id) : [...selected, option];
    setSelected(next);
    setQuery("");
    setSuggestions([]);
    setAiGeneratedResult(null);
    setAiError(null);
    setPantryNotice(null);
    setPantryError(null);
    void runRecommend(next, assumeBasicPantry);
  }

  function handlePantryToggle(checked: boolean) {
    setAssumeBasicPantry(checked);
    if (selected.length > 0) {
      void runRecommend(selected, checked);
    }
  }

  async function handleSaveToPantry() {
    setPantrySaving(true);
    setPantryNotice(null);
    setPantryError(null);
    try {
      const res = await fetch("/api/pantry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientIds: selected.map((s) => s.id),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPantryNotice(`내 냉장고에 재료 ${data.savedCount}개가 저장되었습니다.`);
      } else {
        setPantryError(
          data?.error?.message ?? "냉장고 재료를 저장하지 못했어요. 다시 시도해 주세요.",
        );
      }
    } catch {
      setPantryError("네트워크 연결을 확인한 뒤 다시 저장해 주세요.");
    } finally {
      setPantrySaving(false);
    }
  }

  async function refreshQuotaFromServer() {
    try {
      const res = await fetch("/api/ai/quota");
      if (res.ok) {
        const data = await res.json();
        if (data.quota) setQuota(data.quota);
      }
    } catch {
      // 무시
    }
  }

  async function handleAiGenerate() {
    if (selected.length === 0 && scope !== "EXPLORE") return;
    setAiGenerating(true);
    setAiError(null);
    setAiGeneratedResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40_000);

    try {
      const res = await fetch("/api/ai/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          ingredientIds: selected.map((s) => s.id),
          category: aiCategory,
          scope,
          maxMissing,
          dishType,
          fresh,
          assumeBasicPantry,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(
          data?.error?.message ??
            "AI 레시피 생성에 실패했습니다. (생성 횟수는 차감되지 않았습니다)",
        );
        await refreshQuotaFromServer();
        return;
      }

      if (data.quota) {
        setQuota(data.quota);
      }
      setAiGeneratedResult({
        recipe: data.recipe,
        cached: Boolean(data.cached),
      });
      void runRecommend(selected, assumeBasicPantry);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setAiError(
          "AI 레시피 생성 시간이 40초를 초과해 중단되었습니다. 잠시 후 다시 시도해 주세요. (생성 횟수는 차감되지 않았습니다)",
        );
      } else {
        setAiError("네트워크 오류가 발생했습니다. (생성 횟수는 차감되지 않았습니다)");
      }
      await refreshQuotaFromServer();
    } finally {
      clearTimeout(timeoutId);
      setAiGenerating(false);
    }
  }

  const aiDisabled =
    aiGenerating ||
    (selected.length === 0 && scope !== "EXPLORE") ||
    quota.remainingToday <= 0 ||
    quota.globalLimitReached;

  return (
    <div className="space-y-5">
      <RecipeModeTabs active="ingredients" />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[28px]">
              냉장고 재료로 찾기
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              식재료를 고르면 {babyName} 맞춤 메뉴를 일치율 순으로 바로 찾아드려요.
            </p>
          </div>

          <span
            role="status"
            aria-live="polite"
            data-testid="ai-quota-badge"
            className="inline-flex min-h-8 items-center gap-1 rounded-sm border border-[var(--color-ai-border)] bg-[var(--color-ai-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-ai-text)]"
          >
            AI 생성 {quota.remainingToday}/{quota.dailyLimit}
          </span>
        </div>

        <div className="space-y-1.5">
          <Input
            id="pantry-search"
            label="식재료 검색 추가"
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) setSuggestions([]);
            }}
            placeholder="식재료 이름 입력 (예: 애호박, 소고기, 계란)"
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              동의어(계란→달걀, 쇠고기→소고기) 자동 인식
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBrowse((v) => !v);
                setIngredientCount(40);
              }}
              aria-expanded={browse}
            >
              전체 재료 찾아보기
            </Button>
          </div>
          {(query.trim() || browse) && suggestions.length > 0 && (
            <ul className="mt-1 max-h-52 overflow-auto rounded-lg border border-[var(--color-border-strong)] bg-white p-1 text-sm shadow-md">
              {suggestions.slice(0, ingredientCount).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggleIngredient(s)}
                    className="flex min-h-11 w-full items-center justify-between rounded-md px-3.5 py-2 text-left font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">+ 추가</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(query.trim() || browse) && suggestions.length > ingredientCount && (
          <Button variant="outline" fullWidth onClick={() => setIngredientCount((n) => n + 40)}>
            재료 더보기 ({ingredientCount}/{suggestions.length})
          </Button>
        )}
        {(query.trim() || browse) && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            전체 검색 결과 {suggestions.length}개 · 선택한 재료는 계속 유지돼요.
          </p>
        )}
        {query.trim() && suggestions.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm">등록되지 않은 재료인가요?</p>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch("/api/ingredient-requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: query }),
                  });
                  setRequestNotice(
                    res.ok
                      ? "재료 요청을 저장했어요. 검토 후 등록됩니다."
                      : "요청을 저장하지 못했어요.",
                  );
                } catch {
                  setRequestNotice("연결을 확인해 주세요.");
                }
              }}
            >
              이 재료 등록 요청
            </Button>
            <p role="status" className="text-sm">
              {requestNotice}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">자주 쓰는 재료 빠른 선택</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {initialPopularChips.map((chip) => {
              const active = selected.some((s) => s.id === chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleIngredient(chip)}
                  aria-pressed={active}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]"
                      : "border-[var(--color-border-strong)] bg-[var(--color-canvas)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  {chip.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              선택한 보유 재료 ({selected.length})
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selected.length > 0 && (
                <Link
                  href={`/meal-plan?ingredients=${selected.map((i) => i.id).join(",")}`}
                  className="inline-flex min-h-9 items-center text-xs font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
                >
                  일주일 식단 짜기 →
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                data-testid="save-pantry-btn"
                disabled={pantrySaving}
                onClick={() => void handleSaveToPantry()}
              >
                <span>{pantrySaving ? "저장 중..." : "냉장고 저장"}</span>
              </Button>
            </div>
          </div>

          {pantryNotice && (
            <div
              role="status"
              aria-live="polite"
              data-testid="pantry-save-notice"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--color-secondary-text)]"
            >
              <span aria-hidden="true">✓ </span>
              {pantryNotice}
            </div>
          )}
          {pantryError && (
            <p
              role="alert"
              className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger-text)]"
            >
              {pantryError}
            </p>
          )}

          {selected.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              위 빠른 칩을 누르거나 검색창에서 식재료를 선택하면 바로 매칭됩니다.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selected.map((item) => (
                <Chip
                  key={item.id}
                  onRemove={() => toggleIngredient(item)}
                  removeLabel={`${item.name} 선택 해제`}
                >
                  {item.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={scope !== "ON_HAND"}
              onChange={(e) => {
                const nextScope = e.target.checked ? "SHOPPING" : "ON_HAND";
                setScope(nextScope);
                if (selected.length > 0) {
                  void runRecommend(selected, assumeBasicPantry, nextScope, maxMissing);
                }
              }}
              className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span>추가 재료 {maxMissing}개까지 필요한 메뉴도 함께 보기</span>
          </label>

          <details className="disclosure">
            <summary>상세 검색 조건</summary>
            <div className="disclosure-body space-y-3 text-sm">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={assumeBasicPantry}
                  onChange={(e) => handlePantryToggle(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span>기본 양념·상비 재료(물, 식용유, 참기름, 채수 등) 보유로 간주</span>
              </label>

              {scope !== "ON_HAND" && (
                <label className="flex items-center justify-between gap-2">
                  <span>허용할 추가 필수 재료 수</span>
                  <select
                    aria-label="추가 필수 재료 수"
                    value={maxMissing}
                    onChange={(e) => {
                      const nextMax = Number(e.target.value);
                      setMaxMissing(nextMax);
                      if (selected.length > 0 || scope === "EXPLORE") {
                        void runRecommend(selected, assumeBasicPantry, scope, nextMax);
                      }
                    }}
                    className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-white px-3"
                  >
                    {[1, 2, 3, 5, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}개까지
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  선택 재료 없이도 전체 안전 메뉴를 둘러볼 수 있어요.
                </span>
                <Button
                  variant={scope === "EXPLORE" ? "primary" : "outline"}
                  size="sm"
                  aria-pressed={scope === "EXPLORE"}
                  onClick={() => {
                    const nextScope = scope === "EXPLORE" ? "SHOPPING" : "EXPLORE";
                    setScope(nextScope);
                    void runRecommend(selected, assumeBasicPantry, nextScope, maxMissing);
                  }}
                >
                  새 메뉴 찾아보기
                </Button>
              </div>
            </div>
          </details>
        </div>

        {error && (
          <ErrorState
            message={error}
            onRetry={() => void runRecommend(selected, assumeBasicPantry)}
          />
        )}
      </section>

      {loading && <RecipeCardSkeleton count={3} />}

      {hasSearched && !loading && (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              매칭된 레시피 ({items.length}건)
            </h2>
          </div>

          {diagnostics && (
            <details className="disclosure">
              <summary>왜 이만큼 나오나요?</summary>
              <p className="disclosure-body text-sm">
                저장된 활성 메뉴 {diagnostics.active}개 → 월령·간 기준 {diagnostics.ageAndSalt}개 →
                알레르기 제외 후 {diagnostics.safe}개 → 현재 재료 조건 {diagnostics.matching}개.
                안전 기준을 유지하며 검색 범위와 추가 재료 수를 조절할 수 있어요.
              </p>
            </details>
          )}
          {items.length === 0 ? (
            <EmptyState
              title="선택한 재료가 포함된 레시피가 아직 없어요"
              description="다른 재료를 추가하거나 아래에서 AI 새 레시피를 만들어 보세요."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.slice(0, visibleCount).map((item) => (
                <RecipeCard
                  key={item.id}
                  babyId={babyId}
                  profileSaltLevel={babySaltLevel}
                  recipe={item}
                  extraBadge={`${item.matchRate}% 일치`}
                  subText={item.availabilityBadge}
                />
              ))}
            </div>
          )}

          {items.length > visibleCount && (
            <Button variant="outline" fullWidth onClick={() => setVisibleCount((n) => n + 12)}>
              추천 더보기 ({visibleCount}/{items.length})
            </Button>
          )}
          {/* ING-06, AI-10, AI-11: 매칭률 80% 이상 결과가 3개 미만일 때 즉석 AI 생성 활성화 */}
          {(showAiSlot || hasSearched) && (
            <div
              data-testid="ai-generation-slot"
              className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--color-text)]">
                    맞춤 AI 새 레시피 만들기
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {showAiSlot ? "보유 재료와 잘 맞는 메뉴가 적어요. " : "다른 메뉴가 필요하다면 "}
                    현재 검색 범위로 새 레시피를 요청할 수 있어요. AI 결과는 사람이 검수하지
                    않았으니 재료와 조리법을 확인해 주세요.
                  </p>
                </div>

                <div role="group" aria-label="생성할 메뉴 분류 선택" className="flex gap-1.5">
                  <button
                    type="button"
                    aria-pressed={aiCategory === "MEAL"}
                    onClick={() => setAiCategory("MEAL")}
                    className={`min-h-11 rounded-md border px-3.5 py-2 text-xs font-semibold ${
                      aiCategory === "MEAL"
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)]"
                    }`}
                  >
                    식사
                  </button>
                  <button
                    type="button"
                    aria-pressed={aiCategory === "SNACK"}
                    onClick={() => setAiCategory("SNACK")}
                    className={`min-h-11 rounded-md border px-3.5 py-2 text-xs font-semibold ${
                      aiCategory === "SNACK"
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)]"
                    }`}
                  >
                    간식
                  </button>
                </div>
              </div>

              {quota.globalLimitReached && (
                <p
                  role="status"
                  data-testid="ai-global-limit-notice"
                  className="rounded-md border border-[var(--color-warning-border)] bg-white p-3 text-xs font-semibold text-[var(--color-warning-text)]"
                >
                  오늘 서비스 전체 일일 AI 생성 상한에 도달하여 기존 검증 레시피만 안내해 드립니다.
                </p>
              )}

              {!quota.globalLimitReached && quota.remainingToday <= 0 && (
                <p
                  role="status"
                  data-testid="ai-user-limit-notice"
                  className="rounded-md border border-[var(--color-warning-border)] bg-white p-3 text-xs font-semibold text-[var(--color-warning-text)]"
                >
                  오늘 사용 가능한 AI 생성 횟수(3회)를 모두 소진했어요. 내일 자정(00:00 KST)에 다시
                  초기화됩니다.
                </p>
              )}

              {aiGenerating && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="ai-generating-progress"
                  className="rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-soft)] p-3.5 text-xs font-semibold text-[var(--color-info-text)]"
                >
                  공공·유아식 참고 자료 검색 및 자동 안전 검증(식재료·나트륨·분량) 중입니다... (예상
                  소요 5~20초)
                </div>
              )}

              {aiError && (
                <div
                  role="alert"
                  data-testid="ai-generate-error"
                  className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-xs font-semibold text-[var(--color-danger-text)]"
                >
                  {aiError}
                </div>
              )}

              {aiGeneratedResult && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="ai-generated-result-card"
                  className="rounded-lg border-2 border-[var(--color-success-border)] bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="success">
                      {aiGeneratedResult.cached
                        ? "기존 동일 조건 레시피 반환 (횟수 미차감)"
                        : "새 AI 안전 검증 레시피 생성 완료"}
                    </Badge>
                    <Link
                      href={`/recipes/${aiGeneratedResult.recipe.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
                    >
                      상세 조리법 보기 →
                    </Link>
                  </div>
                  <p className="mt-1.5 text-base font-semibold text-[var(--color-text)]">
                    {aiGeneratedResult.recipe.name}
                  </p>
                  {aiGeneratedResult.recipe.summary && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {aiGeneratedResult.recipe.summary}
                    </p>
                  )}
                </div>
              )}

              <details className="disclosure">
                <summary>AI 생성 세부 옵션</summary>
                <div className="disclosure-body space-y-3 text-sm">
                  <label className="flex items-center justify-between gap-2">
                    <span>원하는 요리 유형</span>
                    <select
                      aria-label="AI 요리 유형"
                      className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-white px-3"
                      value={dishType}
                      onChange={(e) => setDishType(e.target.value)}
                    >
                      {[
                        ["ANY", "자유롭게"],
                        ["SOUP", "스프류"],
                        ["ONE_BOWL", "한그릇 음식"],
                        ["SIDE", "반찬"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fresh}
                      onChange={(e) => setFresh(e.target.checked)}
                    />
                    같은 조건의 저장 결과 대신 다른 메뉴 생성 (생성 한도 적용)
                  </label>
                </div>
              </details>
              <Button
                variant="primary"
                fullWidth
                data-testid="ai-generate-btn"
                disabled={aiDisabled}
                onClick={() => void handleAiGenerate()}
              >
                {aiGenerating
                  ? "AI 레시피 생성 중..."
                  : `AI로 새 레시피 만들기 (오늘 남은 횟수 ${quota.remainingToday}/${quota.dailyLimit})`}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
