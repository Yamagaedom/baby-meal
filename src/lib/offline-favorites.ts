/**
 * 즐겨찾기 레시피 오프라인 열람 저장소 (PRD 7장 오프라인 PWA 요구사항)
 * - 아기 프로필별(babyId)로 즐겨찾기된 RecipeDetailView 스냅샷을 브라우저에 보관한다.
 * - 확정·의심 알레르기 및 기피 식재료 변경 시 충돌 항목을 즉시 제거하며, 형제 프로필 간 오프라인 캐시를 격리한다.
 * - 로그아웃/탈퇴 시 전체 즉시 파기한다.
 */
import type { RecipeDetailView } from "@/features/recipe";

const STORAGE_KEY = "baby_meal_offline_favorites_v1";
const ACTIVE_BABY_STORAGE_KEY = "baby_meal_active_baby_id_v1";

export interface OfflineFavoriteEntry {
  babyId: string;
  savedAtIso: string;
  recipe: RecipeDetailView;
}

export interface OfflineAllergyPurgeFilter {
  excludedAllergenCodes?: readonly string[];
  excludedIngredientIds?: readonly string[];
  excludedIngredientNames?: readonly string[];
}

function readAllEntries(): OfflineFavoriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineFavoriteEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAllEntries(entries: OfflineFavoriteEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 저장 용량 초과 시 무시
  }
}

function postSwMessage(message: Record<string, unknown>) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage(message);
    })
    .catch(() => {});
}

function syncSwAllowedUrlsForBaby(babyId: string, entries: readonly OfflineFavoriteEntry[]) {
  const urls = entries
    .filter((entry) => entry.babyId === babyId)
    .map((entry) => `/recipes/${entry.recipe.id}`);
  postSwMessage({ type: "SYNC_ALLOWED_FAVORITE_URLS", urls });
}

export function setOfflineActiveBabyId(babyId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (babyId) {
      window.localStorage.setItem(ACTIVE_BABY_STORAGE_KEY, babyId);
    } else {
      window.localStorage.removeItem(ACTIVE_BABY_STORAGE_KEY);
    }
  } catch {
    // 무시
  }
}

export function getOfflineActiveBabyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_BABY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveOfflineFavoriteSnapshot(babyId: string, recipe: RecipeDetailView) {
  const all = readAllEntries().filter(
    (entry) => !(entry.babyId === babyId && entry.recipe.id === recipe.id),
  );
  all.unshift({
    babyId,
    savedAtIso: new Date().toISOString(),
    recipe: { ...recipe, isFavorite: true },
  });
  const trimmed = all.slice(0, 60);
  writeAllEntries(trimmed);
  postSwMessage({ type: "CACHE_FAVORITE_URL", url: `/recipes/${recipe.id}` });
  postSwMessage({ type: "CACHE_FAVORITE_URL", url: "/offline" });
}

