"use client";

import Link from "next/link";
import { useState } from "react";
import { OfflineRecipeReader } from "@/components/PwaProviderAndOfflineBanner";
import { Button, EmptyState } from "@/components/ui";
import type { RecipeDetailView } from "@/features/recipe";
import { getOfflineActiveBabyId, listOfflineFavorites } from "@/lib/offline-favorites";

export default function OfflineFallbackPage() {
  const [favorites] = useState<RecipeDetailView[]>(() => {
    const activeBabyId = getOfflineActiveBabyId();
    return listOfflineFavorites(activeBabyId).map((entry) => entry.recipe);
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => favorites[0]?.id ?? null);

  const activeRecipe = favorites.find((f) => f.id === selectedId) ?? favorites[0] ?? null;

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10"
    >
      <section className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-6">
        <h1 className="text-xl font-semibold text-[var(--color-warning-text)]">
          인터넷 연결이 끊어졌어요
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-warning-text)]">
          네트워크가 연결되지 않아도 미리 즐겨찾기(★)해 둔 레시피의 재료·분량 계산·조리 순서는
          아래에서 바로 확인할 수 있습니다.
        </p>
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            연결 복구 후 홈으로 이동
          </Link>
        </div>
      </section>

      {favorites.length === 0 ? (
        <EmptyState
          title="저장된 즐겨찾기 레시피가 없습니다"
          description="온라인 상태에서 마음에 드는 레시피에 즐겨찾기(★)를 눌러 두면 오프라인에서도 열람할 수 있어요."
        />
      ) : (
        <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            저장된 즐겨찾기 레시피 ({favorites.length}건)
          </h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav) => (
              <Button
                key={fav.id}
                size="sm"
                variant={activeRecipe?.id === fav.id ? "primary" : "outline"}
                onClick={() => setSelectedId(fav.id)}
              >
                ★ {fav.name}
              </Button>
            ))}
          </div>
          {activeRecipe && <OfflineRecipeReader recipe={activeRecipe} />}
        </section>
      )}
    </main>
  );
}
