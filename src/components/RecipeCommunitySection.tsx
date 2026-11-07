"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, useToast } from "@/components/ui";
import {
  AMOUNT_EATEN_LABELS,
  MEAL_TIME_LABELS,
  RATING_LABELS,
  REACTION_OPTIONS,
} from "@/features/recipe/constants-client";
import type { RecipeDetailView } from "@/features/recipe";
import type { RecipeReviewStats, RecipeReviewView } from "@/features/reviews";
import type { MealTime } from "@/lib/domain/types";
import { removeOfflineFavoriteSnapshot } from "@/lib/offline-favorites";

interface RecipeCommunitySectionProps {
  babyId: string;
  recipeId: string;
  recipeCategory: "MEAL" | "SNACK";
  ingredients: RecipeDetailView["ingredients"];
  initialAverageRating: number;
  initialReviewCount: number;
  initialFavoriteCount: number;
  onReviewStatsChange?: (stats: RecipeReviewStats) => void;
}

/**
 * 개인 '먹었어요 기록'(반응·섭취량·이상반응)과 공개 '별점·후기'를 하나의 흐름으로 통합한 섹션.
 */
export function RecipeCommunitySection({
  babyId,
  recipeId,
  recipeCategory,
  ingredients,
  initialAverageRating,
  initialReviewCount,
  initialFavoriteCount,
  onReviewStatsChange,
}: RecipeCommunitySectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<RecipeReviewView[]>([]);
  const [stats, setStats] = useState<RecipeReviewStats>({
    averageRating: initialAverageRating,
    totalReviews: initialReviewCount,
    ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 통합 기록·후기 폼 상태
  const [rating, setRating] = useState<"GOOD" | "OK" | "REFUSED">("GOOD");
  const [amountEaten, setAmountEaten] = useState<"ALL" | "HALF" | "LITTLE">("ALL");
  const [mealTime, setMealTime] = useState<MealTime>(
    recipeCategory === "SNACK" ? "SNACK" : "LUNCH",
  );
  const [memo, setMemo] = useState("");
  const [sharePublicReview, setSharePublicReview] = useState(false);
  const [selectedStar, setSelectedStar] = useState<number>(5);
  const [showReactionOptions, setShowReactionOptions] = useState(false);
  const [reactions, setReactions] = useState<string[]>([]);
  const [suspectedIngredientIds, setSuspectedIngredientIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  async function fetchReviews() {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews ?? []);
        if (data.stats) {
          setStats(data.stats);
          onReviewStatsChange?.(data.stats);
        }
      }
    } catch {
      // 오프라인 등 오류 시 초기 통계 유지
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/recipes/${recipeId}/reviews`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data) {
          setReviews(data.reviews ?? []);
          if (data.stats) {
            setStats(data.stats);
            onReviewStatsChange?.(data.stats);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

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

  async function handleUnifiedSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLogError(null);
    setLogMessage(null);

    const trimmedMemo = memo.trim();
    if (sharePublicReview && trimmedMemo.length < 5) {
      setLogError("공개 후기를 함께 남기려면 메모·후기를 5자 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const logRes = await fetch("/api/meal-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId,
          recipeId,
          rating,
          amountEaten,
          mealTime,
          memo: trimmedMemo || undefined,
          reactions,
          suspectedIngredientIds: reactions.length > 0 ? suspectedIngredientIds : [],
        }),
      });
      const logData = await logRes.json();
      if (!logRes.ok) {
        setLogError(logData?.error?.message ?? "먹은 기록 저장에 실패했습니다.");
        return;
      }

      let reviewSaved = false;
      if (sharePublicReview) {
        const revRes = await fetch(`/api/recipes/${recipeId}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating: selectedStar,
            content: trimmedMemo,
          }),
        });
        if (revRes.ok) {
          reviewSaved = true;
          await fetchReviews();
        } else {
          const revErr = await revRes.json().catch(() => null);
          showToast(
            revErr?.message || "먹은 기록은 저장되었으나 공개 후기 등록에 실패했어요.",
            "warning",
          );
        }
      }

      if (logData.addedSuspectedCount > 0) {
        removeOfflineFavoriteSnapshot(babyId, recipeId);
        setLogMessage(
          `먹은 기록이 저장되었으며, 의심 식재료 ${logData.addedSuspectedCount}건이 주의 목록에 반영되었습니다.`,
        );
      } else if (reviewSaved) {
        setLogMessage("먹은 기록과 공개 후기·별점이 함께 저장되었습니다!");
      } else {
        setLogMessage("먹은 기록이 저장되었습니다!");
      }

      setMemo("");
      setSharePublicReview(false);
      setReactions([]);
      setSuspectedIngredientIds([]);
      setShowReactionOptions(false);
      router.refresh();
    } catch {
      setLogError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!confirm("작성하신 후기를 삭제하시겠습니까?")) return;

    setDeletingId(reviewId);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews?reviewId=${reviewId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showToast("후기를 삭제하지 못했어요.", "error");
        return;
      }

      showToast("후기가 삭제되었습니다.", "success");
      await fetchReviews();
    } catch {
      showToast("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <details id="meal-log-form" data-testid="recipe-community-section" className="disclosure">
      <summary>
        먹었어요 기록 · 후기 {stats.totalReviews > 0 ? `(${stats.totalReviews}개)` : ""}
      </summary>

      <div className="disclosure-body space-y-6">
        <form
          onSubmit={handleUnifiedSubmit}
          className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-4"
        >
          {logMessage && (
            <div
              role="status"
              aria-live="polite"
              data-testid="meal-log-success"
              className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-sm font-semibold text-[var(--color-secondary-text)]"
            >
              <span aria-hidden="true">✓ </span>
              {logMessage}
            </div>
          )}
          {logError && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3 text-sm font-semibold text-[var(--color-danger-text)]"
            >
              {logError}
            </div>
          )}

          <fieldset>
            <legend className="text-xs font-semibold text-[var(--color-text)]">아기 반응</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(["GOOD", "OK", "REFUSED"] as const).map((r) => {
                const active = rating === r;
                return (
                  <label
                    key={r}
                    className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors sm:text-sm ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
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

          <div className="grid grid-cols-2 gap-2.5">
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

          <Input
            id="log-memo"
            label="메모 · 한 줄 후기 (선택)"
            type="text"
            maxLength={500}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 당근을 잘게 썰어주니 끝까지 다 먹었어요"
          />

          <div className="space-y-2.5 rounded-md border border-[var(--color-border)] bg-white p-3">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-text)] sm:text-sm">
              <input
                type="checkbox"
                checked={sharePublicReview}
                onChange={(e) => setSharePublicReview(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span>다른 부모님께 별점·공개 후기도 함께 남기기</span>
            </label>

            {sharePublicReview && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
                <div className="flex items-center gap-1" role="group" aria-label="별점 선택">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedStar(s)}
                      aria-label={`${s}점 선택`}
                      className={`min-h-11 min-w-11 rounded-md text-xl transition-colors ${
                        s <= selectedStar ? "text-amber-500" : "text-gray-300"
                      }`}
                    >
                      <span aria-hidden="true">★</span>
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {selectedStar}점 · 5자 이상 작성
                </span>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              aria-expanded={showReactionOptions || reactions.length > 0}
              onClick={() => setShowReactionOptions((v) => !v)}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)]"
            >
              {showReactionOptions || reactions.length > 0
                ? "이상 반응 체크 접기"
                : "+ 이상 반응이 있었나요? (발진·구토 등 주의 식재료 등록)"}
            </button>

            {(showReactionOptions || reactions.length > 0) && (
              <div className="mt-2 space-y-3">
                <fieldset>
                  <legend className="sr-only">이상 반응 체크</legend>
                  <div className="flex flex-wrap gap-2">
                    {REACTION_OPTIONS.map((rx) => (
                      <label
                        key={rx}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-text)]"
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
                  <fieldset className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5">
                    <legend className="px-1 text-xs font-semibold text-[var(--color-danger-text)]">
                      알레르기 의심 식재료 주의 목록 등록
                    </legend>
                    <p className="mt-0.5 text-xs text-[var(--color-danger-text)]">
                      선택한 식재료는 즉시 주의 목록에 추가되어 이후 추천에서 제외됩니다.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ingredients.map((ing) => (
                        <label
                          key={ing.ingredientId}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-danger-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
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
              </div>
            )}
          </div>

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "저장 중..." : "먹었어요 저장"}
          </Button>
        </form>

        {/* 공개 후기 목록 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              부모님 후기 ({reviews.length})
            </h3>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {stats.totalReviews > 0
                ? `평균 ★ ${stats.averageRating.toFixed(1)} · 즐겨찾기 ${initialFavoriteCount}명`
                : `즐겨찾기 ${initialFavoriteCount}명`}
            </span>
          </div>

          {loading ? (
            <p className="py-4 text-center text-xs text-[var(--color-text-secondary)]">
              후기 불러오는 중...
            </p>
          ) : reviews.length === 0 ? (
            <p className="rounded-lg bg-[var(--color-surface-muted)] px-4 py-4 text-center text-xs text-[var(--color-text-secondary)]">
              아직 등록된 공개 후기가 없어요. 첫 번째 조리 팁을 공유해 보세요.
            </p>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  data-testid={`review-card-${rev.id}`}
                  className="rounded-lg border border-[var(--color-border)] bg-white p-3.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-text)]">
                        {rev.authorName}
                      </span>
                      {rev.babyAgeMonth && (
                        <span className="rounded bg-[var(--color-primary-soft)] px-1.5 py-0.5 font-semibold text-[var(--color-primary-text)]">
                          {rev.babyAgeMonth}개월
                        </span>
                      )}
                      <span className="text-amber-500">{"★".repeat(rev.rating)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <time className="text-[var(--color-text-secondary)]">
                        {new Date(rev.createdAt).toLocaleDateString("ko-KR")}
                      </time>
                      {rev.isMyReview && (
                        <button
                          type="button"
                          disabled={deletingId === rev.id}
                          onClick={() => handleDeleteReview(rev.id)}
                          className="min-h-11 px-1 font-medium text-[var(--color-danger-text)] hover:underline disabled:opacity-50"
                        >
                          {deletingId === rev.id ? "삭제 중" : "삭제"}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
                    {rev.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