export async function syncFavoriteSnapshotById(
  babyId: string,
  recipeId: string,
  isFavorite: boolean,
): Promise<void> {
  if (!isFavorite) {
    removeOfflineFavoriteSnapshot(babyId, recipeId);
    return;
  }

  try {
    const res = await fetch(
      `/api/recipes/${encodeURIComponent(recipeId)}?babyId=${encodeURIComponent(babyId)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.recipe) {
        saveOfflineFavoriteSnapshot(babyId, data.recipe as RecipeDetailView);
      }
    }
  } catch {
    // 오프라인 상태에서는 기존 스냅샷 유지
  }
}

export function removeOfflineFavoriteSnapshot(babyId: string, recipeId: string) {
  const next = readAllEntries().filter(
    (entry) => !(entry.babyId === babyId && entry.recipe.id === recipeId),
  );
  writeAllEntries(next);
  postSwMessage({ type: "REMOVE_FAVORITE_URL", url: `/recipes/${recipeId}` });
}

/** 신고 누적 등으로 비노출된 레시피를 모든 아기 프로필 오프라인 캐시에서 즉시 제거 */
export function removeOfflineRecipeEverywhere(recipeId: string) {
  const next = readAllEntries().filter((entry) => entry.recipe.id !== recipeId);
  writeAllEntries(next);
  postSwMessage({ type: "REMOVE_FAVORITE_URL", url: `/recipes/${recipeId}` });
}

/** 삭제된 아기 프로필의 오프라인 즐겨찾기 캐시 정리 */
export function removeOfflineFavoritesForBaby(babyId: string) {
  const next = readAllEntries().filter((entry) => entry.babyId !== babyId);
  writeAllEntries(next);
}

/** 온라인 전체 즐겨찾기 목록과 대조해 비노출(PENDING_REGEN/HIDDEN) 전환된 항목을 오프라인 캐시에서 정리 */
export function pruneInactiveOfflineFavorites(
  babyId: string,
  activeFavoriteRecipeIds: readonly string[],
) {
  const activeSet = new Set(activeFavoriteRecipeIds);
  const all = readAllEntries();
  const next = all.filter((entry) => {
    if (entry.babyId !== babyId) return true;
    const keep = activeSet.has(entry.recipe.id);
    if (!keep) {
      postSwMessage({ type: "REMOVE_FAVORITE_URL", url: `/recipes/${entry.recipe.id}` });
    }
    return keep;
  });
  if (next.length !== all.length) {
    writeAllEntries(next);
  }
  syncSwAllowedUrlsForBaby(babyId, next);
}

export function listOfflineFavorites(babyId?: string | null): OfflineFavoriteEntry[] {
  const targetBabyId = babyId ?? getOfflineActiveBabyId();
  if (!targetBabyId) return [];
  return readAllEntries().filter((entry) => entry.babyId === targetBabyId);
}

export function getOfflineFavoriteRecipe(
  recipeId: string,
  babyId?: string | null,
): RecipeDetailView | null {
  const targetBabyId = babyId ?? getOfflineActiveBabyId();
  if (!targetBabyId) return null;
  const match = readAllEntries().find(
    (entry) => entry.recipe.id === recipeId && entry.babyId === targetBabyId,
  );
  return match?.recipe ?? null;
}

/**
 * 아기의 현재 제외 알레르기 코드·직접 식재료·의심 식재료 집합과 충돌하는 오프라인 캐시 레시피를 즉시 정화하고,
 * 서비스 워커 캐시도 현재 활성 아기의 안전 즐겨찾기 URL만 남기도록 동기화한다.
 */
export function purgeUnsafeOfflineFavorites(
  babyId: string,
  filterOrCodes: OfflineAllergyPurgeFilter | readonly string[],
) {
  const normalized: OfflineAllergyPurgeFilter = Array.isArray(filterOrCodes)
    ? { excludedAllergenCodes: filterOrCodes }
    : (filterOrCodes as OfflineAllergyPurgeFilter);

  const blockedCodes = new Set(normalized.excludedAllergenCodes ?? []);
  const blockedIngredientIds = new Set(normalized.excludedIngredientIds ?? []);
  const blockedIngredientNames = new Set(
    (normalized.excludedIngredientNames ?? []).map((n) => n.trim()).filter(Boolean),
  );

  const all = readAllEntries();
  let mutated = false;

  const safe: OfflineFavoriteEntry[] = [];
  for (const entry of all) {
    if (entry.babyId !== babyId) {
      safe.push(entry);
      continue;
    }

    const hasAllergenConflict =
      blockedCodes.size > 0 && entry.recipe.allergens.some((a) => blockedCodes.has(a.code));
    const hasIngredientConflict =
      (blockedIngredientIds.size > 0 || blockedIngredientNames.size > 0) &&
      entry.recipe.ingredients.some(
        (ing) =>
          blockedIngredientIds.has(ing.ingredientId) ||
          blockedIngredientNames.has(ing.name.trim()),
      );

    if (hasAllergenConflict || hasIngredientConflict) {
      mutated = true;
      postSwMessage({ type: "REMOVE_FAVORITE_URL", url: `/recipes/${entry.recipe.id}` });
      continue;
    }

    if (blockedIngredientNames.size > 0) {
      let subMutated = false;
      const sanitizedIngredients = entry.recipe.ingredients.map((ing) => {
        if (ing.substituteName && blockedIngredientNames.has(ing.substituteName.trim())) {
          subMutated = true;
          return { ...ing, substituteName: null };
        }
        return ing;
      });
      if (subMutated) {
        mutated = true;
        safe.push({
          ...entry,
          recipe: { ...entry.recipe, ingredients: sanitizedIngredients },
        });
        continue;
      }
    }

    safe.push(entry);
  }

  if (mutated) {
    writeAllEntries(safe);
  }

  syncSwAllowedUrlsForBaby(babyId, safe);
}

/** 로그아웃·탈퇴 시 오프라인 저장소 및 서비스워커 개인 캐시 즉시 삭제 */
export function clearAllOfflineFavorites() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_BABY_STORAGE_KEY);
    } catch {
      // 무시
    }
  }
  postSwMessage({ type: "CLEAR_PRIVATE_CACHES" });
}
