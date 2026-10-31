"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, useToast } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RecipeCardView } from "@/features/recipe";
import type { SaltLevel } from "@/lib/domain/types";
import { syncFavoriteSnapshotById } from "@/lib/offline-favorites";

interface RecipeCardProps {
  babyId?: string;
  profileSaltLevel?: SaltLevel;
  recipe: RecipeCardView;
  extraBadge?: string | null;
  subText?: string | null;
}

export function RecipeCard({
  babyId,
  profileSaltLevel,
  recipe,
  extraBadge,
  subText,
}: RecipeCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [favoriteOverride, setFavoriteOverride] = useState<{
    initial: boolean;
    value: boolean;
  } | null>(null);
  const isFavorite =
    favoriteOverride?.initial === recipe.isFavorite ? favoriteOverride.value : recipe.isFavorite;
  const [favCount, setFavCount] = useState(recipe.favoriteCount ?? 0);
  const [pending, setPending] = useState(false);
  const secondaryBadge =
    extraBadge === "추가 추천" ? recipe.ratingBadge : extraBadge || recipe.ratingBadge;

  async function handleToggleFavorite() {
    setPending(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ babyId, recipeId: recipe.id }),
      });
      if (!res.ok) {
        showToast("즐겨찾기를 변경하지 못했어요. 다시 시도해 주세요.", "error");
        return;
      }
      const data = await res.json();
      const nextFav = Boolean(data.isFavorite);
      setFavoriteOverride({ initial: recipe.isFavorite, value: nextFav });
      if (typeof data.favoriteCount === "number") {
        setFavCount(data.favoriteCount);
      } else {
        setFavCount((c) => (nextFav ? c + 1 : Math.max(0, c - 1)));
      }
      if (babyId) void syncFavoriteSnapshotById(babyId, recipe.id, nextFav);
      router.refresh();
    } catch {
      showToast("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <article
      data-testid={`recipe-card-${recipe.slug ?? recipe.id}`}
      className="relative flex h-full min-w-0 flex-col rounded-lg bg-[var(--color-surface-muted)] p-5 transition-colors hover:bg-[var(--color-primary-soft)]"
    >
      <button
        type="button"
        disabled={pending}
        aria-pressed={isFavorite}
        onClick={handleToggleFavorite}
        aria-label={`${recipe.name} 즐겨찾기 ${isFavorite ? "해제" : "추가"}`}
        title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={`absolute top-2 right-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors disabled:cursor-wait ${isFavorite ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"}`}
      >
        <Icon name="star" fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <h3 className="pr-8 text-lg leading-snug font-semibold text-balance text-[var(--color-text)]">
        <Link
          href={`/recipes/${recipe.id}`}
          className="rounded-sm underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
        >
          {recipe.name}
        </Link>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {recipe.cookMinutes}분 <span aria-hidden="true">·</span> {recipe.ageStageLabels.join(" · ")}
        {profileSaltLevel && recipe.saltLevel !== profileSaltLevel && (
          <> · {recipe.saltLevelLabel}</>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="recipe-card-badges">
        {recipe.isAiGenerated && (
          <Badge variant="primary">AI 추천</Badge>
        )}
        <Badge variant="neutral">{recipe.category === "MEAL" ? "식사" : "간식"}</Badge>
        {recipe.averageRating > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
            ★ {recipe.averageRating.toFixed(1)}
            <span className="font-normal text-amber-600">({recipe.reviewCount})</span>
          </span>
        )}
        {favCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            ❤️ {favCount}
          </span>
        )}
        {secondaryBadge && (
          <Badge variant={secondaryBadge.includes("%") ? "primary" : "age"}>{secondaryBadge}</Badge>
        )}
      </div>
      {subText && (
        <p className="mt-3 text-xs font-medium text-[var(--color-text-secondary)]">{subText}</p>
      )}
      {(recipe.aboveAgeWarning || recipe.allergens.length > 0) && (
        <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3 text-sm leading-relaxed">
          {recipe.aboveAgeWarning && (
            <p className="flex items-start gap-1.5 font-semibold text-[var(--color-warning-text)]">
              <Icon name="warning" className="mt-0.5 shrink-0" width="16" height="16" />
              <span>현재 아기 월령보다 높은 단계 메뉴입니다 (식감·크기 주의)</span>
            </p>
          )}
          {recipe.allergens.length > 0 && (
            <p className="text-[var(--color-text-secondary)]">
              알레르기 유발 성분:{" "}
              <strong className="font-semibold text-[var(--color-text)]">
                {recipe.allergens.map((a) => a.label).join(", ")}
              </strong>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
