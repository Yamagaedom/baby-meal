"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CookingModeModal } from "@/components/CookingModeModal";
import { formatStageRange } from "@/components/RecipeCard";
import { RecipeCommunitySection } from "@/components/RecipeCommunitySection";
import { RecipeNutritionWidget } from "@/components/RecipeNutritionWidget";
import {
  Accordion,
  Badge,
  Breadcrumb,
  Button,
  Input,
  ScrollProgressBar,
  Select,
  Stepper,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RecipeDetailView } from "@/features/recipe";
import { REPORT_REASON_LABELS } from "@/features/recipe/constants-client";
import { scaleIngredientAmount, shouldShowPortionStorageTip } from "@/features/serving";
import {
  removeOfflineFavoriteSnapshot,
  removeOfflineRecipeEverywhere,
  saveOfflineFavoriteSnapshot,
} from "@/lib/offline-favorites";
import {
  isVerifiedAuthoritativeSource,
  normalizeRecipeSummary,
  sourceDisplayLabel,
} from "@/lib/presentation";

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
  const [favoriteCount, setFavoriteCount] = useState<number>(recipe.favoriteCount ?? 0);
  const [liveRating, setLiveRating] = useState<number>(recipe.averageRating ?? 0);
  const [liveReviewCount, setLiveReviewCount] = useState<number>(recipe.reviewCount ?? 0);
  const [favPending, setFavPending] = useState(false);
  const [cookingModeOpen, setCookingModeOpen] = useState(false);
  const [showFloatingCookBar, setShowFloatingCookBar] = useState(false);
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

  // 모바일에서 스크롤 내렸을 때 하단 고정 액션바 노출
  useEffect(() => {
    function onScroll() {
      setShowFloatingCookBar(window.scrollY > 280);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        if (typeof data.favoriteCount === "number") {
          setFavoriteCount(data.favoriteCount);
        } else {
          setFavoriteCount((c) => (nextFav ? c + 1 : Math.max(0, c - 1)));
        }
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

  function openFeedbackSection() {
    const section = document.getElementById("meal-log-form");
    if (section instanceof HTMLDetailsElement) {
      section.open = true;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const showPortionTip = shouldShowPortionStorageTip(servings);
  const stageText = formatStageRange(recipe.ageStageLabels);
  const summary = normalizeRecipeSummary(
    recipe.summary,
    recipe.ingredients.map((ing) => ing.name),
  );

  const verifiedSources = recipe.sources.filter(isVerifiedAuthoritativeSource).map((src) => ({
    ...src,
    ...sourceDisplayLabel(src),
  }));

  const accordionItems = [
    {
      id: "tips-texture",
      title: "식감 · 입자 · 간 조절 팁",
      icon: <Icon name="timer" width={16} height={16} />,
      defaultOpen: false,
      content: (
        <div className="space-y-2 pt-1 text-sm text-[var(--color-text-secondary)]">
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
          {recipe.unsaltedFlavorGuide && <p>{recipe.unsaltedFlavorGuide}</p>}
        </div>
      ),
    },
    ...(Object.keys(recipe.babyTips.stageVariations).length > 0
      ? [
          {
            id: "tips-stages",
            title: "연령 단계별 맞춤 변형 가이드",
            icon: <Icon name="profile" width={16} height={16} />,
            defaultOpen: false,
            content: (
              <div className="rounded-lg bg-[var(--color-surface-muted)] p-3.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                <ul className="space-y-1.5">
                  {Object.entries(recipe.babyTips.stageVariations).map(([st, desc]) => (
                    <li key={st}>
                      • <strong className="text-[var(--color-text)]">{st}단계:</strong> {desc}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]
      : []),
    {
      id: "tips-storage",
      title: "보관 기한 및 안심 재가열 방법",
      icon: <Icon name="ingredients" width={16} height={16} />,
      defaultOpen: false,
      content: (
        <div className="space-y-2 pt-1 text-sm text-[var(--color-text-secondary)]">
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
          <p>
            <strong className="text-[var(--color-text)]">재가열 안내:</strong>{" "}
            {recipe.storageInfo.reheatTip}
          </p>
        </div>
      ),
    },
    {
      id: "tips-sources",
      title: "참고 출처 및 신뢰 정보",
      icon: <Icon name="book" width={16} height={16} />,
      defaultOpen: Boolean(recipe.isAiGenerated && (!recipe.slug || recipe.slug.startsWith("ai-"))),
      content:
        verifiedSources.length === 0 ? (
          <p className="pt-1 text-sm text-[var(--color-warning-text)]">
            현재 확인된 레시피 출처가 없습니다. 재료·조리법을 확인해 주세요.
          </p>
        ) : (
          <div className="pt-1 text-xs text-[var(--color-text-secondary)]">
            <ul className="space-y-1.5">
              {verifiedSources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary-text)] underline underline-offset-4 hover:text-[var(--color-text)]"
                  >
                    {source.publisher} · {source.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ),
    },
  ];

  return (
    <>
      <ScrollProgressBar />
      <article className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-clip">
        <Breadcrumb
          items={[
            { label: "홈", href: "/" },
            { label: "레시피 탐색", href: "/recipes" },
            { label: recipe.name },
          ]}
          className="pt-0.5"
        />

        {/* 레시피 핵심 헤더 */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-[24px] leading-tight font-bold tracking-tight text-[var(--color-text)] sm:text-[30px]">
                {recipe.name}
              </h1>
              <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">
                {recipe.category === "MEAL" ? "식사" : "간식"} · {recipe.cookMinutes}분
                {stageText && <> · {stageText}</>} · {recipe.saltLevelLabel}
              </p>
              <a
                href="#meal-log-form"
                onClick={(e) => {
                  e.preventDefault();
                  openFeedbackSection();
                }}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--color-text)] hover:underline sm:text-sm"
              >
                <span className="text-amber-500">★</span>
                <span>
                  {liveRating > 0 ? liveRating.toFixed(1) : "평점 없음"} · 후기 {liveReviewCount}개
                </span>
              </a>
            </div>
            <button
              type="button"
              disabled={favPending}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? "즐겨찾기됨 (해제)" : "즐겨찾기 추가"}
              onClick={handleToggleFavorite}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            >
              <Icon name="star" fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>

          {summary && (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{summary}</p>
          )}

          <div className="flex gap-2">
            <Link
              href={`/meal-plan?recipe=${recipe.id}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              식단에 담기
            </Link>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              data-testid="open-cooking-mode-btn"
              onClick={() => setCookingModeOpen(true)}
            >
              조리 시작
            </Button>
          </div>

          {/* AI 및 의료 고지 배너 — 상시 노출 (AI-08) */}
          <div
            role="note"
            data-testid="ai-safety-disclaimer"
            className="rounded-md border-l-4 border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--color-warning-text)]"
          >
            {recipe.isAiGenerated && (
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="ai">AI 생성 레시피 · 사람 미검수</Badge>
                <span className="font-semibold">{recipe.aiDisclaimer}</span>
              </div>
            )}
            <p>
              <strong>조리 전 재료·분량 확인 필수:</strong> {recipe.medicalDisclaimer}
            </p>
          </div>

          {recipe.aboveAgeWarningMessage && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3 text-xs font-semibold text-[var(--color-danger-text)] sm:text-sm"
            >
              월령 주의 안내: {recipe.aboveAgeWarningMessage}
            </div>
          )}

          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[var(--color-border)] pt-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="text-[var(--color-text-secondary)]">조리 도구</dt>
              <dd className="font-semibold text-[var(--color-text)]">
                {recipe.tools.join(", ") || "기본 조리도구"}
              </dd>
            </div>
            {recipe.saltLevel !== "NONE" && (
              <div className="flex items-center gap-1.5">
                <dt className="text-[var(--color-info-text)]">예상 나트륨</dt>
                <dd className="font-semibold text-[var(--color-info-text)]">
                  약 {recipe.sodiumMgPerServing}mg
                </dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <dt className="text-[var(--color-text-secondary)]">알레르기 유발 표시</dt>
              <dd className="font-semibold text-[var(--color-text)]">
                {recipe.allergens.length > 0
                  ? recipe.allergens.map((a) => a.label).join(", ")
                  : "해당 없음"}
              </dd>
            </div>
          </dl>

          {recipe.cautionIngredients.length > 0 && (
            <div className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-xs text-[var(--color-warning-text)]">
              <p className="font-semibold">식재료 손질·섭취 주의</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {recipe.cautionIngredients.map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}</strong>: {c.cautionNote}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 재료 + 분량 스테퍼 */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[var(--color-text)]">재료</h2>
            <Stepper value={servings} onChange={setServings} label="조리 분량 선택" compact />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{recipe.portionGuide}</p>

          {showPortionTip && recipe.storageInfo.portionTip && (
            <div
              data-testid="portion-storage-tip"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-xs font-medium text-[var(--color-secondary-text)]"
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
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
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
                        <span className="ml-1.5 rounded-sm bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                          선택
                        </span>
                      )}
                      {ing.prepNote && (
                        <span className="ml-1.5 text-xs text-[var(--color-text-secondary)]">
                          ({ing.prepNote})
                        </span>
                      )}
                      {ing.substituteName && (
                        <span className="ml-1.5 text-xs font-semibold text-[var(--color-info-text)]">
                          대체: {ing.substituteName}
                        </span>
                      )}
                    </span>
                  </label>

                  <span
                    data-testid={`ingredient-amount-${ing.name}`}
                    className="rounded-md bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-sm font-semibold text-[var(--color-primary-text)]"
                  >
                    {scaled.displayAmount}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 단계별 조리 순서 */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <h2 className="text-lg font-bold text-[var(--color-text)]">조리 순서</h2>

          <ol className="divide-y divide-[var(--color-border)]">
            {recipe.steps.map((step) => {
              const remaining = timers[step.order] ?? step.timerSeconds ?? 0;
              const running = Boolean(runningTimers[step.order]);
              const mins = Math.floor(remaining / 60);
              const secs = remaining % 60;
              return (
                <li key={step.order} className="py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="flex-1 text-base leading-relaxed text-[var(--color-text)]">
                      <strong className="mr-2.5 inline-flex min-w-6 items-center justify-center text-base font-bold text-[var(--color-primary)]">
                        {step.order}
                      </strong>
                      {step.instruction}
                    </p>
                    {step.timerSeconds && (
                      <button
                        type="button"
                        onClick={() => toggleStepTimer(step.order, step.timerSeconds!)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-1.5 font-mono text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <Icon name="timer" width="15" height="15" />{" "}
                        {running ? "일시정지" : "타이머"} {mins}:{String(secs).padStart(2, "0")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 요리 완료 시 내 냉장고 사용 재료 선택 차감 (해당 재료가 있을 때만 노출) */}
        {(Boolean(deductNotice) ||
          recipe.ingredients.some((ing) => ownedPantrySet.includes(ing.ingredientId))) && (
          <section
            data-testid="pantry-deduct-section"
            className="space-y-3 border-t border-[var(--color-border)] pt-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                냉장고 사용 재료 비우기
              </h2>
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
                {deductSubmitting ? "차감 중..." : "선택 재료 차감"}
              </Button>
            </div>
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
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
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
          </section>
        )}

        {/* 통합 먹었어요 기록 & 공개 후기·평점 섹션 */}
        <RecipeCommunitySection
          babyId={babyId}
          recipeId={recipe.id}
          recipeCategory={recipe.category}
          ingredients={recipe.ingredients}
          initialAverageRating={recipe.averageRating ?? 0}
          initialReviewCount={recipe.reviewCount ?? 0}
          initialFavoriteCount={favoriteCount}
          onReviewStatsChange={(s) => {
            setLiveRating(s.averageRating);
            setLiveReviewCount(s.totalReviews);
          }}
        />

        <RecipeNutritionWidget nutrition={recipe.nutrition} targetServings={servings} />

        {/* 아기 맞춤 조리 팁 & 보관법 & 참고 출처 */}
        <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <h2 className="text-base font-bold text-[var(--color-text)]">조리 팁 · 보관 · 출처</h2>
          <Accordion items={accordionItems} allowMultiple={true} />
        </section>

        {/* 하단 경량 텍스트 신고 링크 */}
        <section className="pt-1">
          <div className="flex justify-end">
            <button
              type="button"
              aria-expanded={reportOpen}
              onClick={() => setReportOpen((o) => !o)}
              className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] hover:underline"
            >
              레시피 신고
            </button>
          </div>

          {reportOpen && (
            <form
              onSubmit={handleReportSubmit}
              className="mt-2 space-y-3 rounded-lg border border-[var(--color-border)] bg-white p-4"
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
                onChange={(e) =>
                  setReportReason(e.target.value as keyof typeof REPORT_REASON_LABELS)
                }
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

      {/* 모바일 스크롤 시 하단 플로팅 액션바 */}
      {showFloatingCookBar && !cookingModeOpen && (
        <div className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),10px)+66px)] left-4 z-30 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/95 p-2 shadow-lg backdrop-blur-md sm:hidden">
          <Button variant="outline" size="sm" className="flex-1" onClick={openFeedbackSection}>
            다 먹었어요
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => setCookingModeOpen(true)}
          >
            조리 시작
          </Button>
        </div>
      )}

      {cookingModeOpen && (
        <CookingModeModal
          recipeName={recipe.name}
          steps={recipe.steps}
          onClose={() => setCookingModeOpen(false)}
        />
      )}
    </>
  );
}
