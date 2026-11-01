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
  const [showAllergens, setShowAllergens] = useState(false);
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
      className="relative flex h-full min-w-0 flex-col rounded-lg border border-[var(--color-border)] bg-white p-4 transition-colors hover:bg-[var(--color-primary-soft)]"
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
      <div className="flex items-start gap-2 pr-10">
        <h3 className="min-w-0 text-lg leading-snug font-semibold text-balance text-[var(--color-text)]">
          <Link
            href={`/recipes/${recipe.id}`}
            className="rounded-sm underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
          >
            {recipe.name}
          </Link>
        </h3>
        <Badge variant="neutral" className="mt-0.5 shrink-0">
          {recipe.category === "MEAL" ? "식사" : "간식"}
        </Badge>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
        {recipe.cookMinutes}분 <span aria-hidden="true">·</span> {recipe.ageStageLabels.join(" · ")}
        {profileSaltLevel && recipe.saltLevel !== profileSaltLevel && (
          <> · {recipe.saltLevelLabel}</>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="recipe-card-badges">
          {recipe.isAiGenerated && <Badge variant="primary">AI 추천</Badge>}
          {secondaryBadge && (
            <Badge variant={secondaryBadge.includes("%") ? "primary" : "age"}>
              {secondaryBadge}
            </Badge>
          )}
        </div>
        {(recipe.averageRating > 0 || favCount > 0) && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {recipe.averageRating > 0 && (
              <span className="inline-flex items-center gap-0.5 font-bold text-amber-700">
                ★ {recipe.averageRating.toFixed(1)}
                <span className="font-normal text-amber-600">({recipe.reviewCount})</span>
              </span>
            )}
            {favCount > 0 && (
              <span className="inline-flex items-center gap-0.5 font-medium">
                <Icon name="star" width={12} height={12} fill="currentColor" /> {favCount}
              </span>
            )}
          </div>
        )}
      </div>
      {subText && (
        <p className="mt-3 text-xs font-medium text-[var(--color-text-secondary)]">{subText}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-2 text-sm">
        <p className="min-w-0 text-[var(--color-text-secondary)]">
          주요 재료:{" "}
          <span className="font-medium text-[var(--color-text)]">
            {recipe.primaryIngredients?.join(", ") || "상세에서 확인"}
          </span>
        </p>
        {recipe.allergens.length > 0 && (
          <button
            type="button"
            aria-expanded={showAllergens}
            onClick={() => setShowAllergens((value) => !value)}
            className="min-h-11 text-xs font-semibold text-[var(--color-primary-text)] underline underline-offset-4"
          >
            {showAllergens ? "알레르기 접기" : "알레르기 보기"}
          </button>
        )}
        {showAllergens && (
          <p className="text-xs text-[var(--color-danger-text)]" role="status">
            알레르기 유발 성분: {recipe.allergens.map((a) => a.label).join(", ")}
          </p>
        )}
      </div>
    </article>
  );
}
