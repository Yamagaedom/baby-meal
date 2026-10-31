import { redirect } from "next/navigation";
import { MealLogsClient } from "@/components/MealLogsClient";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { getMealLogsForBaby } from "@/features/meal-log";
import { resolveActiveBabyProfile } from "@/features/profile";
import { kstDateString } from "@/lib/age";

export default async function LogsPage() {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

  if (!baby) {
    redirect("/onboarding");
  }

  const initialYearMonth = kstDateString(new Date()).slice(0, 7);
  const data = await getMealLogsForBaby(baby, { yearMonth: initialYearMonth });

  return (
    <MealLogsClient
      key={baby.id}
      babyId={baby.id}
      babyName={baby.displayName}
      initialYearMonth={initialYearMonth}
      initialCalendarByDate={data.calendarByDate}
      initialByRecipe={data.byRecipe}
      initialTasteReport={data.tasteReport}
    />
  );
}
