import { redirect } from "next/navigation";
import { HomeRecommendClient } from "@/components/HomeRecommendClient";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { getTasteReportForBaby } from "@/features/meal-log";
import { resolveActiveBabyProfile } from "@/features/profile";
import { getTodayRecommendations } from "@/features/recommend";

export default async function HomePage() {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

  if (!baby) {
    redirect("/onboarding");
  }

  const [initialData, tasteReport] = await Promise.all([
    getTodayRecommendations(user.id, baby),
    getTasteReportForBaby(baby),
  ]);

  return (
    <HomeRecommendClient
      key={baby.id}
      baby={baby}
      initialData={initialData}
      recentGoodMenus={tasteReport.topMenus}
    />
  );
}
