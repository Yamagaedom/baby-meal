import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { validateRecipeSafety } from "@/lib/safety";
import type { IngredientInfo } from "@/lib/domain/types";
import { SEED_RECIPES } from "../../../../../prisma/seed/recipes";

export const maxDuration = 60; // 60s for Vercel functions

export async function POST() {
  const prisma = getPrisma();

  try {
    const dbIngredients = await prisma.ingredient.findMany();
    const slugToDbIngredient = new Map<string, IngredientInfo>();
    for (const saved of dbIngredients) {
      slugToDbIngredient.set(saved.slug, {
        id: saved.id,
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

    let seededCount = 0;

    for (const recipe of SEED_RECIPES) {
      const mappedIngredients = recipe.ingredients.map((ri) => {
        const found = slugToDbIngredient.get(ri.ingredientSlug);
        if (!found) {
          throw new Error(`[seed] 식재료 slug(${ri.ingredientSlug})가 사전에 없습니다.`);
        }
        const substitute = ri.substituteSlug ? slugToDbIngredient.get(ri.substituteSlug) : undefined;
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
        throw new Error(`[seed] 안전 검증 실패: ${recipe.slug}`);
      }

      const upserted = await prisma.recipe.upsert({
        where: { slug: recipe.slug },
        update: {
          name: recipe.name,
          summary: recipe.summary,
          category: recipe.category,
          mealCategories: recipe.mealCategories,
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
        },
        create: {
          slug: recipe.slug,
          name: recipe.name,
          summary: recipe.summary,
          category: recipe.category,
          mealCategories: recipe.mealCategories,
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
      if (recipe.sources.length > 0) {
        await prisma.recipeSource.createMany({
          data: recipe.sources.map((src) => ({
            recipeId: upserted.id,
            url: src.url,
            title: src.title,
            channelOrSite: src.channelOrSite,
            sourceType: src.sourceType,
            trustScore: src.trustScore,
          })),
        });
      }

      seededCount++;
    }

    return NextResponse.json({
      status: "ok",
      seededCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[/api/admin/seed] 오류:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
