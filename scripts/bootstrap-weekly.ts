import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import composition from "../src/data/food-composition.json";

// The primary page contains each referenced recipe, including its ingredients and method.
// Our portions, seasoning omissions and texture changes are adaptations, not the original recipe.
const sourceUrl = "https://www.foodsafetykorea.go.kr/api/newDatasetDetail.do?svc_no=COOKRCP01";
const starters = [
  {
    slug: "weekly-tofu-egg-rice",
    name: "두부달걀채소진밥",
    sourceId: 16,
    sourceName: "누룽지 두부 계란죽",
    category: "MEAL" as const,
    minutes: 20,
    changes: "누룽지 대신 지은 밥을 쓰고 소금·후추를 제외한 무염 응용입니다.",
    ingredients: {
      "white-rice-cooked": 150,
      "soft-tofu": 80,
      egg: 50,
      carrot: 20,
      "shiitake-mushroom": 10,
      water: 80,
    },
    steps: [
      "당근과 표고버섯을 아이가 먹기 쉽게 잘게 다집니다.",
      "냄비에 채소와 물을 넣고 충분히 부드러워질 때까지 익힙니다.",
      "밥과 순두부를 넣어 끓인 뒤 달걀을 풀어 넣고 완전히 익힙니다. 농도와 온도를 확인해 나눠 담습니다.",
    ],
  },
  {
    slug: "weekly-chicken-egg-rice",
    name: "닭가슴살달걀채소밥",
    sourceId: 11,
    sourceName: "저염 간장을 이용한 닭개장 비빔밥",
    category: "MEAL" as const,
    minutes: 25,
    changes:
      "삶은 닭고기·달걀·밥 조합을 참고하고 간장·고추기름·꿀·질긴 나물을 제외했습니다. 채소는 당근과 시금치로 바꿨습니다.",
    ingredients: {
      "white-rice-cooked": 200,
      "chicken-breast": 80,
      egg: 40,
      carrot: 40,
      spinach: 20,
      water: 60,
    },
    steps: [
      "닭가슴살은 속까지 완전히 익힌 뒤 결을 끊어 잘게 찢습니다. 달걀도 완전히 익혀 잘게 다집니다.",
      "당근과 시금치를 잘게 썰어 물과 함께 부드럽게 익힙니다.",
      "따뜻한 밥에 닭고기·달걀·채소를 섞습니다. 아이의 씹는 정도에 맞춰 크기와 수분을 조절합니다.",
    ],
  },
  {
    slug: "weekly-tofu-vegetable-rice",
    name: "두부채소비빔진밥",
    sourceId: 10,
    sourceName: "두부 곤약 나물 비빔밥",
    category: "MEAL" as const,
    minutes: 20,
    changes:
      "두부·밥·채소 조합을 참고했습니다. 곤약·고사리·고추장·소금은 제외하고 시금치를 더해 부드럽게 익힙니다.",
    ingredients: {
      "white-rice-cooked": 180,
      tofu: 100,
      spinach: 30,
      carrot: 30,
      "sesame-oil": 2,
      water: 60,
    },
    steps: [
      "두부를 으깨고 당근과 시금치를 잘게 다집니다.",
      "물에 채소와 두부를 넣고 채소가 부드러워질 때까지 익힙니다.",
      "밥과 참기름을 넣어 섞고 한 번 더 익힙니다. 아이가 먹기 좋은 온도와 질감으로 나눠 담습니다.",
    ],
  },
  {
    slug: "weekly-sweet-potato-porridge",
    name: "부드러운고구마죽",
    sourceId: 17,
    sourceName: "칼륨 듬뿍 고구마죽",
    category: "SNACK" as const,
    minutes: 20,
    changes: "고구마죽을 참고하고 설탕·잣·찹쌀가루를 제외했습니다. 물로 농도를 조절한 간식입니다.",
    ingredients: { "sweet-potato": 140, water: 120 },
    steps: [
      "고구마의 껍질과 질긴 부분을 제거하고 작게 자릅니다.",
      "물과 고구마를 냄비에 넣고 고구마가 속까지 부드럽게 익도록 끓입니다.",
      "덩어리를 으깨 농도를 조절하고 충분히 식혀 나눠 담습니다.",
    ],
  },
  {
    slug: "weekly-apple-tofu-cucumber",
    name: "사과순두부오이무침",
    sourceId: 32,
    sourceName: "순두부 사과 소스 오이무침",
    category: "SNACK" as const,
    minutes: 15,
    changes:
      "사과·순두부 소스 조합을 참고하고 땅콩은 제외했습니다. 오이와 사과를 부드럽게 익혀 사용합니다.",
    ingredients: { cucumber: 80, apple: 80, "soft-tofu": 80 },
    steps: [
      "오이의 질긴 껍질과 씨, 사과의 껍질과 씨를 제거하고 잘게 자릅니다.",
      "오이와 사과를 찜기에 부드럽게 익히고 순두부도 충분히 익힙니다.",
      "사과와 순두부를 으깬 뒤 오이와 섞습니다. 아이가 먹을 수 있는 크기와 온도인지 확인합니다.",
    ],
  },
];

