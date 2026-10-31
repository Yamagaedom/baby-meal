/**
 * 아기 프로필 및 알레르기 관리 서비스 (PRD 3.2 PRF-01~06)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  currentAgeMonth,
  defaultSaltLevelForAge,
  getAgeStage,
  getAgeStageInfo,
  isOverMaxAge,
  kstDateString,
} from "@/lib/age";
import { getPrisma } from "@/lib/db";
import {
  ALLERGEN_LABELS,
  type AgeStage,
  type Allergen,
  type IngredientGroup,
  type SaltLevel,
} from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import { type BabyAllergyProfile, findIngredientByName } from "@/lib/safety";
import {
  allergenSchema,
  babyAgeMonthSchema,
  babyNicknameSchema,
  isValidUuid,
  saltLevelSchema,
} from "@/lib/validation";

export const MAX_BABIES_PER_USER = 5;

export const OVER_MAX_AGE_NOTICE =
  "지원 월령(48개월)이 종료되었습니다. 유아식 3단계 레시피는 계속 이용하실 수 있습니다.";

export const createBabyInputSchema = z.object({
  nickname: babyNicknameSchema,
  ageMonth: babyAgeMonthSchema,
  saltLevel: saltLevelSchema.optional(),
  allergens: z.array(allergenSchema).optional().default([]),
  ingredientIds: z.array(z.string().uuid()).optional().default([]),
  customAllergyTerms: z.array(z.string().trim().min(1).max(30)).optional().default([]),
});

export const updateBabyInputSchema = z.object({
  nickname: babyNicknameSchema,
  ageMonth: babyAgeMonthSchema.optional(),
  saltLevel: saltLevelSchema.optional(),
  allergens: z.array(allergenSchema).optional(),
  ingredientIds: z.array(z.string().uuid()).optional(),
  customAllergyTerms: z.array(z.string().trim().min(1).max(30)).optional(),
});

export interface BabyAllergyItemView {
  id: string;
  status: "CONFIRMED" | "SUSPECTED";
  allergenType: Allergen | null;
  ingredientId: string | null;
  ingredientName: string | null;
  derivedAllergens: Allergen[];
  label: string;
}

export interface BabyProfileView {
  id: string;
  nickname: string | null;
  displayName: string;
  ageMonthAtInput: number;
  ageInputDate: string;
  currentAgeMonth: number;
  ageStage: AgeStage;
  ageStageLabel: string;
  textureGuide: string;
  isOverMaxAge: boolean;
  overMaxAgeNotice: string | null;
  saltLevel: SaltLevel;
  allergies: BabyAllergyItemView[];
}

type BabyWithAllergiesRow = {
  id: string;
  userId: string;
  nickname: string | null;
  ageMonthAtInput: number;
  ageInputDate: Date;
  saltLevel: SaltLevel;
  allergies: {
    id: string;
    status: "CONFIRMED" | "SUSPECTED";
    allergenType: Allergen | null;
    ingredientId: string | null;
    ingredient: {
      id: string;
      name: string;
      group: IngredientGroup;
      allergens: Allergen[];
    } | null;
  }[];
};

const BABY_ALLERGY_INGREDIENT_SELECT = {
  id: true,
  name: true,
  group: true,
  allergens: true,
} as const;

function toBabyProfileView(row: BabyWithAllergiesRow, now: Date): BabyProfileView {
  const ageMonth = currentAgeMonth(row.ageMonthAtInput, row.ageInputDate, now);
  const stage = getAgeStage(ageMonth) ?? 1;
  const stageInfo = getAgeStageInfo(stage);
  const overMax = isOverMaxAge(ageMonth);

  const allergies: BabyAllergyItemView[] = row.allergies.map((a) => {
    const derivedAllergens: Allergen[] = a.allergenType
      ? [a.allergenType]
      : a.ingredient && a.ingredient.group !== "PROCESSED" && a.ingredient.allergens.length === 1
        ? [a.ingredient.allergens[0]]
        : [];
    return {
      id: a.id,
      status: a.status,
      allergenType: a.allergenType,
      ingredientId: a.ingredientId,
      ingredientName: a.ingredient?.name ?? null,
      derivedAllergens,
      label: a.ingredient?.name ?? (a.allergenType ? ALLERGEN_LABELS[a.allergenType] : "알 수 없음"),
    };
  });

  return {
    id: row.id,
    nickname: row.nickname,
    displayName: row.nickname?.trim() ? row.nickname.trim() : `${ageMonth}개월 아가`,
    ageMonthAtInput: row.ageMonthAtInput,
    ageInputDate: kstDateString(row.ageInputDate),
    currentAgeMonth: ageMonth,
    ageStage: stage,
    ageStageLabel: stageInfo.label,
    textureGuide: stageInfo.texture,
    isOverMaxAge: overMax,
    overMaxAgeNotice: overMax ? OVER_MAX_AGE_NOTICE : null,
    saltLevel: row.saltLevel,
    allergies,
  };
}

/** 아기 프로필에서 lib/safety 호환 알레르기 필터 객체 생성 (CONFIRMED + SUSPECTED 모두 포함) */
export function buildBabyAllergyFilter(baby: BabyProfileView): BabyAllergyProfile {
  const allergens: Allergen[] = [];
  const ingredientIds: string[] = [];
  const terms: string[] = [];

  for (const a of baby.allergies) {
    if (a.allergenType) allergens.push(a.allergenType);
    if (a.ingredientId) ingredientIds.push(a.ingredientId);
    if (a.ingredientName) terms.push(a.ingredientName);
  }

  return { allergens, ingredientIds, terms };
}

