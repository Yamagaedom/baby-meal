import { redirect } from "next/navigation";
import { RecipesExplorerClient } from "@/components/RecipesExplorerClient";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { resolveActiveBabyProfile } from "@/features/profile";
import { searchRecipesForBaby } from "@/features/recommend";

export default async function RecipesPage() {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

  if (!baby) {
    redirect("/onboarding");
  }

  const initialItems = await searchRecipesForBaby(user.id, baby, {});

  return (
    <RecipesExplorerClient
      key={baby.id}
      babyId={baby.id}
      babySaltLevel={baby.saltLevel}
      initialItems={initialItems}
    />
  );
}