export async function bootstrapWeekly() {
  const prisma = getPrisma();
  let nutritionCount = 0,
    recipeCount = 0;
  for (const [slug, nutrition] of Object.entries(composition)) {
    const mappedSlug = slug === "yogurt-plain" ? "plain-yogurt" : slug;
    const result = await prisma.ingredient.updateMany({
      where: { slug: mappedSlug },
      data: { nutrition },
    });
    nutritionCount += result.count;
  }
  const dictionary = await prisma.ingredient.findMany();
  const simpleFoods = [
    {
      slug: "weekly-plain-rice",
      ingredient: "white-rice-cooked",
      name: "밥 · 단순 음식",
      amount: 80,
      category: "MEAL" as const,
      role: "STAPLE",
    },
    {
      slug: "weekly-plain-yogurt",
      ingredient: "plain-yogurt",
      name: "플레인요거트 · 단순 음식",
      amount: 100,
      category: "SNACK" as const,
      role: "SNACK",
    },
    {
      slug: "weekly-plain-milk",
      ingredient: "milk",
      name: "우유 · 단순 음식",
      amount: 100,
      category: "SNACK" as const,
      role: "SNACK",
    },
  ];
  for (const food of simpleFoods) {
    if (await prisma.recipe.findUnique({ where: { slug: food.slug } })) continue;
    const ingredient = dictionary.find((i) => i.slug === food.ingredient);
    const nutrient =
      composition[
        (food.ingredient === "plain-yogurt"
          ? "yogurt-plain"
          : food.ingredient) as keyof typeof composition
      ];
    if (!ingredient || !nutrient) throw new Error("Simple food mapping is missing.");
    await prisma.recipe.create({
      data: {
        slug: food.slug,
        name: food.name,
        summary:
          "끼니·간식에 양을 정해 함께 담는 단순 음식입니다. 제품 성분과 사용 기한을 확인해 주세요. 출처는 조리법이 아닌 표준 식품 성분 근거입니다.",
        category: food.category,
        mealRole: food.role,
        mealCategories: food.category === "MEAL" ? ["BREAKFAST", "LUNCH", "DINNER"] : ["SNACK"],
        ageStages: [1, 2, 3, 4],
        saltLevel: "NONE",
        cookMinutes: 5,
        baseServings: 1,
        sodiumMgPerServing: Math.round((ingredient.sodiumMgPer100g * food.amount) / 100),
        allergens: ingredient.allergens,
        tools: [],
        steps: [
          {
            order: 1,
            instruction:
              "제품·음식의 실제 재료와 보관 상태를 확인하고, 표시된 분량을 아이가 먹기 좋은 상태로 준비해 주세요.",
          },
        ],
        babyTips: {
          textureTip: "아이의 먹는 능력에 맞는 상태인지 확인해 주세요.",
          cuttingSizeTip: "먹기 어려운 덩어리와 이물질이 없는지 확인해 주세요.",
          seasoningTip: "소금·설탕을 추가하지 않습니다.",
        },
        storageInfo: {
          fridgeDays: null,
          freezerDays: null,
          reheatTip: "제품 표시와 실제 보관 상태를 확인해 제공하세요.",
          portionTip: "실제 남은 양과 사용 기한을 확인해 기록하세요.",
        },
        ingredients: { create: { ingredientId: ingredient.id, amount: food.amount, unit: "g" } },
        sources: {
          create: {
            url: nutrient.sourceUrl,
            title: `표준 식품 성분 · ${nutrient.description} · FDC ${nutrient.foodCode}`,
            channelOrSite: "USDA FoodData Central",
            sourceType: "PUBLIC_INSTITUTION",
            verificationStatus: "VERIFIED",
            verifiedAt: new Date("2026-11-01T00:00:00+09:00"),
            trustScore: 0.92,
          },
        },
      },
    });
    recipeCount++;
  }
  for (const recipe of starters) {
    if (await prisma.recipe.findUnique({ where: { slug: recipe.slug } })) continue;
    const ingredients = Object.entries(recipe.ingredients).map(([slug, amount]) => {
      const ingredient = dictionary.find((i) => i.slug === slug);
      if (!ingredient) throw new Error(`Missing ingredient dictionary entry: ${slug}`);
      return { ingredient, amount };
    });
    const allergens = [...new Set(ingredients.flatMap((i) => i.ingredient.allergens))];
    const sodium = Math.round(
      ingredients.reduce((sum, i) => sum + (i.amount / 100) * i.ingredient.sodiumMgPer100g, 0) / 2,
    );
    await prisma.recipe.create({
      data: {
        slug: recipe.slug,
        name: recipe.name,
        summary: `식약처 레시피 ${recipe.sourceId}번 응용. ${recipe.changes}`,
        category: recipe.category,
        mealRole: recipe.category === "MEAL" ? "MAIN" : "SNACK",
        mealCategories: recipe.category === "MEAL" ? ["BREAKFAST", "LUNCH", "DINNER"] : ["SNACK"],
        ageStages: [1, 2, 3, 4],
        saltLevel: "NONE",
        cookMinutes: recipe.minutes,
        baseServings: 2,
        sodiumMgPerServing: sodium,
        allergens,
        tools: ["냄비"],
        steps: recipe.steps.map((instruction, index) => ({ order: index + 1, instruction })),
        babyTips: {
          textureTip: "충분히 부드럽게 익히고 아이의 씹는 능력에 맞춰 으깨거나 다져 주세요.",
          cuttingSizeTip: "덩어리·질긴 부분을 남기지 말고 아이에게 맞는 크기로 조절하세요.",
          seasoningTip: "소금·간장·설탕을 추가하지 않은 응용 레시피입니다.",
        },
        storageInfo: {
          fridgeDays: null,
          freezerDays: null,
          reheatTip:
            "보관 상태와 사용 기한을 확인하고 속까지 충분히 데운 뒤 먹기 좋은 온도로 식혀 주세요.",
          portionTip: "한 번 먹을 양으로 소분하고 실제 보관 장소와 사용 기한을 확인해 기록하세요.",
        },
        ingredients: {
          create: ingredients.map((i) => ({
            ingredientId: i.ingredient.id,
            amount: i.amount,
            unit: i.ingredient.slug === "water" ? "ml" : "g",
          })),
        },
        sources: {
          create: {
            url: sourceUrl,
            title: `식약처 조리식품 레시피 DB ${recipe.sourceId}번 · ${recipe.sourceName} (응용 근거)`,
            channelOrSite: "식품의약품안전처",
            sourceType: "PUBLIC_INSTITUTION",
            trustScore: 0.92,
            verificationStatus: "VERIFIED",
            verifiedAt: new Date("2026-11-01T00:00:00+09:00"),
          },
        },
      },
    });
    recipeCount++;
  }
  // Generic homepages and invented fallback links do not establish a recipe's provenance.
  const invalid = await prisma.recipeSource.updateMany({
    where: {
      OR: [
        { url: { contains: "seed-placeholder" } },
        { url: { contains: "functionality.do" } },
        { url: { contains: "board.do?q=" } },
      ],
    },
    data: { verificationStatus: "INVALID", trustScore: 0 },
  });
  console.log(
    JSON.stringify({
      nutritionMappings: nutritionCount,
      newReferencedRecipes: recipeCount,
      invalidSources: invalid.count,
    }),
  );
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/bootstrap-weekly.ts")) {
  bootstrapWeekly()
    .then(() => getPrisma().$disconnect())
    .catch(async () => {
      console.error("Weekly data bootstrap failed; credentials omitted.");
      await getPrisma().$disconnect();
      process.exit(1);
    });
}
