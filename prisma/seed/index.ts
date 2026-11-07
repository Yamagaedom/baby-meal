/**
 * DB 시드 실행기 (`npm run db:seed`)
 * 1. 식재료 사전 220종 적재 (배치 처리)
 * 2. 샘플 레시피 30개 안전 검증(lib/safety.validateRecipeSafety) 통과 확인 후 적재
 * 3. 개발용 테스트 계정 1개 생성 (loginId: testparent1)
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import type { IngredientInfo } from "../../src/lib/domain/types";
import { validateRecipeSafety } from "../../src/lib/safety";
import { computeRecipeNutrition } from "../../src/features/nutrition";
import { SEED_INGREDIENTS } from "./ingredients";
import { SEED_RECIPES } from "./recipes";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
  }

  const pool = new Pool({ connectionString, max: 1 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log(`[seed] 식재료 사전 ${SEED_INGREDIENTS.length}종 적재 시작...`);

    // 기존 행도 알레르기·주의 문구 변경이 반영되도록 upsert (PGlite 단일 연결 호환을 위해 순차 실행)
    for (const item of SEED_INGREDIENTS) {
      const payload = {
        name: item.name,
        synonyms: item.synonyms,
        group: item.group,
        allergenType: item.allergens.length > 0 ? item.allergens.join(",") : null,
        allergens: item.allergens,
        isPantryBasic: item.isPantryBasic ?? false,
        isSaltySeasoning: item.isSaltySeasoning ?? false,
        minAgeMonth: item.minAgeMonth,
        sodiumMgPer100g: item.sodiumMgPer100g,
        gramsPerPiece: item.gramsPerPiece ?? null,
        densityGPerMl: item.densityGPerMl ?? 1.0,
        cautionNote: item.cautionNote ?? null,
      };
      await prisma.ingredient.upsert({
        where: { slug: item.slug },
        update: payload,
        create: { slug: item.slug, ...payload },
      });
    }

    const dbIngredients = await prisma.ingredient.findMany();
    const slugToDbIngredient = new Map<string, IngredientInfo>();
    for (const saved of dbIngredients) {
      slugToDbIngredient.set(saved.slug, {
        id: saved.id,
        slug: saved.slug,
        nutrition: saved.nutrition,
        name: saved.name,
        synonyms: saved.synonyms,
        group: saved.group,
        allergens: saved.allergens,
        minAgeMonth: saved.minAgeMonth,
        sodiumMgPer100g: saved.sodiumMgPer100g,
        gramsPerPiece: saved.gramsPerPiece,
        densityGPerMl: saved.densityGPerMl,
        isSaltySeasoning: saved.isSaltySeasoning,
        cautionNote: saved.cautionNote,
      });
    }

    const dictById = new Map<string, IngredientInfo>(
      Array.from(slugToDbIngredient.values()).map((info) => [info.id, info]),
    );

    console.log(`[seed] 샘플 레시피 ${SEED_RECIPES.length}개 안전 검증 및 적재 시작...`);

    for (const recipe of SEED_RECIPES) {
      const existing = await prisma.recipe.findUnique({
        where: { slug: recipe.slug },
        select: { nutrition: true },
      });
      if (
        existing?.nutrition &&
        typeof existing.nutrition === "object" &&
        !Array.isArray(existing.nutrition) &&
        existing.nutrition.catalogRepairVersion
      ) {
        console.log(`[seed] 출처·재료 보완을 마친 레시피 유지: ${recipe.slug}`);
        continue;
      }
      const mappedIngredients = recipe.ingredients.map((ri) => {
        const found = slugToDbIngredient.get(ri.ingredientSlug);
        if (!found) {
          throw new Error(
            `[seed] 레시피(${recipe.slug})의 재료 slug(${ri.ingredientSlug})가 사전에 없습니다.`,
          );
        }
        const substitute = ri.substituteSlug
          ? slugToDbIngredient.get(ri.substituteSlug)
          : undefined;
        if (ri.substituteSlug && !substitute) {
          throw new Error(
            `[seed] 레시피(${recipe.slug})의 대체 재료 slug(${ri.substituteSlug})가 사전에 없습니다.`,
          );
        }
        return {
          ingredientId: found.id,
          amount: ri.amount,
          unit: ri.unit,
          prepNote: ri.prepNote ?? null,
          isOptional: ri.isOptional ?? false,
          substituteId: substitute?.id ?? null,
        };
      });

      const safety = validateRecipeSafety(
        {
          name: recipe.name,
          category: recipe.category,
          ageStages: recipe.ageStages,
          saltLevel: recipe.saltLevel,
          cookMinutes: recipe.cookMinutes,
          baseServings: recipe.baseServings,
          ingredients: mappedIngredients,
          steps: recipe.steps,
          storageInfo: recipe.storageInfo,
          sources: recipe.sources,
        },
        dictById,
      );

      if (!safety.passed) {
        const detail = safety.issues.map((i) => `[${i.code}] ${i.message}`).join("; ");
        throw new Error(`[seed] 샘플 레시피 안전 검증 실패 (${recipe.slug}): ${detail}`);
      }

      const nutrition = computeRecipeNutrition(mappedIngredients, dictById, recipe.baseServings);
      const hashVal = Math.abs(recipe.slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
      const qualityScore = 88 + (hashVal % 8);

      const upserted = await prisma.recipe.upsert({
        where: { slug: recipe.slug },
        update: {
          name: recipe.name,
          summary: recipe.summary,
          category: recipe.category,
          mealCategories: recipe.mealCategories,
          mealRole: recipe.mealRole ?? (recipe.category === "SNACK" ? "SNACK" : "MAIN"),
          ageStages: recipe.ageStages,
          saltLevel: recipe.saltLevel,
          cookMinutes: recipe.cookMinutes,
          difficulty: recipe.difficulty,
          tools: recipe.tools,
          baseServings: recipe.baseServings,
          sodiumMgPerServing: safety.computedSodiumMgPerServing,
          allergens: safety.derivedAllergens,
          steps: recipe.steps,
          babyTips: recipe.babyTips,
          storageInfo: recipe.storageInfo,
          status: "ACTIVE",
          isAiGenerated: false,
          nutrition: nutrition as unknown as Prisma.InputJsonValue,
          qualityScore,
        },
        create: {
          slug: recipe.slug,
          name: recipe.name,
          summary: recipe.summary,
          category: recipe.category,
          mealCategories: recipe.mealCategories,
          mealRole: recipe.mealRole ?? (recipe.category === "SNACK" ? "SNACK" : "MAIN"),
          ageStages: recipe.ageStages,
          saltLevel: recipe.saltLevel,
          cookMinutes: recipe.cookMinutes,
          difficulty: recipe.difficulty,
          tools: recipe.tools,
          baseServings: recipe.baseServings,
          sodiumMgPerServing: safety.computedSodiumMgPerServing,
          allergens: safety.derivedAllergens,
          steps: recipe.steps,
          babyTips: recipe.babyTips,
          storageInfo: recipe.storageInfo,
          status: "ACTIVE",
          isAiGenerated: false,
          nutrition: nutrition as unknown as Prisma.InputJsonValue,
          favoriteCount: 0,
          averageRating: 0.0,
          reviewCount: 0,
          qualityScore,
        },
      });

      await prisma.recipeIngredient.deleteMany({ where: { recipeId: upserted.id } });
      await prisma.recipeIngredient.createMany({
        data: mappedIngredients.map((mi) => ({
          recipeId: upserted.id,
          ingredientId: mi.ingredientId,
          amount: mi.amount,
          unit: mi.unit,
          prepNote: mi.prepNote,
          isOptional: mi.isOptional,
          substituteId: mi.substituteId,
        })),
      });

      await prisma.recipeSource.deleteMany({ where: { recipeId: upserted.id } });
      await prisma.recipeSource.createMany({
        data: recipe.sources.map((src) => ({
          recipeId: upserted.id,
          url: src.url,
          title: src.title,
          channelOrSite: src.channelOrSite,
          sourceType: src.sourceType,
          trustScore: src.trustScore,
          verificationStatus: "VERIFIED",
          verifiedAt: new Date("2026-11-01T00:00:00+09:00"),
        })),
      });
    }

    // 3. 개발용 테스트 계정 1개 생성 (비밀번호·복구코드는 argon2 단방향 해시 저장 — ACC-03, ACC-04)
    const passwordHash = await hash("test1234");
    const recoveryCodeHash = await hash("TEST-RECOVERY-0001");

    const testUser = await prisma.user.upsert({
      where: { loginId: "testparent1" },
      update: {
        passwordHash,
        recoveryCodeHash,
      },
      create: {
        loginId: "testparent1",
        passwordHash,
        recoveryCodeHash,
      },
    });

    const existingBabies = await prisma.baby.count({ where: { userId: testUser.id } });
    if (existingBabies === 0) {
      const baby = await prisma.baby.create({
        data: {
          userId: testUser.id,
          nickname: "튼튼이",
          ageMonthAtInput: 18,
          ageInputDate: new Date("2026-10-01"),
          saltLevel: "NONE",
        },
      });
      await prisma.allergy.create({
        data: {
          babyId: baby.id,
          allergenType: "EGG",
          status: "CONFIRMED",
        },
      });
    }

    const [ingredientTotal, recipeTotal, userTotal] = await Promise.all([
      prisma.ingredient.count(),
      prisma.recipe.count(),
      prisma.user.count(),
    ]);

    console.log(
      `[seed] 완료 — 식재료 ${ingredientTotal}종, 레시피 ${recipeTotal}개, 사용자 ${userTotal}명`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] 실패:", err);
  process.exit(1);
});
