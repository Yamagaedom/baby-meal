"use client";

import { useEffect, useState } from "react";
import { Button, useToast } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RecipeReviewView, RecipeReviewStats } from "@/features/reviews";

interface RecipeCommunitySectionProps {
  recipeId: string;
  initialAverageRating: number;
  initialReviewCount: number;
  initialFavoriteCount: number;
}

export function RecipeCommunitySection({
  recipeId,
  initialAverageRating,
  initialReviewCount,
  initialFavoriteCount,
}: RecipeCommunitySectionProps) {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<RecipeReviewView[]>([]);
  const [stats, setStats] = useState<RecipeReviewStats>({
    averageRating: initialAverageRating,
    totalReviews: initialReviewCount,
    ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loading, setLoading] = useState(true);

  // 작성 폼 상태
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchReviews() {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews ?? []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch {
      // 오프라인이거나 네트워크 오류 시 기존 props 통계 유지
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
          if (data.stats) setStats(data.stats);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [recipeId]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 5) {
      showToast("후기 내용은 5자 이상 작성해 주세요.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: selectedRating,
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        showToast(
          errData?.message || "후기를 저장하지 못했어요. 로그인 상태를 확인해 주세요.",
          "error",
        );
        return;
      }

      showToast("소중한 후기와 별점이 등록되었어요!", "success");
      setContent("");
      await fetchReviews();
    } catch {
      showToast("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "error");
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
    <section
      id="recipe-community-section"
      data-testid="recipe-community-section"
      className="space-y-6 border-t border-[var(--color-border)] pt-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">부모님 솔직 후기 & 평점</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            실제 아이에게 만들어 먹인 부모님들의 생생한 조리 팁과 반응을 확인해 보세요.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
          <Icon name="star" width={14} height={14} className="text-amber-500" fill="currentColor" />
          <span>즐겨찾기 {initialFavoriteCount}명</span>
        </div>
      </div>

      {stats.totalReviews > 0 && (
        <details className="disclosure">
          <summary>
            평점 상세 · {stats.averageRating.toFixed(1)}점 · 후기 {stats.totalReviews}개
          </summary>
          {/* 평점 종합 요약 대시보드 */}
          <div className="grid grid-cols-1 items-center gap-6 rounded-lg bg-[var(--color-surface-muted)] p-5 sm:grid-cols-3">
            <div className="text-center sm:border-r sm:border-[var(--color-border)] sm:pr-6">
              <span className="block text-4xl font-extrabold text-[var(--color-text)]">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "0.0"}
              </span>
              <div className="mt-1.5 flex justify-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-lg">
                    {star <= Math.round(stats.averageRating) ? "★" : "☆"}
                  </span>
                ))}
              </div>
              <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                {stats.totalReviews > 0 ? `총 ${stats.totalReviews}개 후기` : "등록된 후기 없음"}
              </span>
            </div>

            {/* 별점별 비율 분포 바 */}
            <div className="space-y-1.5 sm:col-span-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.ratingCounts[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                const pct =
                  stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-9 font-medium text-[var(--color-text-secondary)]">
                      {star}점
                    </span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-amber-400 transition-all"
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] text-[var(--color-text-secondary)]">
                      {count}개
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      )}

      <details className="disclosure">
        <summary>솔직 후기 작성하기</summary>
        <div className="disclosure-body">
          {/* 후기 작성 폼 */}
          <form
            onSubmit={handleSubmitReview}
            className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none sm:p-6"
          >
            <h3 className="text-base font-semibold text-[var(--color-text)]">솔직 후기 작성하기</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              아기의 반응, 식감/크기 조절 팁, 자연 조미 팁 등을 공유해 주세요.
            </p>

            {/* 별점 선택기 */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[var(--color-text)]">
                별점을 선택해 주세요
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedRating(s)}
                    className={`min-h-11 min-w-11 rounded-md text-2xl transition-transform hover:scale-110 ${
                      s <= selectedRating ? "text-amber-400" : "text-gray-300"
                    }`}
                    aria-label={`${s}점 선택`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-sm font-bold text-[var(--color-text)]">
                  {selectedRating}점
                </span>
              </div>
            </div>

            {/* 후기 본문 입력 */}
            <div className="mt-3.5">
              <textarea
                required
                rows={3}
                maxLength={500}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="우리 아기는 이 메뉴를 어떻게 먹었나요? (예: 당근을 5mm보다 작게 다져주니 부드럽게 잘 먹었어요!)"
                className="w-full rounded-md border border-[var(--color-border-strong)] p-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <div className="mt-1 flex justify-between text-[11px] text-[var(--color-text-secondary)]">
                <span>최소 5자 이상 · 개인정보는 자동으로 안전하게 보호됩니다.</span>
                <span>{content.length} / 500자</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "후기 등록 중..." : "후기 등록하기"}
              </Button>
            </div>
          </form>
        </div>
      </details>

      {/* 후기 피드 목록 */}
      <div className="space-y-3.5">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          부모님들의 생생 조리 후기 ({reviews.length})
        </h3>

        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
            후기 불러오는 중...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] py-10 text-center">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              아직 등록된 후기가 없습니다.
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              첫 번째 조리 경험과 팁을 공유해 다른 부모님들에게 도움을 주세요!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                data-testid={`review-card-${rev.id}`}
                className="rounded-lg border border-[var(--color-border)] bg-white p-4.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-text)]">{rev.authorName}</span>
                    {rev.babyAgeMonth && (
                      <span className="rounded bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary-text)]">
                        {rev.babyAgeMonth}개월 아기
                      </span>
                    )}
                    <span className="text-amber-400">
                      {"★".repeat(rev.rating)}
                      <span className="text-gray-200">{"★".repeat(5 - rev.rating)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <time className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(rev.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    {rev.isMyReview && (
                      <button
                        type="button"
                        disabled={deletingId === rev.id}
                        onClick={() => handleDeleteReview(rev.id)}
                        className="text-xs font-medium text-rose-500 hover:underline disabled:opacity-50"
                      >
                        {deletingId === rev.id ? "삭제 중..." : "삭제"}
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-2.5 leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
                  {rev.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
