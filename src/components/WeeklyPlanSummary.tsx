import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { kstDateString } from "@/lib/age";

export async function WeeklyPlanSummary({ userId, babyId }: { userId: string; babyId: string }) {
  const today = kstDateString(new Date());
  const plan = await getPrisma().mealPlan.findFirst({
    where: {
      userId,
      babyId,
      status: "CONFIRMED",
      entries: { some: { date: new Date(`${today}T00:00:00Z`) } },
    },
    include: {
      entries: {
        where: { date: new Date(`${today}T00:00:00Z`), kind: "HOME" },
        orderBy: { mealTime: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {plan ? "오늘의 계획" : "이번 주 식단"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {plan
              ? plan.entries.map((e) => `${e.served ? "✓ " : ""}${e.name}`).join(" · ") ||
                "오늘은 집에서 준비할 식사가 없어요."
              : "식단부터 남은 음식까지 한곳에서"}
          </p>
        </div>
        <Link
          href="/meal-plan"
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white"
        >
          {plan ? "주간 식단 보기" : "식단 짜기"}
        </Link>
      </div>
    </section>
  );
}
