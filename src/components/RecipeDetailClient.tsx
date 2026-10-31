"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CookingModeModal } from "@/components/CookingModeModal";
import { Badge, Button, Input, Select, Stepper } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { isVerifiedAuthoritativeSource, normalizeRecipeSummary, sourceDisplayLabel } from "@/lib/presentation";
import type { RecipeDetailView } from "@/features/recipe";
import {
  AMOUNT_EATEN_LABELS,
  MEAL_TIME_LABELS,
  RATING_LABELS,
  REACTION_OPTIONS,
  REPORT_REASON_LABELS,
} from "@/features/recipe/constants-client";
import { scaleIngredientAmount, shouldShowPortionStorageTip } from "@/features/serving";
import type { MealTime } from "@/lib/domain/types";
import {
  removeOfflineFavoriteSnapshot,
  removeOfflineRecipeEverywhere,
  saveOfflineFavoriteSnapshot,
} from "@/lib/offline-favorites";

interface RecipeDetailClientProps {
  babyId: string;
  recipe: RecipeDetailView;
  initialPantryIngredientIds?: string[];
}

export function RecipeDetailClient({
  babyId,
  recipe,
  initialPantryIngredientIds = [],
}: RecipeDetailClientProps) {
  const router = useRouter();
  const [servings, setServings] = useState<number>(recipe.targetServings);
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorite);
  const [favPending, setFavPending] = useState(false);
  const [cookingModeOpen, setCookingModeOpen] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);

  // ING-07: 내 냉장고 보유 재료 중 이 레시피에 쓰인 항목 선택 차감
  const [ownedPantrySet, setOwnedPantrySet] = useState<string[]>(initialPantryIngredientIds);
  const [deductTargets, setDeductTargets] = useState<string[]>(() =>
    recipe.ingredients
      .filter((ing) => initialPantryIngredientIds.includes(ing.ingredientId))
      .map((ing) => ing.ingredientId),
  );
  const [deductSubmitting, setDeductSubmitting] = useState(false);
  const [deductNotice, setDeductNotice] = useState<string | null>(null);

  // 단계별 타이머 상태
  const [timers, setTimers] = useState<Record<number, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<number, boolean>>({});

  // 먹었어요 기록 폼 상태 (LOG-01~04)
  const [rating, setRating] = useState<"GOOD" | "OK" | "REFUSED">("GOOD");
  const [amountEaten, setAmountEaten] = useState<"ALL" | "HALF" | "LITTLE">("ALL");
  const [mealTime, setMealTime] = useState<MealTime>(
    recipe.category === "SNACK" ? "SNACK" : "LUNCH",
  );
  const [memo, setMemo] = useState("");
  const [reactions, setReactions] = useState<string[]>([]);
  const [suspectedIngredientIds, setSuspectedIngredientIds] = useState<string[]>([]);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  // 레시피 신고 폼 상태 (AI-12)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<keyof typeof REPORT_REASON_LABELS>("WRONG_PORTION");
  const [reportMemo, setReportMemo] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // 즐겨찾기된 레시피 상세 진입 시 오프라인 스냅샷 자동 동기화
  useEffect(() => {
    if (recipe.isFavorite) {
      saveOfflineFavoriteSnapshot(babyId, recipe);
    }
  }, [babyId, recipe]);

  useEffect(() => {
    const activeOrders = Object.entries(runningTimers)
      .filter(([, active]) => active)
      .map(([order]) => Number(order));
    if (activeOrders.length === 0) return;

    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        for (const ord of activeOrders) {
          const current = next[ord] ?? 0;
          if (current <= 1) {
            next[ord] = 0;
            setRunningTimers((r) => ({ ...r, [ord]: false }));
          } else {
            next[ord] = current - 1;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [runningTimers]);

  function toggleStepTimer(order: number, defaultSeconds: number) {
    const currentlyRunning = Boolean(runningTimers[order]);
    if (currentlyRunning) {
      setRunningTimers((prev) => ({ ...prev, [order]: false }));
      return;
    }
    setTimers((prev) => ({
      ...prev,
      [order]: prev[order] && prev[order] > 0 ? prev[order] : defaultSeconds,
    }));
    setRunningTimers((prev) => ({ ...prev, [order]: true }));
  }

  async function handleToggleFavorite() {
    setFavPending(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ babyId, recipeId: recipe.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const nextFav = Boolean(data.isFavorite);
        setIsFavorite(nextFav);
        if (nextFav) {
          saveOfflineFavoriteSnapshot(babyId, { ...recipe, isFavorite: true });
        } else {
          removeOfflineFavoriteSnapshot(babyId, recipe.id);
        }
        router.refresh();
      }
    } finally {
      setFavPending(false);
    }
  }

  function toggleCheckedIngredient(id: string) {
    setCheckedIngredients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleReaction(label: string) {
    setReactions((prev) => {
      const next = prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label];
      if (next.length === 0) {
        setSuspectedIngredientIds([]);
      }
      return next;
    });
  }

  function toggleSuspectedIngredient(ingredientId: string) {
    setSuspectedIngredientIds((prev) =>
      prev.includes(ingredientId)
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId],
    );
  }

  async function handleMealLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLogError(null);
    setLogMessage(null);
    setLogSubmitting(true);

    try {
      const res = await fetch("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          recipeId: recipe.id,
          rating,
          amountEaten,
          mealTime,
          memo: memo.trim() || undefined,
          reactions,
          suspectedIngredientIds: reactions.length > 0 ? suspectedIngredientIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLogError(data?.error?.message ?? "먹은 기록 저장에 실패했습니다.");
        return;
      }

      if (data.addedSuspectedCount > 0) {
        removeOfflineFavoriteSnapshot(babyId, recipe.id);
        setLogMessage(
          `먹은 기록이 저장되었으며, 선택한 의심 식재료 ${data.addedSuspectedCount}건이 알레르기 주의 목록에 반영되어 이 메뉴는 이후 추천에서 제외됩니다.`,
        );
      } else {
        setLogMessage("먹은 기록이 저장되었습니다!");
      }
      setMemo("");
      setReactions([]);
      setSuspectedIngredientIds([]);
      router.refresh();
    } catch {
      setLogError("네트워크 오류가 발생했습니다.");
    } finally {
      setLogSubmitting(false);
    }
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReportError(null);
    setReportMessage(null);
    setReportSubmitting(true);

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          memo: reportMemo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data?.error?.message ?? "신고 접수에 실패했습니다.");
        return;
      }

      if (data.hiddenNow) {
        removeOfflineRecipeEverywhere(recipe.id);
        router.push("/recipes");
        router.refresh();
        return;
      }

      setReportMessage("신고가 접수되었습니다. 안전한 레시피 관리를 위해 소중히 반영하겠습니다.");
      setReportMemo("");
    } catch {
      setReportError("네트워크 오류가 발생했습니다.");
    } finally {
      setReportSubmitting(false);
    }
  }

  const showPortionTip = shouldShowPortionStorageTip(servings);
  const summary = normalizeRecipeSummary(
    recipe.summary,
    recipe.ingredients.map((ing) => ing.name),
  );

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {/* 레시피 기본 정보 */}
      <section className="border-t border-[var(--color-border)] pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
              {recipe.name}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="primary">{recipe.category === "MEAL" ? "식사" : "간식"}</Badge>
              <Badge variant="salt">{recipe.saltLevelLabel}</Badge>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)]">
              조리 {recipe.cookMinutes}분 · 난이도:{" "}
              {recipe.difficulty <= 1 ? "쉬움" : recipe.difficulty === 2 ? "보통" : "어려움"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {recipe.ageStageLabels.join(" · ")}
            </p>
            {summary && (
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {summary}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={favPending}
            aria-pressed={isFavorite}
            onClick={handleToggleFavorite}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors ${
              isFavorite
                ? "border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]"
                : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            }`}
          >
            <Icon name="star" fill={isFavorite ? "currentColor" : "none"} />
            <span>{isFavorite ? "즐겨찾기됨 (오프라인 보관)" : "즐겨찾기"}</span>
          </button>
        </div>

        {/* AI 및 의료 고지 배너 — 상시 노출, 접기·숨기기 금지 (AI-08) */}
        <div
          role="note"
          data-testid="ai-safety-disclaimer"
          className="mt-5 rounded-lg border-2 border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4 text-sm leading-relaxed text-[var(--color-warning-text)] sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="ai">AI 생성 레시피 · 사람 미검수</Badge>
            <span className="font-semibold text-[var(--color-warning-text)]">
              조리 전 재료·분량·상태 확인 필수
            </span>
          </div>
          <p className="mt-2 font-semibold">{recipe.aiDisclaimer}</p>
          <p className="mt-1">{recipe.medicalDisclaimer}</p>
        </div>

        {recipe.aboveAgeWarningMessage && (
          <div
            role="alert"
            className="mt-5 rounded-lg border-2 border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-4 text-sm font-semibold text-[var(--color-danger-text)]"
          >
            <span aria-hidden="true"> 월령 주의 안내: </span>
            {recipe.aboveAgeWarningMessage}
          </div>
        )}

        <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-4 text-xs sm:grid-cols-3">
          <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
            <dt className="font-semibold text-[var(--color-text-secondary)]">조리 도구</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
              {recipe.tools.join(", ") || "기본 조리도구"}
            </dd>
          </div>
          {recipe.saltLevel !== "NONE" && (
            <div className="rounded-md bg-[var(--color-info-soft)] p-3">
              <dt className="font-semibold text-[var(--color-info-text)]">1회분 예상 나트륨</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[var(--color-info-text)]">
                약 {recipe.sodiumMgPerServing}mg
              </dd>
            </div>
          )}
          <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
            <dt className="font-semibold text-[var(--color-text-secondary)]">알레르기 유발 표시</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
              {recipe.allergens.length > 0
                ? ` ${recipe.allergens.map((a) => a.label).join(", ")}`
                : "해당 없음"}
            </dd>
          </div>
        </dl>

        {recipe.unsaltedFlavorGuide && (
          <p className="mt-3.5 rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-soft)] p-3.5 text-xs font-semibold text-[var(--color-info-text)]">
            {recipe.unsaltedFlavorGuide}
          </p>
        )}

        {recipe.cautionIngredients.length > 0 && (
          <div className="mt-3.5 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3.5 text-sm text-[var(--color-warning-text)]">
            <p className="font-semibold">식재료 손질·섭취 주의 안내</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {recipe.cautionIngredients.map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong>: {c.cautionNote}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 고정(Sticky) 분량 스테퍼 + 재료 체크리스트 (RCP-02, SRV-01~05) */}
      <section className="space-y-4 border-t border-[var(--color-border)] pt-6">
        <div className="rounded-lg bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              재료 안내 & 분량 조절
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">{recipe.portionGuide}</p>
          </div>
          <Stepper value={servings} onChange={setServings} label="조리 분량 선택" />
        </div>

        {showPortionTip && recipe.storageInfo.portionTip && (
          <div
            data-testid="portion-storage-tip"
            className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3.5 text-xs font-medium text-[var(--color-secondary-text)]"
          >
            <strong>소분·보관 팁 ({servings}회분 조리):</strong> {recipe.storageInfo.portionTip}
          </div>
        )}

        <ul className="divide-y divide-[var(--color-border)] text-sm">
          {recipe.ingredients.map((ing) => {
            const scaled = scaleIngredientAmount(
              ing.baseAmount,
              ing.baseUnit,
              recipe.baseServings,
              servings,
            );
            const checked = checkedIngredients.includes(ing.ingredientId);
            return (
              <li
                key={ing.ingredientId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheckedIngredient(ing.ingredientId)}
                    aria-label={`${ing.name} 손질 준비 완료 체크`}
                    className="h-5 w-5 shrink-0 accent-[var(--color-secondary)]"
                  />
                  <span className={checked ? "text-[var(--color-text-muted)] line-through" : ""}>
                    <span className="font-semibold text-[var(--color-text)]">{ing.name}</span>
                    {ing.isOptional && (
                      <span className="ml-1.5 rounded-sm bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                        선택 재료
                      </span>
                    )}
                    {ing.prepNote && (
                      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                        ({ing.prepNote})
                      </span>
                    )}
                    {ing.substituteName && (
                      <span className="ml-2 text-xs font-semibold text-[var(--color-info-text)]">
                        대체 가능: {ing.substituteName}
                      </span>
                    )}
                  </span>
                </label>

                <span
                  data-testid={`ingredient-amount-${ing.name}`}
                  className="rounded-lg bg-[var(--color-primary-soft)] px-2.5 py-1 text-sm font-semibold text-[var(--color-primary-text)]"
                >
                  {scaled.displayAmount}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 단계별 조리 순서 (RCP-03, RCP-07) */}
      <section className="space-y-4 border-t border-[var(--color-border)] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">단계별 조리 순서</h2>
          <Button
            variant="primary"
            size="sm"
            data-testid="open-cooking-mode-btn"
            onClick={() => setCookingModeOpen(true)}
          >
            조리 모드 (큰 글씨 · 화면 켜짐 유지)
          </Button>
        </div>

        <ol className="space-y-3">
          {recipe.steps.map((step) => {
            const remaining = timers[step.order] ?? step.timerSeconds ?? 0;
            const running = Boolean(runningTimers[step.order]);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            return (
              <li
                key={step.order}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="flex-1 text-base leading-relaxed text-[var(--color-text)]">
                    <strong className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-sm bg-[var(--color-primary)] text-xs font-semibold text-white">
                      {step.order}
                    </strong>
                    {step.instruction}
                  </p>
                  {step.timerSeconds && (
                    <button
                      type="button"
                      onClick={() => toggleStepTimer(step.order, step.timerSeconds!)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-strong)] bg-white px-3.5 py-2 font-mono text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <Icon name="timer" width="16" height="16" /> {running ? "일시정지" : "타이머"}{" "}
                      {mins}:{String(secs).padStart(2, "0")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 아기 맞춤 조리 팁 & 보관법 & 참고 출처 (RCP-04~06, AI-06) */}
      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm shadow-none sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">아기 맞춤 팁 & 보관 안내</h2>
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <p>
            <strong className="text-[var(--color-text)]">식감 조절:</strong>{" "}
            {recipe.babyTips.textureTip}
          </p>
          <p>
            <strong className="text-[var(--color-text)]">재료 크기:</strong>{" "}
            {recipe.babyTips.cuttingSizeTip}
          </p>
          <p>
            <strong className="text-[var(--color-text)]">간 조절 팁:</strong>{" "}
            {recipe.babyTips.seasoningTip}
          </p>
        </div>

        {Object.keys(recipe.babyTips.stageVariations).length > 0 && (
          <div className="rounded-lg bg-[var(--color-surface-muted)] p-4 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text)]">연령 단계별 변형 가이드</p>
            <ul className="mt-1.5 space-y-1">
              {Object.entries(recipe.babyTips.stageVariations).map(([st, desc]) => (
                <li key={st}>
                  • <strong className="text-[var(--color-text)]">{st}단계:</strong> {desc}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-[var(--color-border)] pt-3.5 text-sm text-[var(--color-text-secondary)]">
          <p>
            <strong className="text-[var(--color-text)]">보관 기한:</strong> 냉장{" "}
            {recipe.storageInfo.fridgeDays !== null
              ? `${recipe.storageInfo.fridgeDays}일`
              : "비권장"}{" "}
            / 냉동{" "}
            {recipe.storageInfo.freezerDays !== null
              ? `${recipe.storageInfo.freezerDays}일`
              : "비권장"}
          </p>
          <p className="mt-1">
            <strong className="text-[var(--color-text)]">재가열 안내:</strong>{" "}
            {recipe.storageInfo.reheatTip}
          </p>
        </div>

        {(() => {
          const verifiedSources = recipe.sources
            .filter(isVerifiedAuthoritativeSource)
            .map((src) => ({
              ...src,
              ...sourceDisplayLabel(src),
            }));

          if (verifiedSources.length === 0) return null;

          return (
            <div className="border-t border-[var(--color-border)] pt-3.5 text-xs text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text)]">참고 출처</p>
              <ul className="mt-2 space-y-1.5">
                {verifiedSources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center font-semibold text-[var(--color-primary-text)] underline underline-offset-4 hover:text-[var(--color-text)]"
                    >
                      {source.publisher} · {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </section>

      {cookingModeOpen && (
        <CookingModeModal
          recipeName={recipe.name}
          steps={recipe.steps}
          onClose={() => setCookingModeOpen(false)}
        />
      )}

      {/* ING-07: 요리 완료 시 내 냉장고 사용 재료 선택 차감 */}
      {(Boolean(deductNotice) ||
        recipe.ingredients.some((ing) => ownedPantrySet.includes(ing.ingredientId))) && (
        <section
          data-testid="pantry-deduct-section"
          className="space-y-3.5 border-t border-[var(--color-border)] pt-6"
        >
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            요리 완료 · 내 냉장고 사용 재료 차감 (선택)
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            다 쓴 재료를 선택해 내 냉장고 보관 목록에서 바로 비울 수 있습니다.
          </p>
          {deductNotice && (
            <div
              role="status"
              aria-live="polite"
              data-testid="pantry-deduct-notice"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-xs font-semibold text-[var(--color-secondary-text)]"
            >
              <span aria-hidden="true">✓ </span>
              {deductNotice}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {recipe.ingredients
              .filter((ing) => ownedPantrySet.includes(ing.ingredientId))
              .map((ing) => (
                <label
                  key={ing.ingredientId}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3.5 py-2 text-sm font-semibold text-[var(--color-text)]"
                >
                  <input
                    type="checkbox"
                    checked={deductTargets.includes(ing.ingredientId)}
                    onChange={() =>
                      setDeductTargets((prev) =>
                        prev.includes(ing.ingredientId)
                          ? prev.filter((id) => id !== ing.ingredientId)
                          : [...prev, ing.ingredientId],
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>{ing.name}</span>
                </label>
              ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            data-testid="deduct-pantry-btn"
            disabled={deductSubmitting || deductTargets.length === 0}
            onClick={async () => {
              setDeductSubmitting(true);
              try {
                const res = await fetch("/api/pantry/deduct", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ingredientIds: deductTargets }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setOwnedPantrySet((prev) => prev.filter((id) => !deductTargets.includes(id)));
                  setDeductTargets([]);
                  setDeductNotice(
                    `내 냉장고에서 사용 재료 ${data.deductedCount}개를 차감했습니다.`,
                  );
                  router.refresh();
                }
              } finally {
                setDeductSubmitting(false);
              }
            }}
          >
            {deductSubmitting ? "차감 중..." : "선택한 재료 냉장고에서 차감"}
          </Button>
        </section>
      )}

      {/* 먹었어요 기록 폼 (LOG-01~04) */}
      <section className="border-t border-[var(--color-border)] pt-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">먹었어요 기록 남기기</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          아기의 반응을 기록하면 다음 맞춤 추천과 메뉴 카드 평가 배지에 반영됩니다.
        </p>

        <form onSubmit={handleMealLogSubmit} className="mt-4 space-y-5">
          {logMessage && (
            <div
              role="status"
              aria-live="polite"
              data-testid="meal-log-success"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3.5 text-sm font-semibold text-[var(--color-secondary-text)]"
            >
              <span aria-hidden="true">✓ </span>
              {logMessage}
            </div>
          )}
          {logError && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-sm font-semibold text-[var(--color-danger-text)]"
            >
              {logError}
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-semibold text-[var(--color-text)]">
              아기 반응 선택 (필수)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["GOOD", "OK", "REFUSED"] as const).map((r) => {
                const active = rating === r;
                return (
                  <label
                    key={r}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border-strong)] bg-[var(--color-canvas)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={r}
                      checked={active}
                      onChange={() => setRating(r)}
                      className="sr-only"
                    />
                    {RATING_LABELS[r]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="log-amount"
              label="섭취량"
              value={amountEaten}
              onChange={(e) => setAmountEaten(e.target.value as "ALL" | "HALF" | "LITTLE")}
            >
              {(["ALL", "HALF", "LITTLE"] as const).map((amt) => (
                <option key={amt} value={amt}>
                  {AMOUNT_EATEN_LABELS[amt]}
                </option>
              ))}
            </Select>

            <Select
              id="log-meal-time"
              label="식사 시간대"
              value={mealTime}
              onChange={(e) => setMealTime(e.target.value as MealTime)}
            >
              {(["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const).map((mt) => (
                <option key={mt} value={mt}>
                  {MEAL_TIME_LABELS[mt]}
                </option>
              ))}
            </Select>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-[var(--color-text)]">
              이상 반응 체크 (선택 — 체크 시 의심 식재료를 주의 목록에 바로 등록할 수 있습니다)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {REACTION_OPTIONS.map((rx) => (
                <label
                  key={rx}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)]"
                >
                  <input
                    type="checkbox"
                    checked={reactions.includes(rx)}
                    onChange={() => toggleReaction(rx)}
                    className="h-4 w-4 accent-[var(--color-danger)]"
                  />
                  <span>{rx}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {reactions.length > 0 && (
            <fieldset className="rounded-lg border-2 border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-4">
              <legend className="px-1 text-sm font-semibold text-[var(--color-danger-text)]">
                알레르기 의심(SUSPECTED) 식재료 등록 선택
              </legend>
              <p className="mt-1 text-xs text-[var(--color-danger-text)]">
                선택한 식재료는 즉시 아기의 알레르기 주의 목록에 추가되어 향후 추천에서 제외됩니다.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {recipe.ingredients.map((ing) => (
                  <label
                    key={ing.ingredientId}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-danger-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--color-text)]"
                  >
                    <input
                      type="checkbox"
                      checked={suspectedIngredientIds.includes(ing.ingredientId)}
                      onChange={() => toggleSuspectedIngredient(ing.ingredientId)}
                      className="h-4 w-4 accent-[var(--color-danger)]"
                    />
                    <span>{ing.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <Input
            id="log-memo"
            label="메모 (선택)"
            type="text"
            maxLength={300}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 당근을 잘게 썰어주니 끝까지 다 먹었어요"
          />

          <Button type="submit" fullWidth disabled={logSubmitting}>
            {logSubmitting ? "기록 저장 중..." : "먹었어요 저장"}
          </Button>
        </form>
      </section>

      {/* 레시피 신고 (AI-12) */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            레시피 분량이나 재료에 문제가 있나요?
          </span>
          <button
            type="button"
            aria-expanded={reportOpen}
            onClick={() => setReportOpen((o) => !o)}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--color-danger-text)] underline underline-offset-4"
          >
            레시피가 이상해요 (신고)
          </button>
        </div>

        {reportOpen && (
          <form
            onSubmit={handleReportSubmit}
            className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4"
          >
            {reportMessage && (
              <div
                role="status"
                className="rounded-md border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-xs font-semibold text-[var(--color-secondary-text)]"
              >
                {reportMessage}
              </div>
            )}
            {reportError && (
              <div
                role="alert"
                className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3 text-xs font-semibold text-[var(--color-danger-text)]"
              >
                {reportError}
              </div>
            )}

            <Select
              id="report-reason"
              label="신고 사유"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as keyof typeof REPORT_REASON_LABELS)}
            >
              {(Object.keys(REPORT_REASON_LABELS) as (keyof typeof REPORT_REASON_LABELS)[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {REPORT_REASON_LABELS[key]}
                  </option>
                ),
              )}
            </Select>

            <Input
              id="report-memo"
              label="상세 내용 (선택)"
              type="text"
              maxLength={300}
              value={reportMemo}
              onChange={(e) => setReportMemo(e.target.value)}
              placeholder="수정이 필요한 부분을 알려주세요"
            />

            <Button type="submit" variant="danger" size="sm" disabled={reportSubmitting}>
              {reportSubmitting ? "접수 중..." : "신고 접수"}
            </Button>
          </form>
        )}
      </section>
    </article>
  );
}
