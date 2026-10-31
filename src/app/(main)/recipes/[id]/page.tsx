import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipeDetailClient } from "@/components/RecipeDetailClient";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { listPantryItemsForUser } from "@/features/pantry";
import { resolveActiveBabyProfile } from "@/features/profile";
import { type RecipeDetailView, getRecipeDetailForBaby } from "@/features/recipe";
import { AppError } from "@/lib/http/errors";

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

  if (!baby) {
    redirect("/onboarding");
  }

  const { id } = await params;

  let recipe: RecipeDetailView | null = null;
  let blockedMessage: string | null = null;

  try {
    recipe = await getRecipeDetailForBaby(user.id, baby, id);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "ALLERGY_BLOCKED") {
        blockedMessage = error.userMessage;
      } else if (error.status === 404) {
        notFound();
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (blockedMessage) {
    // REC-02: 직접 URL 접근 시에도 레시피 이름·재료·본문을 일절 노출하지 않고 차단 안내만 표시
    return (
      <section
        role="alert"
        data-testid="allergy-blocked-notice"
        className="mx-auto max-w-xl rounded-lg border-2 border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-7 text-center"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-white text-2xl shadow-none"
        ></div>
        <h1 className="mt-3 text-lg font-semibold text-[var(--color-danger-text)]">
          알레르기 안전 정책에 의해 열람이 차단된 레시피입니다
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-danger-text)]">
          {blockedMessage}
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            안전한 추천 메뉴로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  if (!recipe) {
    notFound();
  }

  const pantryItems = await listPantryItemsForUser(user.id, baby);
  const initialPantryIngredientIds = pantryItems.map((p) => p.id);

  return (
    <RecipeDetailClient
      key={`${baby.id}:${recipe.id}`}
      babyId={baby.id}
      recipe={recipe}
      initialPantryIngredientIds={initialPantryIngredientIds}
    />
  );
}
