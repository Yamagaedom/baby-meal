"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { scaleIngredientAmount, shouldShowPortionStorageTip } from "@/features/serving";
import type { RecipeDetailView } from "@/features/recipe";
import { listOfflineFavorites } from "@/lib/offline-favorites";
import { Badge, Button, EmptyState, Modal, Stepper } from "@/components/ui";
import { normalizeRecipeSummary } from "@/lib/presentation";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineRecipeReader({ recipe }: { recipe: RecipeDetailView }) {
  const [servings, setServings] = useState<number>(recipe.targetServings || 1);
  const showPortionTip = shouldShowPortionStorageTip(servings);

  return (
    <article
      data-testid="offline-recipe-detail"
      className="space-y-4 text-sm text-[var(--color-text)]"
    >
      <div
        role="note"
        className="rounded-md border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-xs text-[var(--color-warning-text)]"
      >
        <p className="font-semibold"> AI 생성·구성 레시피 안내 (오프라인 보관본)</p>
        <p className="mt-1">{recipe.aiDisclaimer}</p>
        <p className="mt-0.5">{recipe.medicalDisclaimer}</p>
      </div>

      <div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="primary">{recipe.category === "MEAL" ? "식사" : "간식"}</Badge>
          <Badge variant="salt">{recipe.saltLevelLabel}</Badge>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">{recipe.name}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {recipe.cookMinutes}분 · {recipe.ageStageLabels.join(" · ")}
        </p>
        {recipe.summary && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {normalizeRecipeSummary(
              recipe.summary,
              recipe.ingredients.map((ing) => ing.name),
            )}
          </p>
        )}
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5">
        <Stepper value={servings} onChange={setServings} />
        {showPortionTip && recipe.storageInfo.portionTip && (
          <p className="mt-2 rounded-lg bg-[var(--color-success-soft)] p-2.5 text-xs font-medium text-[var(--color-secondary-text)]">
            <strong>소분·보관 팁 ({servings}회분):</strong> {recipe.storageInfo.portionTip}
          </p>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-[var(--color-text)]">재료 안내</h4>
        <ul className="mt-2 divide-y divide-[var(--color-border)]">
          {recipe.ingredients.map((ing) => {
            const scaled = scaleIngredientAmount(
              ing.baseAmount,
              ing.baseUnit,
              recipe.baseServings,
              servings,
            );
            return (
              <li key={ing.ingredientId} className="flex items-center justify-between py-2">
                <span>
                  {ing.name}
                  {ing.prepNote ? ` (${ing.prepNote})` : ""}
                </span>
                <strong className="text-[var(--color-primary-text)]">{scaled.displayAmount}</strong>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-[var(--color-text)]">조리 순서</h4>
        <ol className="mt-2 space-y-2">
          {recipe.steps.map((s) => (
            <li key={s.order} className="rounded-md bg-[var(--color-surface-muted)] p-3">
              <strong>{s.order}. </strong>
              {s.instruction}
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

export function PwaProviderAndOfflineBanner({ activeBabyId }: { activeBabyId?: string | null }) {
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetailView | null>(null);
  const [favorites, setFavorites] = useState<RecipeDetailView[]>([]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }
    // 개발 번들은 URL이 고정되어 있어 Cache-First가 새 UI를 덮어쓸 수 있습니다.
    // 개발 중에는 앱의 워커만 해제하며 즐겨찾기 데이터는 그대로 보관합니다.
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.all(
          registrations
            .filter(
              (registration) =>
                registration.active?.scriptURL === `${window.location.origin}/sw.js`,
            )
            .map((registration) => registration.unregister()),
        );
        if (!("caches" in window)) return;
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith("baby-meal-shell-"))
            .map(async (name) => {
              const cache = await caches.open(name);
              const requests = await cache.keys();
              await Promise.all(
                requests
                  .filter((request) => new URL(request.url).pathname.startsWith("/_next/static/"))
                  .map((request) => cache.delete(request)),
              );
            }),
        );
      })
      .catch(() => {});
  }, []);

  function openOfflineDrawer() {
    const entries = listOfflineFavorites(activeBabyId);
    setFavorites(entries.map((e) => e.recipe));
    setSelectedRecipe(entries[0]?.recipe ?? null);
    setDrawerOpen(true);
  }

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
          className="border-b border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-4 py-2.5 text-sm text-[var(--color-warning-text)]"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              현재 오프라인 상태입니다. 저장해 둔 즐겨찾기 레시피는 오프라인에서도 열람할 수 있어요.
            </p>
            <Button
              variant="outline"
              size="sm"
              data-testid="open-offline-favorites-btn"
              onClick={openOfflineDrawer}
            >
              즐겨찾기 오프라인 열람
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="오프라인 즐겨찾기 레시피 보관함"
        maxWidthClass="max-w-2xl"
      >
        {favorites.length === 0 ? (
          <EmptyState
            title="오프라인에 저장된 즐겨찾기 레시피가 없어요"
            description="온라인 상태에서 레시피의 '☆ 즐겨찾기' 버튼을 눌러 두면 인터넷 연결이 없어도 언제든 조리법을 볼 수 있습니다."
          />
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              {favorites.map((fav) => (
                <Button
                  key={fav.id}
                  size="sm"
                  variant={selectedRecipe?.id === fav.id ? "primary" : "outline"}
                  onClick={() => setSelectedRecipe(fav)}
                >
                  ★ {fav.name}
                </Button>
              ))}
            </div>
            {selectedRecipe && <OfflineRecipeReader recipe={selectedRecipe} />}
          </div>
        )}
      </Modal>
    </>
  );
}
