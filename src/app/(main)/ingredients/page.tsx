import { redirect } from "next/navigation";
import { IngredientSearchClient } from "@/components/IngredientSearchClient";
import { getAiQuotaStatus } from "@/features/ai-generation";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { searchIngredientsForBaby } from "@/features/ingredient-search";
import { listPantryItemsForUser } from "@/features/pantry";
import { resolveActiveBabyProfile } from "@/features/profile";

export default async function IngredientsPage() {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

  if (!baby) {
    redirect("/onboarding");
  }

  const [{ popularChips }, initialPantryItems, initialQuota] = await Promise.all([
    searchIngredientsForBaby(baby, ""),
    listPantryItemsForUser(user.id, baby),
    getAiQuotaStatus(user.id),
  ]);

  return (
    <IngredientSearchClient
      key={baby.id}
      babyId={baby.id}
      babyName={baby.displayName}
      babySaltLevel={baby.saltLevel}
      initialPopularChips={popularChips}
      initialPantryItems={initialPantryItems}
      initialQuota={initialQuota}
    />
  );
}
