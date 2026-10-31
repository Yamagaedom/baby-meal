import { redirect } from "next/navigation";
import { MealPlannerClient } from "@/components/MealPlannerClient";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { getPlannerData } from "@/features/meal-plan/service";
import { resolveActiveBabyProfile } from "@/features/profile";

export default async function MealPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const baby = await resolveActiveBabyProfile(user.id, {
    cookieBabyId: await getActiveBabyIdCookie(),
  });
  if (!baby) redirect("/onboarding");
  const params = await searchParams;
  const ingredientIds = typeof params.ingredients === "string" ? params.ingredients.split(",") : [];
  const recipeId = typeof params.recipe === "string" ? params.recipe : undefined;
  return (
    <MealPlannerClient
      key={baby.id}
      baby={baby}
      initialData={await getPlannerData(user.id, baby)}
      initialIngredients={ingredientIds}
      initialRecipeId={recipeId}
    />
  );
}
