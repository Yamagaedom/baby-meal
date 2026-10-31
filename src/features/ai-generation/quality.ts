/**
 * 품질 피드백 루프 (PRD 3.9 AI-13)
 * - 먹은 기록(GOOD / OK / REFUSED) 및 사용자 신고(Report) 건수를 집계해 Recipe.qualityScore에 반영한다.
 * - 낮은 점수 레시피는 추천 정렬에서 자동으로 순위가 하향된다.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";

export function calculateQualityScoreFromCounts(counts: {
  goodCount: number;
  okCount: number;
  refusedCount: number;
  reportCount: number;
}): number {
  const raw =
    counts.goodCount * 1.2 +
    counts.okCount * 0.25 -
    counts.refusedCount * 0.9 -
    counts.reportCount * 3.0;
  return Math.round(raw * 100) / 100;
}

export async function recomputeRecipeQualityScore(
  recipeId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<number> {
  const [logs, reportCount] = await Promise.all([
    prisma.mealLog.findMany({
      where: { recipeId },
      select: { rating: true },
    }),
    prisma.report.count({
      where: { recipeId },
    }),
  ]);

  let goodCount = 0;
  let okCount = 0;
  let refusedCount = 0;
  for (const l of logs) {
    if (l.rating === "GOOD") goodCount += 1;
    else if (l.rating === "OK") okCount += 1;
    else refusedCount += 1;
  }

  const qualityScore = calculateQualityScoreFromCounts({
    goodCount,
    okCount,
    refusedCount,
    reportCount,
  });

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { qualityScore },
  });

  return qualityScore;
}