async function mapCustomTermsToIngredients(
  terms: string[],
  prisma: PrismaClient,
): Promise<{ mappedIngredientIds: string[]; unmappedTerms: string[] }> {
  if (terms.length === 0) {
    return { mappedIngredientIds: [], unmappedTerms: [] };
  }

  const allIngredients = await prisma.ingredient.findMany();
  const dict = allIngredients.map((i) => ({
    id: i.id,
    name: i.name,
    synonyms: i.synonyms,
    group: i.group,
    allergens: i.allergens,
    minAgeMonth: i.minAgeMonth,
    sodiumMgPer100g: i.sodiumMgPer100g,
    gramsPerPiece: i.gramsPerPiece,
    densityGPerMl: i.densityGPerMl,
    isSaltySeasoning: i.isSaltySeasoning,
    cautionNote: i.cautionNote,
  }));

  const mappedIngredientIds: string[] = [];
  const unmappedTerms: string[] = [];

  for (const term of terms) {
    const found = findIngredientByName(dict, term);
    if (found) {
      mappedIngredientIds.push(found.id);
    } else {
      unmappedTerms.push(term);
    }
  }

  return { mappedIngredientIds, unmappedTerms };
}

/** 소유권 검증 포함 아기 단건 조회 (타 계정 접근 시 403 반환) */
export async function getOwnedBabyOrThrow(
  userId: string,
  babyId: string,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<BabyProfileView> {
  if (!isValidUuid(babyId)) {
    throw new AppError(404, "BABY_NOT_FOUND", "아기 프로필을 찾을 수 없습니다.");
  }

  const row = await prisma.baby.findUnique({
    where: { id: babyId },
    include: {
      allergies: {
        include: { ingredient: { select: BABY_ALLERGY_INGREDIENT_SELECT } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) {
    throw new AppError(404, "BABY_NOT_FOUND", "아기 프로필을 찾을 수 없습니다.");
  }
  if (row.userId !== userId) {
    throw new AppError(403, "FORBIDDEN_BABY", "다른 계정의 아기 프로필에는 접근할 수 없습니다.");
  }

  return toBabyProfileView(row, now);
}

/** 사용자의 전체 아기 프로필 목록 조회 */
export async function listBabyProfiles(
  userId: string,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<BabyProfileView[]> {
  const rows = await prisma.baby.findMany({
    where: { userId },
    include: {
      allergies: {
        include: { ingredient: { select: BABY_ALLERGY_INGREDIENT_SELECT } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => toBabyProfileView(r, now));
}

/**
 * 활성 아기 프로필 결정:
 * - explicitBabyId가 주어지면 소유권 검증을 엄격히 수행(타 계정 ID면 403)
 * - 쿠키의 babyId가 삭제되었거나 없으면 첫 번째 아기로 폴백
 */
export async function resolveActiveBabyProfile(
  userId: string,
  options: { explicitBabyId?: string | null; cookieBabyId?: string | null } = {},
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<BabyProfileView | null> {
  if (options.explicitBabyId) {
    return getOwnedBabyOrThrow(userId, options.explicitBabyId, prisma, now);
  }

  const babies = await listBabyProfiles(userId, prisma, now);
  if (babies.length === 0) return null;

  if (options.cookieBabyId) {
    const matched = babies.find((b) => b.id === options.cookieBabyId);
    if (matched) return matched;
  }

  return babies[0];
}

/** PRF-01~06: 아기 프로필 생성 */
export async function createBabyProfile(
  userId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{ baby: BabyProfileView; warnings: string[] }> {
  const input = createBabyInputSchema.parse(rawInput);

  const count = await prisma.baby.count({ where: { userId } });
  if (count >= MAX_BABIES_PER_USER) {
    throw new AppError(
      400,
      "MAX_BABIES_REACHED",
      `아기 프로필은 최대 ${MAX_BABIES_PER_USER}명까지 등록할 수 있습니다.`,
    );
  }

  const { mappedIngredientIds, unmappedTerms } = await mapCustomTermsToIngredients(
    input.customAllergyTerms,
    prisma,
  );

  const uniqueAllergens = Array.from(new Set(input.allergens));
  const uniqueIngredientIds = Array.from(new Set([...input.ingredientIds, ...mappedIngredientIds]));

  if (uniqueIngredientIds.length > 0) {
    const validCount = await prisma.ingredient.count({
      where: { id: { in: uniqueIngredientIds } },
    });
    if (validCount !== uniqueIngredientIds.length) {
      throw new AppError(400, "INVALID_INGREDIENT", "등록되지 않은 식재료가 포함되어 있습니다.");
    }
  }

  const saltLevel = input.saltLevel ?? defaultSaltLevelForAge(input.ageMonth);
  const inputDate = new Date(`${kstDateString(now)}T00:00:00.000Z`);

  const created = await prisma.baby.create({
    data: {
      userId,
      nickname: input.nickname?.trim() || null,
      ageMonthAtInput: input.ageMonth,
      ageInputDate: inputDate,
      saltLevel,
      allergies: {
        create: [
          ...uniqueAllergens.map((allergenType) => ({
            allergenType,
            status: "CONFIRMED" as const,
          })),
          ...uniqueIngredientIds.map((ingredientId) => ({
            ingredientId,
            status: "CONFIRMED" as const,
          })),
        ],
      },
    },
    include: {
      allergies: {
        include: { ingredient: { select: BABY_ALLERGY_INGREDIENT_SELECT } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const warnings =
    unmappedTerms.length > 0
      ? [
          `식재료 사전에서 찾을 수 없는 입력은 제외되었습니다: ${unmappedTerms.join(", ")}. 자동완성 목록에서 선택해 주세요.`,
        ]
      : [];

  return {
    baby: toBabyProfileView(created, now),
    warnings,
  };
}

/** 아기 프로필 수정 */
export async function updateBabyProfile(
  userId: string,
  babyId: string,
  rawInput: unknown,
  prisma: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<{ baby: BabyProfileView; warnings: string[] }> {
  await getOwnedBabyOrThrow(userId, babyId, prisma, now);
  const input = updateBabyInputSchema.parse(rawInput);

  const warnings: string[] = [];
  let mappedFromCustom: string[] = [];

  if (input.customAllergyTerms) {
    const res = await mapCustomTermsToIngredients(input.customAllergyTerms, prisma);
    mappedFromCustom = res.mappedIngredientIds;
    if (res.unmappedTerms.length > 0) {
      warnings.push(
        `식재료 사전에서 찾을 수 없는 입력은 제외되었습니다: ${res.unmappedTerms.join(", ")}.`,
      );
    }
  }

  const hasAllergyUpdate =
    input.allergens !== undefined ||
    input.ingredientIds !== undefined ||
    input.customAllergyTerms !== undefined;

  const requestedAllergens = Array.from(new Set(input.allergens ?? []));
  const requestedIngredientIds = Array.from(
    new Set([...(input.ingredientIds ?? []), ...mappedFromCustom]),
  );

  if (hasAllergyUpdate && requestedIngredientIds.length > 0) {
    const validCount = await prisma.ingredient.count({
      where: { id: { in: requestedIngredientIds } },
    });
    if (validCount !== requestedIngredientIds.length) {
      throw new AppError(400, "INVALID_INGREDIENT", "등록되지 않은 식재료가 포함되어 있습니다.");
    }
  }

  const inputDate = new Date(`${kstDateString(now)}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    await tx.baby.update({
      where: { id: babyId },
      data: {
        ...(input.nickname !== undefined ? { nickname: input.nickname.trim() || null } : {}),
        ...(input.ageMonth !== undefined
          ? { ageMonthAtInput: input.ageMonth, ageInputDate: inputDate }
          : {}),
        ...(input.saltLevel !== undefined ? { saltLevel: input.saltLevel } : {}),
      },
    });

    if (hasAllergyUpdate) {
      await tx.allergy.deleteMany({ where: { babyId, status: "CONFIRMED" } });

      // 기존 SUSPECTED(의심) 항목 중 확정 알레르기(CONFIRMED)로 요청된 항목은 CONFIRMED로 승격
      if (requestedAllergens.length > 0) {
        await tx.allergy.updateMany({
          where: {
            babyId,
            status: "SUSPECTED",
            allergenType: { in: requestedAllergens },
          },
          data: { status: "CONFIRMED" },
        });
      }
      if (requestedIngredientIds.length > 0) {
        await tx.allergy.updateMany({
          where: {
            babyId,
            status: "SUSPECTED",
            ingredientId: { in: requestedIngredientIds },
          },
          data: { status: "CONFIRMED" },
        });
      }

      const existingRows = await tx.allergy.findMany({
        where: { babyId },
        select: { allergenType: true, ingredientId: true },
      });

      const remainingAllergens = requestedAllergens.filter(
        (a) => !existingRows.some((row) => row.allergenType === a),
      );
      const remainingIngredientIds = requestedIngredientIds.filter(
        (id) => !existingRows.some((row) => row.ingredientId === id),
      );

      if (remainingAllergens.length > 0 || remainingIngredientIds.length > 0) {
        await tx.allergy.createMany({
          data: [
            ...remainingAllergens.map((allergenType) => ({
              babyId,
              allergenType,
              status: "CONFIRMED" as const,
            })),
            ...remainingIngredientIds.map((ingredientId) => ({
              babyId,
              ingredientId,
              status: "CONFIRMED" as const,
            })),
          ],
          skipDuplicates: true,
        });
      }
    }
  });

  const updated = await getOwnedBabyOrThrow(userId, babyId, prisma, now);
  return { baby: updated, warnings };
}

/** 아기 프로필 삭제 (최소 1명의 아기 프로필 유지 보장) */
export async function deleteBabyProfile(
  userId: string,
  babyId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await getOwnedBabyOrThrow(userId, babyId, prisma);
  const totalBabies = await prisma.baby.count({ where: { userId } });
  if (totalBabies <= 1) {
    throw new AppError(
      400,
      "MIN_ONE_BABY_REQUIRED",
      "최소 1명의 아기 프로필은 유지되어야 합니다.",
    );
  }
  await prisma.baby.delete({ where: { id: babyId } });
}

/** LOG-04: 이상 반응 식재료를 알레르기 의심(SUSPECTED) 목록에 추가 */
export async function addSuspectedIngredientsToBaby(
  userId: string,
  babyId: string,
  ingredientIds: string[],
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await getOwnedBabyOrThrow(userId, babyId, prisma);
  const uniqueIds = Array.from(new Set(ingredientIds));
  if (uniqueIds.length === 0) return;

  await prisma.allergy.createMany({
    data: uniqueIds.map((ingredientId) => ({
      babyId,
      ingredientId,
      status: "SUSPECTED" as const,
    })),
    skipDuplicates: true,
  });
}

/** 개별 알레르기·의심 항목 삭제 */
export async function removeBabyAllergyItem(
  userId: string,
  babyId: string,
  allergyId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  await getOwnedBabyOrThrow(userId, babyId, prisma);
  if (!isValidUuid(allergyId)) {
    throw new AppError(404, "ALLERGY_NOT_FOUND", "알레르기 항목을 찾을 수 없습니다.");
  }
  await prisma.allergy.deleteMany({
    where: { id: allergyId, babyId },
  });
}
