/**
 * 내 냉장고 재료 보관 및 요리 완료 시 사용 재료 차감 도메인 (PRD 3.5 ING-07)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { IngredientOptionView } from "@/features/ingredient-search";
import { type BabyProfileView, buildBabyAllergyFilter } from "@/features/profile";
import { kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import type { IngredientInfo } from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import { checkAllergyConflicts } from "@/lib/safety";

export const savePantryInputSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).max(50),
});

export const deductPantryInputSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).min(1, "차감할 재료를 1개 이상 선택해 주세요.").max(30),
});

export interface PantryItemView extends IngredientOptionView {
  addedDate: string;
}

/** 사용자의 내 냉장고 재료 목록 조회 (활성 아기가 지정된 경우 해당 아기 알레르기 충돌 재료는 자동 제외) */
export async function listPantryItemsForUser(
  userId: string,
  activeBaby: BabyProfileView | null = null,
  prisma: PrismaClient = getPrisma(),
): Promise<PantryItemView[]> {
  const rows = await prisma.pantryItem.findMany({
    where: { userId },
    include: { ingredient: true },
    orderBy: [{ addedAt: "desc" }, { ingredient: { name: "asc" } }],
  });

  const validRows = rows.filter((r) => r.ingredient.minAgeMonth <= 48);
  if (!activeBaby) {
    return validRows.map((r) => ({
      id: r.ingredient.id,
      slug: r.ingredient.slug,
      name: r.ingredient.name,
      synonyms: r.ingredient.synonyms,
      isPantryBasic: r.ingredient.isPantryBasic,
      addedDate: kstDateString(r.addedAt),
    }));
  }

  const dictMap = new Map<string, IngredientInfo>(
    validRows.map((r) => [
      r.ingredient.id,
      {
        id: r.ingredient.id,
        name: r.ingredient.name,
        synonyms: r.ingredient.synonyms,
        group: r.ingredient.group,
        allergens: r.ingredient.allergens,
        minAgeMonth: r.ingredient.minAgeMonth,
        sodiumMgPer100g: r.ingredient.sodiumMgPer100g,
        gramsPerPiece: r.ingredient.gramsPerPiece,
        densityGPerMl: r.ingredient.densityGPerMl,
        isSaltySeasoning: r.ingredient.isSaltySeasoning,
        cautionNote: r.ingredient.cautionNote,
      },
    ]),
  );

  const allergyFilter = buildBabyAllergyFilter(activeBaby);

  return validRows
    .filter(
      (r) =>
        !checkAllergyConflicts([{ ingredientId: r.ingredient.id }], dictMap, allergyFilter)
          .hasConflict,
    )
    .map((r) => ({
      id: r.ingredient.id,
      slug: r.ingredient.slug,
      name: r.ingredient.name,
      synonyms: r.ingredient.synonyms,
      isPantryBasic: r.ingredient.isPantryBasic,
      addedDate: kstDateString(r.addedAt),
    }));
}

/** ING-07: 선택한 재료 목록을 내 냉장고에 저장(전체 동기화) */
export async function saveUserPantryItems(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{ savedCount: number }> {
  const input = savePantryInputSchema.parse(rawInput);
  const uniqueIds = Array.from(new Set(input.ingredientIds));

  if (uniqueIds.length > 0) {
    const validCount = await prisma.ingredient.count({
      where: { id: { in: uniqueIds }, minAgeMonth: { lte: 48 } },
    });
    if (validCount !== uniqueIds.length) {
      throw new AppError(400, "INVALID_INGREDIENT", "유효하지 않은 식재료가 포함되어 있습니다.");
    }
  }

  const addedAt = new Date(`${kstDateString(now)}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    await tx.pantryItem.deleteMany({ where: { userId } });
    if (uniqueIds.length > 0) {
      await tx.pantryItem.createMany({
        data: uniqueIds.map((ingredientId) => ({
          userId,
          ingredientId,
          addedAt,
        })),
        skipDuplicates: true,
      });
    }
  });

  return { savedCount: uniqueIds.length };
}

/** ING-07: 요리 완료 시 사용한 재료를 내 냉장고에서 선택 차감 */
export async function deductUserPantryItems(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
): Promise<{ deductedCount: number; remainingCount: number }> {
  const input = deductPantryInputSchema.parse(rawInput);
  const uniqueIds = Array.from(new Set(input.ingredientIds));

  const deleted = await prisma.pantryItem.deleteMany({
    where: {
      userId,
      ingredientId: { in: uniqueIds },
    },
  });

  const remainingCount = await prisma.pantryItem.count({ where: { userId } });

  return {
    deductedCount: deleted.count,
    remainingCount,
  };
}
