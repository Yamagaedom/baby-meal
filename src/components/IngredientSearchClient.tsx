"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
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
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientOptionView[]>([]);
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
    if (!trimmed) {
      return;
    }
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

  async function runRecommend(nextSelected: IngredientOptionView[], nextPantry: boolean) {
    if (nextSelected.length === 0) {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "재료 기반 추천을 불러오지 못했습니다.");
        return;
      }
      setItems(data.items ?? []);
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
    if (selected.length === 0) return;
    setAiGenerating(true);
    setAiError(null);
    setAiGeneratedResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_500);

    try {
      const res = await fetch("/api/ai/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          ingredientIds: selected.map((s) => s.id),
          category: aiCategory,
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
          "AI 레시피 생성 시간이 20초를 초과해 중단되었습니다. 잠시 후 다시 시도해 주세요. (생성 횟수는 차감되지 않았습니다)",
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
    aiGenerating || selected.length === 0 || quota.remainingToday <= 0 || quota.globalLimitReached;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/recipes" className="inline-flex min-h-11 items-center underline">
          전체 레시피
        </Link>
        <span className="inline-flex min-h-11 items-center font-semibold" aria-current="page">
          재료로 찾기
        </span>
        <Link
          href={`/meal-plan?ingredients=${selected.map((i) => i.id).join(",")}`}
          className="inline-flex min-h-11 items-center font-medium text-[var(--color-primary)] underline"
        >
          이 재료로 일주일 구성
        </Link>
      </div>
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
              냉장고 재료로 추천받기
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              집에 있는 식재료를 선택하면 {babyName}의 월령·간 단계·알레르기 기준에 맞는 레시피를
              재료 일치율 순으로 찾아드립니다.
            </p>
          </div>

          <span
            role="status"
            aria-live="polite"
            data-testid="ai-quota-badge"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-[var(--color-ai-border)] bg-[var(--color-ai-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ai-text)]"
          >
            <span>
              오늘 AI 생성 남은 횟수 {quota.remainingToday}/{quota.dailyLimit}
            </span>
          </span>
        </div>

        <div>
          <Input
            id="pantry-search"
            label="식재료 검색 추가"
            hint="동의어(예: 계란→달걀, 쇠고기→소고기)도 자동으로 찾아줍니다."
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) setSuggestions([]);
            }}
            placeholder="식재료 이름 입력 (예: 애호박, 소고기, 바나나)"
          />

          {suggestions.length > 0 && (
            <ul className="mt-1.5 max-h-52 overflow-auto rounded-lg border border-[var(--color-border-strong)] bg-white p-1 text-sm shadow-md">
              {suggestions.map((s) => (
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

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              선택한 보유 재료 ({selected.length})
            </p>
            <Button
              variant="outline"
              size="sm"
              data-testid="save-pantry-btn"
              disabled={pantrySaving}
              onClick={() => void handleSaveToPantry()}
            >
              <span>{pantrySaving ? "저장 중..." : "내 냉장고에 현재 재료 저장"}</span>
            </Button>
          </div>

          {pantryNotice && (
            <div
              role="status"
              aria-live="polite"
              data-testid="pantry-save-notice"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3 text-xs font-semibold text-[var(--color-secondary-text)]"
            >
              <span aria-hidden="true">✓ </span>
              {pantryNotice}
            </div>
          )}
          {pantryError && (
            <p
              role="alert"
              className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger-text)]"
            >
              {pantryError}
            </p>
          )}

          {selected.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              위 빠른 칩을 누르거나 검색창에서 식재료를 선택해 보세요.
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
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

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={assumeBasicPantry}
            onChange={(e) => handlePantryToggle(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
          />
          <span>기본 양념·상비 재료(물, 식용유, 참기름, 참깨가루, 채수 등) 보유로 간주</span>
        </label>

        <Button
          variant="primary"
          fullWidth
          disabled={selected.length === 0 || loading}
          onClick={() => void runRecommend(selected, assumeBasicPantry)}
        >
          {loading ? "매칭 계산 중..." : "추천 메뉴 찾기"}
        </Button>

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

          {items.length === 0 ? (
            <EmptyState
              title="선택한 재료가 포함된 레시피가 아직 없어요"
              description="다른 재료를 추가하거나 아래에서 AI 새 레시피를 만들어 보세요."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
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

          {/* ING-06, AI-10, AI-11: 매칭률 80% 이상 결과가 3개 미만일 때 즉석 AI 생성 활성화 */}
          {showAiSlot && (
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
                    보유 재료와 80% 이상 일치하는 레시피가 3개 미만입니다. 공공·유아식 참고 자료를
                    검색해 자동 안전 검증을 통과한 새 레시피를 생성할 수 있어요.
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
