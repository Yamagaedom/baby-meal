import "dotenv/config";
import supplement from "../src/data/recipe-style-supplement.json";
import { getPrisma } from "../src/lib/db";
import { loadIngredientDictionaryMap } from "../src/features/recipe";
import { validateRecipeSafety } from "../src/lib/safety";
import type { AgeStage } from "../src/lib/domain/types";

async function main() {
  const db = getPrisma();
  const dictionary = await loadIngredientDictionaryMap(db);
  const rows = await db.ingredient.findMany();
  let inserted = 0;
  for (const item of supplement) {
    if (await db.recipe.findUnique({ where: { slug: item.slug } })) continue;
    const reference = await db.recipe.findUnique({
      where: { slug: item.referenceSlug },
      include: { sources: true },
    });
    const source = reference?.sources.find((s) => s.verificationStatus === "VERIFIED");
    if (!reference || !source)
      throw new Error(`Missing reviewed ingredient-combination reference: ${item.referenceSlug}`);
    const ingredients = Object.entries(item.ingredients).map(([slug, amount]) => {
      const ingredient = rows.find((i) => i.slug === slug);
      if (!ingredient || typeof amount !== "number") throw new Error(`Missing ingredient: ${slug}`);
      return {
        ingredientId: ingredient.id,
        amount,
        unit: slug === "water" || slug === "soy-milk-unsweetened" ? "ml" : "g",
        isOptional: false,
      };
    });
    const allergens = [
      ...new Set(ingredients.flatMap((i) => dictionary.get(i.ingredientId)!.allergens)),
    ];
    const steps = [
      "재료의 껍질·씨·뼈·질긴 부분과 이물질을 제거하고 아기가 먹을 수 있도록 잘게 다집니다. 육류가 있으면 채소와 분리해 손질합니다.",
      "냄비에 표시된 재료와 물을 넣고 끓입니다. 육류는 속까지 완전히 익히고 채소가 쉽게 으깨질 만큼 부드럽게 익힙니다. 수분이 부족하면 타지 않도록 물을 조금 보충합니다.",
      item.dishType === "SOUP"
        ? "익힌 재료를 으깨 부드러운 수프 형태로 만들고 농도를 조절합니다. 뜨거운 상태에서 믹서 용기를 밀폐하지 않습니다."
        : "재료를 부드럽게 으깨거나 다져 반찬으로 나눠 담습니다. 소금·간장·치즈를 추가하지 않습니다.",
      "먹기 좋은 온도로 식히고 식감·크기를 확인합니다. 2회분 기준 레시피이며 먹을 양과 만들 양을 별도로 조절하세요.",
    ].map((instruction, i) => ({ order: i + 1, instruction }));
    const storageInfo = {
      fridgeDays: null,
      freezerDays: null,
      reheatTip: "실제 보관 상태와 사용 기한을 확인한 뒤 속까지 충분히 데우고 식혀 주세요.",
      portionTip:
        "소분 후 보관 장소와 사용 기한을 직접 확인해 기록하세요. 조리 주기가 보관 가능 기간을 뜻하지 않습니다.",
    };
    const report = validateRecipeSafety(
      {
        name: item.name,
        category: "MEAL",
        ageStages: item.ageStages as AgeStage[],
        saltLevel: "NONE",
        cookMinutes: 25,
        baseServings: 2,
        declaredAllergens: allergens,
        ingredients,
        steps,
        storageInfo,
        sources: [{ url: source.url, title: source.title }],
      },
      dictionary,
    );
    if (!report.passed) throw new Error(`Safety rejected ${item.slug}: ${JSON.stringify(report)}`);
    await db.recipe.create({
      data: {
        slug: item.slug,
        name: item.name,
        summary: item.sourceScope,
        category: "MEAL",
        mealRole: item.dishType === "SIDE" ? "SIDE" : "SOUP",
        mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
        ageStages: item.ageStages,
        saltLevel: "NONE",
        cookMinutes: 25,
        difficulty: 1,
        tools: ["냄비"],
        baseServings: 2,
        sodiumMgPerServing: report.computedSodiumMgPerServing,
        allergens,
        isAiGenerated: true,
        qualityScore: 75,
        steps,
        babyTips: {
          textureTip: "충분히 익혀 부드럽게 으깨고 아기의 씹는 능력에 맞춰 주세요.",
          cuttingSizeTip: "질긴 부분과 큰 덩어리를 제거하고 먹을 수 있는 크기인지 확인하세요.",
          seasoningTip: "소금·간장·치즈를 추가하지 않는 응용 레시피입니다.",
          stageVariations: {},
        },
        storageInfo,
        ingredients: { create: ingredients },
        sources: {
          create: {
            url: source.url,
            title: `재료 조합 참고 · ${source.title}`,
            channelOrSite: source.channelOrSite,
            sourceType: source.sourceType,
            verificationStatus: "VERIFIED",
            verifiedAt: source.verifiedAt,
            trustScore: source.trustScore,
          },
        },
      },
    });
    inserted++;
  }
  console.log(`Meal style supplement: ${inserted} new recipes; existing recipes retained.`);
  await db.$disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
