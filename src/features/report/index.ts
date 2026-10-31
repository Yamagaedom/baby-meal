/**
 * 레시피 신고 도메인 (PRD 3.9 AI-12, AI-13)
 * - 같은 사용자·같은 레시피 중복 신고 방지
 * - "위험 재료(UNSAFE_INGREDIENT)" 신고 1건 또는 일반 신고 3건 누적 시 즉시 비노출·재생성 대기 큐(PENDING_REGEN) 전환
 * - 신고 접수 시 레시피 qualityScore 즉시 갱신 (AI-13)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { recomputeRecipeQualityScore } from "@/features/ai-generation/quality";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { isValidUuid } from "@/lib/validation";

export const REPORT_REASON_LABELS = {
  WRONG_PORTION: "분량이 이상해요",
  UNSAFE_INGREDIENT: "아기에게 위험한 재료가 있어요",
  BAD_TASTE: "아기가 먹기 힘든 맛/조리법이에요",
  OTHER: "기타 오류",
} as const;

export const reportRecipeInputSchema = z.object({
  reason: z.enum(["WRONG_PORTION", "UNSAFE_INGREDIENT", "BAD_TASTE", "OTHER"]),
  memo: z.string().trim().max(300, "메모는 300자 이하로 입력해 주세요.").optional(),
});

export const AUTO_HIDE_REPORT_THRESHOLD = 3;

export async function submitRecipeReport(
  userId: string,
  recipeId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<{ hiddenNow: boolean; queuedForRegen: boolean; totalReports: number }> {
  const input = reportRecipeInputSchema.parse(rawInput);

  if (!isValidUuid(recipeId)) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, status: true },
  });

  if (!recipe) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const duplicate = await prisma.report.findUnique({
    where: {
      recipeId_userId: { recipeId, userId },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(409, "DUPLICATE_REPORT", "이미 신고한 레시피입니다.");
  }

  const out = await prisma.$transaction(async (tx) => {
    await tx.report.create({
      data: {
        recipeId,
        userId,
        reason: input.reason,
        memo: input.memo || null,
      },
    });

    const totalReports = await tx.report.count({ where: { recipeId } });
    const shouldHide =
      input.reason === "UNSAFE_INGREDIENT" || totalReports >= AUTO_HIDE_REPORT_THRESHOLD;

    if (shouldHide && recipe.status === "ACTIVE") {
      await tx.recipe.update({
        where: { id: recipeId },
        data: { status: "PENDING_REGEN" },
      });
    }

    return {
      hiddenNow: shouldHide,
      queuedForRegen: shouldHide,
      totalReports,
    };
  });

  await recomputeRecipeQualityScore(recipeId, prisma);
  return out;
}

/** AI-12: 신고 누적으로 비노출되어 재생성 대기 중인 레시피 큐 조회 */
export async function listPendingRegenerationRecipes(prisma: PrismaClient = getPrisma()) {
  const rows = await prisma.recipe.findMany({
    where: { status: "PENDING_REGEN" },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      ageStages: true,
      saltLevel: true,
      _count: { select: { reports: true } },
    },
    orderBy: { generatedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    ageStages: row.ageStages,
    saltLevel: row.saltLevel,
    reportCount: row._count.reports,
  }));
}
