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

export function formatStageRange(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  const first = labels[0];
  const last = labels[labels.length - 1];
  if (first.startsWith("유아식 ") && last.startsWith("유아식 ")) {
    return `${first}~${last.replace("유아식 ", "")}`;
  }
  return `${first}~${last}`;
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
  const stageText = formatStageRange(recipe.ageStageLabels);

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
      className="group relative flex h-full min-w-0 flex-col rounded-lg border border-[var(--color-border)] bg-white p-4 transition-colors hover:border-[var(--color-primary-border)] hover:bg-[var(--color-primary-soft)]/50"
    >
      <button
        type="button"
        disabled={pending}
        aria-pressed={isFavorite}
        onClick={handleToggleFavorite}
        aria-label={`${recipe.name} 즐겨찾기 ${isFavorite ? "해제" : "추가"}`}
        title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={`relative z-10 float-right ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-wait ${
          isFavorite
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
        }`}
        style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}
      >
        <Icon name="star" fill={isFavorite ? "currentColor" : "none"} />
      </button>

      <div className="flex items-start gap-2 pr-10">
        <h3 className="min-w-0 text-base leading-snug font-semibold text-balance text-[var(--color-text)] sm:text-lg">
          <Link
            href={`/recipes/${recipe.id}`}
            className="rounded-sm group-hover:text-[var(--color-primary)] after:absolute after:inset-0 after:content-['']"
          >
            {recipe.name}
          </Link>
        </h3>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {recipe.category === "MEAL" ? "식사" : "간식"} · {recipe.cookMinutes}분
        {stageText && <> · {stageText}</>}
        {profileSaltLevel && recipe.saltLevel !== profileSaltLevel && (
          <> · {recipe.saltLevelLabel}</>
        )}
      </p>

      {(recipe.isAiGenerated || secondaryBadge || recipe.averageRating > 0 || favCount > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
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
      )}

      {subText && (
        <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">{subText}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3 text-xs text-[var(--color-text-secondary)]">
        <p className="min-w-0 truncate">
          주요 재료:{" "}
          <span className="font-medium text-[var(--color-text)]">
            {recipe.primaryIngredients?.join(", ") || "상세에서 확인"}
          </span>
        </p>
        {recipe.allergens.length > 0 && (
          <span className="shrink-0 text-[var(--color-text-secondary)]">
            포함: {recipe.allergens.map((a) => a.label).join(", ")}
          </span>
        )}
      </div>
    </article>
  );
}
