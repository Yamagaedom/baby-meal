/* eslint-disable @typescript-eslint/no-explicit-any -- Offline adapter for legacy PostgreSQL exports; all output passes the shared safety validator and a PostgreSQL dry run. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { validateRecipeSafety } from "../src/lib/safety";
import { computeRecipeNutrition } from "../src/features/nutrition";
import composition from "../src/data/food-composition.json";
import { MEAL_TIMES, type AgeStage, type IngredientInfo } from "../src/lib/domain/types";

// Build only a reviewable manifest; never mutates a database. Backups stay ignored locally.
const local = JSON.parse(fs.readFileSync(".local-data/recipe-local-before.json", "utf8"));
const prod = JSON.parse(fs.readFileSync(".local-data/recipe-production-before.json", "utf8"));
const evidence = JSON.parse(fs.readFileSync(".local-data/recipe-source-evidence.json", "utf8"));

// These combinations were checked in the original author's public recipe description.
// An entry substantiates a combination, not every quantity or an infant safety endorsement.
const reviews = [
  ["DkrLjhSLue4", "MEAL", "chicken", "broccoli carrot onion"],
  ["Rk8fc4nU7yY", "MEAL", "beef", "zucchini carrot onion"],
  ["3-e6ZoXFoSM", "MEAL", "beef", "broccoli carrot onion"],
  ["x-xpTlAQ5OI", "MEAL", "beef", "spinach onion carrot zucchini"],
  ["ouTCL6y9FOQ", "MEAL", "beef", "potato green-onion"],
  ["-SCi_3s_oK8", "MEAL", "beef", "oats onion potato"],
  ["k3mBa6snSxU", "MEAL", "beef", "sweet-pumpkin oats"],
  ["TNmjOa-uC_E", "MEAL", "pork", "eggplant onion enoki-mushroom starch-potato"],
  ["DcfBf4TGfVw", "MEAL", "pork", "onion cabbage carrot chives potato zucchini broccoli"],
  ["LUJVdM8IQuc", "MEAL", "chicken", "cabbage zucchini"],
  ["U6b5DMeSyc4", "MEAL", "chicken", "onion zucchini potato"],
  ["fzCdaW6JCsg", "MEAL", "chicken", "green-onion onion carrot zucchini king-oyster-mushroom"],
  ["jqGhKnGagnk", "MEAL", "chicken", "spinach button-mushroom"],
  ["w_ZIfk0etQk", "MEAL", "chicken", "oats carrot zucchini onion"],
  ["mlDTIBLIbd0", "MEAL", "tofu", "onion zucchini carrot egg"],
  ["E4ejokApTo8", "BOTH", "tofu", "broccoli"],
  ["qfUlbc-ga6g", "MEAL", "tofu", "spinach green-onion"],
  ["PbZ1iRgycbo", "BOTH", "tofu", "sweet-pumpkin"],
  ["othMeFRB7-Q", "BOTH", "tofu", "carrot rice-flour"],
  ["3zWBAgUYqvY", "MEAL", "tofu", "egg green-onion onion"],
  ["1eMBhLQs31I", "MEAL", "cod", "radish onion cabbage button-mushroom miyeok-soaked"],
  ["HTzA1ht81a8", "MEAL", "cod", "spinach carrot onion"],
  ["u5nD7BbbyYY", "MEAL", "flounder", "onion carrot green-onion radish"],
  ["jpzYoRd8OPA", "MEAL", "flounder", "onion broccoli"],
  ["fevUfGOE8TY", "MEAL", "salmon", "onion button-mushroom broccoli"],
  ["2ftYrhpdIf4", "MEAL", "salmon", "onion paprika carrot broccoli green-onion"],
  ["GsSoq1y51ic", "MEAL", "shrimp", "egg onion carrot green-onion"],
  ["5VKwIFwviag", "SNACK", "sweet-potato", "apple rice-flour"],
  ["_8rANbEkn5Q", "SNACK", "avocado", "banana"],
  ["6lk1KLWeqkw", "SNACK", "potato", "baby-cheese milk"],
  ["Us_WFnTQ2CE", "SNACK", "sweet-potato", "baby-cheese"],
  ["LLAKoUPq5Y0", "SNACK", "apple", "carrot rice-flour egg"],
  ["zuntpyRvh-I", "SNACK", "apple", "banana oats egg"],
  ["hQLFr-hYe3g", "SNACK", "sweet-potato", "carrot rice-flour egg"],
  ["kgEFsWUCcFI", "SNACK", "sweet-pumpkin", "carrot pear"],
  ["-T6N_PKwn64", "SNACK", "banana", "blueberry rice-flour egg"],
  ["XxSU0o3vsJ8", "SNACK", "blueberry", "plain-yogurt oats milk"],
  ["Hq6nUj09CcY", "SNACK", "white-bread", "egg baby-cheese"],
] as const;
const family: Record<string, string> = {
  "beef-minced": "beef",
  "beef-tenderloin": "beef",
  "pork-minced": "pork",
  "pork-tenderloin": "pork",
  "chicken-breast": "chicken",
  "chicken-tenderloin": "chicken",
  "soft-tofu": "tofu",
};
// Use the authoritative production dictionary, including parsed enum arrays, for safety checks.
const dictionary = new Map<string, IngredientInfo>(
  prod.ingredients.map((i: any) => [
    i.id,
    {
      id: i.id,
      slug: i.slug,
      name: i.name,
      synonyms: i.synonyms,
      group: i.group,
      allergens: i.allergens,
      minAgeMonth: i.min_age_month,
      sodiumMgPer100g: i.sodium_mg_per_100g,
      gramsPerPiece: i.grams_per_piece,
      densityGPerMl: i.density_g_per_ml,
      isSaltySeasoning: i.is_salty_seasoning,
      cautionNote: i.caution_note,
      nutrition: (composition as Record<string, unknown>)[i.slug] ?? null,
    },
  ]),
);
const bySlug = new Map([...dictionary.values()].map((i) => [i.slug!, i]));
const contentKey = (r: any) =>
  r.ingredients
    .filter(
      (i: any) =>
        !i.is_optional &&
        !["water", "vegetable-broth", "anchovy-broth"].includes(i.ingredient_slug),
    )
    .map((i: any) => i.ingredient_slug)
    .sort()
    .join("|");
const seen = new Set(prod.recipes.map(contentKey));
const recipes: any[] = [],
  excluded: any[] = [],
  sourceReviews = new Map();
for (const raw of [
  ...prod.recipes,
  ...local.recipes.filter((r: any) => r.slug?.startsWith("batch-")),
]) {
  const isNew = !!raw.slug?.startsWith("batch-");
  const core = raw.ingredients
    .filter((i: any) => !i.is_optional)
    .map((i: any) => i.ingredient_slug);
  const matches = reviews
    .flatMap(([id, kind, primary, rest]) => {
      const allowed = [primary, ...rest.split(" ")];
      const matched = core.filter((s: string) => allowed.includes(family[s] ?? s));
      if (
        !(kind === "BOTH" || kind === raw.category) ||
        matched.length < 2 ||
        !core.some((s: string) => (family[s] ?? s) === primary)
      )
        return [];
      const v = evidence.videos[id];
      if (!v || v.description.length < 40 || !v.fetchedAt)
        throw new Error(`Uncollected source ${id}`);
      return [{ ...v, matched, score: matched.length }];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const existingVerified = (raw.sources ?? []).some(
    (s: any) => s.verification_status === "VERIFIED",
  );
  if (isNew && (!matches.length || seen.has(contentKey(raw)))) {
    excluded.push({
      slug: raw.slug,
      name: raw.name,
      reason: matches.length ? "EXISTING_INGREDIENT_COMBINATION" : "INSUFFICIENT_RECIPE_EVIDENCE",
    });
    continue;
  }
  if (isNew) seen.add(contentKey(raw));
  const source = !existingVerified ? matches[0] : null;
  const ingredients = raw.ingredients
    .filter((i: any) => !isNew || !["baby-soy-sauce", "baby-cheese"].includes(i.ingredient_slug))
    .map((i: any) => {
      const slug =
        isNew && ["vegetable-broth", "anchovy-broth"].includes(i.ingredient_slug)
          ? "water"
          : i.ingredient_slug;
      return {
        ingredientId: bySlug.get(slug)!.id,
        slug,
        amount: i.amount,
        unit: i.unit,
        isOptional: i.is_optional,
        prepNote: i.prep_note,
        substituteSlug: i.substitute_id
          ? ((isNew ? local : prod).ingredients.find((x: any) => x.id === i.substitute_id)?.slug ??
            null)
          : null,
      };
    });
  const grain = ingredients.find((i: any) =>
    ["white-rice-cooked", "oats", "pasta-fusilli", "rice-noodle"].includes(i.slug),
  );
  const protein = ingredients.find((i: any) =>
    ["MEAT", "SEAFOOD", "LEGUME_TOFU", "EGG"].includes(bySlug.get(i.slug)!.group),
  );
  const veg = ingredients.filter((i: any) => bySlug.get(i.slug)!.group === "VEGETABLE");
  const mealRole =
    raw.category === "SNACK"
      ? "SNACK"
      : grain && (protein || veg.length)
        ? "MAIN"
        : raw.meal_role === "STAPLE"
          ? "STAPLE"
          : "SIDE";
  let steps = raw.steps;
  let name = raw.name;
  if (isNew && raw.category === "MEAL") {
    const label =
      grain?.slug === "oats"
        ? "오트밀죽"
        : grain?.slug === "pasta-fusilli"
          ? "촉촉파스타"
          : grain?.slug === "rice-noodle"
            ? "쌀국수"
            : "진밥";
    name = `${bySlug.get(protein!.slug)!.name}${veg.map((i: any) => bySlug.get(i.slug)!.name).join("")}${label}`;
    steps = [
      {
        order: 1,
        instruction:
          "채소의 껍질·질긴 부분을 제거하고 잘게 다집니다. 고기는 힘줄을 제거해 다지고, 생선은 가시·껍질이 남지 않았는지 손과 눈으로 확인해 잘게 부숩니다. 생고기·생선 도구는 채소 도구와 구분합니다.",
      },
      {
        order: 2,
        instruction:
          grain?.slug === "pasta-fusilli" || grain?.slug === "rice-noodle"
            ? "면은 제품에 표시된 방법대로 별도 냄비에서 속까지 부드럽게 삶아 건지고, 아이가 먹기 쉽게 짧게 자릅니다. 별도 삶는 물은 재료표의 물과 구분합니다."
            : "냄비에 분량의 물과 다진 채소를 넣고 단단한 채소부터 부드럽게 익힙니다.",
      },
      {
        order: 3,
        instruction:
          "분량의 물에 고기·생선·두부와 채소를 넣고 끓입니다. 고기·생선은 중심까지 완전히 익히고, 두부는 덩어리를 풀어 충분히 가열합니다. 닭고기·다짐육은 중심온도 75℃에서 1분 이상 가열되었는지 확인합니다.",
      },
      {
        order: 4,
        instruction: `준비한 ${grain?.slug === "white-rice-cooked" ? "밥" : grain?.slug === "oats" ? "귀리" : "면"}을 넣고 바닥에 눌어붙지 않게 저어 부드럽게 익힙니다. 필요하면 물을 조금씩 더해 농도를 조절합니다. 소금·간장 없이 마무리하고 충분히 식혀 ${raw.base_servings}회분으로 나눕니다.`,
      },
    ];
  } else if (isNew) {
    const main =
      ingredients.find(
        (i: any) =>
          !["milk", "water", "soy-milk-unsweetened"].includes(i.slug) &&
          bySlug.get(i.slug)!.group !== "VEGETABLE",
      ) ?? ingredients[0];
    const other = ingredients.find(
      (i: any) =>
        i.slug !== main.slug && !["milk", "water", "soy-milk-unsweetened"].includes(i.slug),
    );
    name = `${bySlug.get(main.slug)!.name}${other ? bySlug.get(other.slug)!.name : ""}부드러운스푼간식`;
    steps = [
      {
        order: 1,
        instruction:
          "과일·채소의 껍질, 씨, 질긴 부분을 제거하고 잘게 자릅니다. 블루베리는 통째로 주지 않고 으깹니다.",
      },
      {
        order: 2,
        instruction:
          "단단한 채소·과일은 분량의 물이나 우유와 함께 냄비에서 약불로 부드럽게 익힙니다. 귀리·쌀가루가 있으면 찬 액체에 먼저 풀고 저어가며 충분히 익힙니다. 바닥에 눌어붙으면 물을 조금씩 더합니다.",
      },
      {
        order: 3,
        instruction:
          "두부가 있으면 충분히 가열해 으깹니다. 바나나·후숙 아보카도는 포크로 으깨 섞습니다. 요거트는 익힌 재료를 식힌 뒤 넣습니다. 단단한 볼 모양을 만들지 않고 숟가락으로 떠먹을 수 있는 농도로 맞춥니다.",
      },
      {
        order: 4,
        instruction: `덩어리와 온도를 확인하고 ${raw.base_servings}회분으로 나눕니다. 소금·설탕·간장·치즈를 추가하지 않습니다.`,
      },
    ];
  }
  const originalStages = raw.age_stages as AgeStage[];
  // Minimum age never decreases. A soft dish remains usable in later supported stages.
  const ageStages = [1, 2, 3, 4].filter((s) => s >= Math.min(...originalStages)) as AgeStage[];
  const r = {
    id: isNew ? null : raw.id,
    newRecipeId: isNew ? raw.id : null,
    slug: raw.slug,
    name,
    category: raw.category,
    mealRole,
    mealCategories: Array.isArray(raw.meal_categories)
      ? raw.meal_categories
      : raw.meal_categories.slice(1, -1).split(",").filter(Boolean),
    ageStages,
    saltLevel: isNew ? "NONE" : raw.salt_level,
    cookMinutes: isNew ? Math.max(25, raw.cook_minutes) : raw.cook_minutes,
    difficulty: raw.difficulty,
    tools: isNew ? ["냄비"] : raw.tools,
    baseServings: raw.base_servings,
    ingredients,
    steps,
    babyTips: raw.baby_tips,
    storageInfo: isNew
      ? {
          fridgeDays: 1,
          freezerDays: null,
          reheatTip:
            "먹일 분량만 덜어 중심까지 뜨겁게 데운 뒤 식혀 제공합니다. 입에 닿은 음식은 재보관하지 않습니다.",
          portionTip:
            "조리 후 신속히 식혀 덮개 있는 용기에 소분해 냉장하고 24시간 안에 사용합니다.",
        }
      : raw.storage_info,
    source: source
      ? {
          url: source.url,
          title: `재료 조합 참고 · ${source.title}`,
          channelOrSite: source.channel,
          sourceType: "YOUTUBE",
          verificationStatus: "VERIFIED",
          verifiedAt: source.fetchedAt,
          trustScore: 0.75,
        }
      : null,
    sourceEvidence: source ? { id: source.id, matchedIngredientSlugs: source.matched } : null,
    summary: raw.summary,
    isAiGenerated: isNew || raw.is_ai_generated,
  };
  if (r.mealCategories.some((m: any) => !MEAL_TIMES.includes(m)))
    throw new Error("Invalid meal category export");
  if (source) {
    const names = source.matched.map((s: string) => bySlug.get(s)!.name).join("·");
    r.summary = `${names} 조합을 원문에서 참고한 앱 응용 레시피입니다. 분량·식감·추가 재료·양념은 원문과 다를 수 있습니다.${isNew ? " 육수는 물로 바꾸고 간장·치즈를 제외했습니다." : ""}`;
    sourceReviews.set(source.id, {
      id: source.id,
      url: source.url,
      title: source.title,
      channel: source.channel,
      checkedAt: source.fetchedAt,
      method:
        "YouTube Data API public/processed status + original recipe description ingredient review",
      descriptionSha256: createHash("sha256").update(source.description).digest("hex"),
    });
  }
  // Existing production IDs are unrelated to local IDs: validate against local ingredients by slug.
  const safety = validateRecipeSafety(r as any, dictionary);
  if (!safety.passed) {
    excluded.push({ slug: r.slug, name, reason: "SAFETY_VALIDATION", issues: safety.issues });
    if (!isNew)
      throw new Error(`Existing recipe failed safety: ${name}: ${JSON.stringify(safety.issues)}`);
    continue;
  }
  recipes.push({
    ...r,
    allergens: safety.derivedAllergens,
    sodiumMgPerServing: safety.computedSodiumMgPerServing,
    nutrition: computeRecipeNutrition(ingredients, dictionary, r.baseServings),
  });
}
const result = {
  version: "2026-11-01-catalog-repair-v1",
  criteria:
    "Original source existence AND ingredient combination review; original content is adapted, not copied. Safety validation does not certify clinical suitability.",
  sourceReviews: [...sourceReviews.values()],
  recipes,
  excluded,
};
fs.writeFileSync("src/data/recipe-catalog-repair.json", JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    existing: recipes.filter((r) => r.id).length,
    additions: recipes.filter((r) => !r.id).length,
    sourceRepairs: recipes.filter((r) => r.id && r.source).length,
    evidenceSources: sourceReviews.size,
    excluded: excluded.reduce(
      (a: any, r: any) => ({ ...a, [r.reason]: (a[r.reason] ?? 0) + 1 }),
      {},
    ),
    newByCategory: recipes
      .filter((r) => !r.id)
      .reduce((a: any, r: any) => ({ ...a, [r.category]: (a[r.category] ?? 0) + 1 }), {}),
  }),
);
