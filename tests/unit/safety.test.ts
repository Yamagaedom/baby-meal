import { describe, expect, it } from "vitest";
import type { IngredientInfo } from "@/lib/domain/types";
import {
  calculateSodiumPerServing,
  checkAgeRestrictions,
  checkAllergyConflicts,
  checkSaltLevelCompliance,
  convertIngredientToGrams,
  deriveRecipeAllergens,
  findIngredientByName,
  normalizeIngredientName,
  validateRecipeSafety,
  type RecipeCandidateForSafety,
} from "@/lib/safety";

const MOCK_INGREDIENTS: IngredientInfo[] = [
  {
    id: "ing-rice",
    name: "쌀밥",
    synonyms: ["밥", "백미밥", "진밥"],
    group: "GRAIN",
    allergens: [],
    minAgeMonth: 12,
    sodiumMgPer100g: 2,
    gramsPerPiece: null,
    densityGPerMl: 0.85,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-beef",
    name: "소고기",
    synonyms: ["쇠고기", "한우", "소고기다짐육"],
    group: "MEAT",
    allergens: ["BEEF"],
    minAgeMonth: 12,
    sodiumMgPer100g: 55,
    gramsPerPiece: null,
    densityGPerMl: 1,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-egg",
    name: "달걀",
    synonyms: ["계란", "유정란"],
    group: "EGG",
    allergens: ["EGG"],
    minAgeMonth: 12,
    sodiumMgPer100g: 142,
    gramsPerPiece: 50,
    densityGPerMl: 1.03,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-bread",
    name: "식빵",
    synonyms: ["우유식빵"],
    group: "PROCESSED",
    allergens: ["WHEAT", "MILK", "EGG"],
    minAgeMonth: 12,
    sodiumMgPer100g: 420,
    gramsPerPiece: 35,
    densityGPerMl: 1,
    isSaltySeasoning: false,
    cautionNote: "밀·우유·달걀 하위 성분 포함",
  },
  {
    id: "ing-carrot",
    name: "당근",
    synonyms: [],
    group: "VEGETABLE",
    allergens: [],
    minAgeMonth: 12,
    sodiumMgPer100g: 69,
    gramsPerPiece: 100,
    densityGPerMl: 1,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-zucchini",
    name: "애호박",
    synonyms: ["호박"],
    group: "VEGETABLE",
    allergens: [],
    minAgeMonth: 12,
    sodiumMgPer100g: 3,
    gramsPerPiece: 250,
    densityGPerMl: 1,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-sesame-oil",
    name: "참기름",
    synonyms: [],
    group: "SEASONING",
    allergens: [],
    minAgeMonth: 12,
    sodiumMgPer100g: 1,
    gramsPerPiece: null,
    densityGPerMl: 0.92,
    isSaltySeasoning: false,
    cautionNote: null,
  },
  {
    id: "ing-soy-sauce",
    name: "국간장",
    synonyms: ["집간장", "조선간장"],
    group: "SEASONING",
    allergens: ["SOYBEAN", "WHEAT"],
    minAgeMonth: 16,
    sodiumMgPer100g: 5800,
    gramsPerPiece: null,
    densityGPerMl: 1.18,
    isSaltySeasoning: true,
    cautionNote: "나트륨 고함량 양념",
  },
  {
    id: "ing-whole-walnut",
    name: "통호두",
    synonyms: ["호두알"],
    group: "NUT_SEED",
    allergens: ["WALNUT"],
    minAgeMonth: 49, // 유아식 기간(12~48개월) 전체 질식 위험 차단, 가루 형태만 허용
    sodiumMgPer100g: 2,
    gramsPerPiece: 5,
    densityGPerMl: 1,
    isSaltySeasoning: false,
    cautionNote: "통견과류 질식 위험 — 48개월 이하 금지",
  },
];

const DICT_MAP = new Map(MOCK_INGREDIENTS.map((i) => [i.id, i]));

function makeValidCandidate(overrides: Partial<RecipeCandidateForSafety> = {}): RecipeCandidateForSafety {
  return {
    name: "소고기애호박진밥",
    category: "MEAL",
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 20,
    baseServings: 2,
    declaredAllergens: ["BEEF"],
    ingredients: [
      { ingredientId: "ing-rice", amount: 180, unit: "g", isOptional: false },
      { ingredientId: "ing-beef", amount: 40, unit: "g", isOptional: false },
      { ingredientId: "ing-zucchini", amount: 40, unit: "g", isOptional: false },
      { ingredientId: "ing-carrot", amount: 20, unit: "g", isOptional: true },
      { ingredientId: "ing-sesame-oil", amount: 0.5, unit: "작은술", isOptional: true },
    ],
    steps: [
      { order: 1, instruction: "소고기와 채소를 잘게 다집니다.", timerSeconds: null },
      { order: 2, instruction: "냄비에 볶다가 밥과 물을 넣고 무르게 끓입니다.", timerSeconds: 300 },
    ],
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지에 1분 30초 데운 뒤 속까지 식혀 급여하세요.",
    },
    sources: [{ url: "https://www.youtube.com/watch?v=example123", title: "한우 애호박 진밥 레시피" }],
    ...overrides,
  };
}

describe("lib/safety — 유아식 안전 검증 (REC-02, AGE-03/05, AI-05)", () => {
  it("식재료 이름 정규화 및 동의어 검색 (예: 호박 → 애호박, 계란 → 달걀)", () => {
    expect(normalizeIngredientName(" 소고기 다짐육 ")).toBe("소고기다짐육");
    expect(findIngredientByName(MOCK_INGREDIENTS, "계란")?.id).toBe("ing-egg");
    expect(findIngredientByName(MOCK_INGREDIENTS, "호박")?.id).toBe("ing-zucchini");
    expect(findIngredientByName(MOCK_INGREDIENTS, "")).toBeUndefined();
    expect(findIngredientByName(MOCK_INGREDIENTS, "용과")).toBeUndefined();
  });

  it("REC-02: 알레르기 충돌 검사 — 분류 코드, 동의어(계란=달걀), 가공식품 하위 성분(식빵 속 달걀)까지 차단", () => {
    // 1) "계란"이라는 동의어로 알레르기를 등록했을 때 "달걀" 레시피 차단
    const eggRecipe = [{ ingredientId: "ing-egg" }];
    const bySynonym = checkAllergyConflicts(eggRecipe, DICT_MAP, { terms: ["계란"] });
    expect(bySynonym.hasConflict).toBe(true);
    expect(bySynonym.conflicts[0].ingredientId).toBe("ing-egg");

    // 2) "계란" 동의어 등록 시 달걀 하위 성분이 든 "식빵"(PROCESSED: WHEAT, MILK, EGG)까지 차단
    const breadRecipe = [{ ingredientId: "ing-bread" }];
    const processedConflict = checkAllergyConflicts(breadRecipe, DICT_MAP, { terms: ["계란"] });
    expect(processedConflict.hasConflict).toBe(true);
    expect(processedConflict.conflicts[0].reason).toBe("ALLERGEN_GROUP");
    expect(processedConflict.conflicts[0].matchedAllergens).toContain("EGG");

    // 3) 직접 ID 등록(기피 재료: 애호박) 차단
    const zucchiniConflict = checkAllergyConflicts(
      [{ ingredientId: "ing-zucchini" }],
      DICT_MAP,
      { ingredientIds: ["ing-zucchini"] },
    );
    expect(zucchiniConflict.hasConflict).toBe(true);
    expect(zucchiniConflict.conflicts[0].reason).toBe("INGREDIENT_ID");

    // 4) 미등록 재료 ID는 안전을 위해 충돌로 간주
    const unknownConflict = checkAllergyConflicts(
      [{ ingredientId: "unknown-item" }],
      DICT_MAP,
      {},
    );
    expect(unknownConflict.hasConflict).toBe(true);

    // 5) 충돌 없는 경우 통과
    const safeCheck = checkAllergyConflicts(
      [{ ingredientId: "ing-rice" }, { ingredientId: "ing-zucchini" }],
      DICT_MAP,
      { allergens: ["EGG", "MILK"] },
    );
    expect(safeCheck.hasConflict).toBe(false);
  });

  it("AGE-05 & AI-05 ③: 월령별 금지·주의 식재료 차단", () => {
    // 통호두(minAgeMonth: 49)는 36개월 아기에게도 차단
    const walnutRes = checkAgeRestrictions([{ ingredientId: "ing-whole-walnut" }], DICT_MAP, 36);
    expect(walnutRes.allowed).toBe(false);
    expect(walnutRes.violations[0].ingredientName).toBe("통호두");

    // 국간장(minAgeMonth: 16)은 12개월 완료기 아기에게 차단, 18개월 아기에게는 허용
    expect(checkAgeRestrictions([{ ingredientId: "ing-soy-sauce" }], DICT_MAP, 12).allowed).toBe(
      false,
    );
    expect(checkAgeRestrictions([{ ingredientId: "ing-soy-sauce" }], DICT_MAP, 18).allowed).toBe(
      true,
    );
  });

  it("단위 환산(convertIngredientToGrams) — 무게, 부피, 개수, 약간, 비정상 입력", () => {
    const egg = DICT_MAP.get("ing-egg")!;
    const rice = DICT_MAP.get("ing-rice")!;
    const soy = DICT_MAP.get("ing-soy-sauce")!;

    expect(convertIngredientToGrams(100, "g", rice)).toBe(100);
    expect(convertIngredientToGrams(0.1, "kg", rice)).toBe(100);
    expect(convertIngredientToGrams(1.5, "개", egg)).toBe(75);
    // rice는 gramsPerPiece가 null이므로 "개" 단위 불가
    expect(convertIngredientToGrams(1, "개", rice)).toBeNull();
    // 국간장 1작은술(5ml) × 밀도 1.18 = 5.9g
    expect(convertIngredientToGrams(1, "작은술", soy)).toBeCloseTo(5.9, 2);
    expect(convertIngredientToGrams(null, "약간", soy)).toBeCloseTo(0.3, 2);
    expect(convertIngredientToGrams(-1, "약간", soy)).toBeNull();
    expect(convertIngredientToGrams(0, "g", rice)).toBeNull();
    expect(convertIngredientToGrams(10, "", rice)).toBeNull();
    expect(convertIngredientToGrams(10, "바가지", rice)).toBeNull();
  });

  it("AGE-03 & AI-05 ④: 1회분 나트륨 계산 및 무염/저염 준수 여부 판정", () => {
    const calc = calculateSodiumPerServing(
      [
        { ingredientId: "ing-rice", amount: 100, unit: "g", isOptional: false },
        { ingredientId: "ing-soy-sauce", amount: 0.5, unit: "작은술", isOptional: false },
      ],
      DICT_MAP,
      1,
    );
    expect(calc.ok).toBe(true);
    // 밥 2mg + 국간장(2.95g * 58mg/g = 171.1mg) ≈ 173mg
    expect(calc.sodiumMgPerServing).toBe(173);

    // 저염(LOW ≤ 200mg)은 통과하지만, 무염(NONE ≤ 80mg & 간 양념 금지)은 실패
    const lowRes = checkSaltLevelCompliance(
      calc.sodiumMgPerServing,
      "LOW",
      [{ ingredientId: "ing-soy-sauce" }],
      DICT_MAP,
    );
    expect(lowRes.compliant).toBe(true);

    const noneRes = checkSaltLevelCompliance(
      10, // 나트륨 수치가 낮더라도 국간장이 들어갔으면 무염 불통과
      "NONE",
      [{ ingredientId: "ing-soy-sauce" }],
      DICT_MAP,
    );
    expect(noneRes.compliant).toBe(false);
    expect(noneRes.forbiddenSeasonings).toContain("국간장");

    // 잘못된 기준 분량(0회분, 6회분) 차단
    expect(calculateSodiumPerServing([], DICT_MAP, 0).ok).toBe(false);
    expect(calculateSodiumPerServing([], DICT_MAP, 6).ok).toBe(false);
  });

  it("AI-05 통합 안전 검증 — 정상 레시피 통과 및 5가지 게이트별 차단 검증", () => {
    const valid = validateRecipeSafety(makeValidCandidate(), DICT_MAP);
    expect(valid.passed).toBe(true);
    expect(valid.derivedAllergens).toEqual(["BEEF"]);
    expect(valid.issues).toHaveLength(0);

    // ① 미등록 식재료 차단
    const unregistered = validateRecipeSafety(
      makeValidCandidate({
        ingredients: [{ ingredientId: "ing-mystery-powder", amount: 50, unit: "g", isOptional: false }],
      }),
      DICT_MAP,
    );
    expect(unregistered.passed).toBe(false);
    expect(unregistered.issues.some((i) => i.code === "UNREGISTERED_INGREDIENT")).toBe(true);

    // ② 알레르기 태그 누락 차단 (달걀 넣었는데 declaredAllergens에 EGG 누락)
    const missingTag = validateRecipeSafety(
      makeValidCandidate({
        declaredAllergens: [],
        ingredients: [
          { ingredientId: "ing-rice", amount: 90, unit: "g", isOptional: false },
          { ingredientId: "ing-egg", amount: 1, unit: "개", isOptional: false },
        ],
      }),
      DICT_MAP,
    );
    expect(missingTag.passed).toBe(false);
    expect(missingTag.issues.some((i) => i.code === "ALLERGEN_TAG_MISMATCH")).toBe(true);
    expect(deriveRecipeAllergens(missingTag.derivedAllergens.map(() => ({ ingredientId: "ing-egg" })), DICT_MAP)).toEqual(["EGG"]);

    // ③ 월령 금지 식재료 차단 (통호두 포함)
    const ageBlocked = validateRecipeSafety(
      makeValidCandidate({
        ageStages: [2],
        declaredAllergens: ["BEEF", "WALNUT"],
        ingredients: [
          { ingredientId: "ing-rice", amount: 90, unit: "g", isOptional: false },
          { ingredientId: "ing-whole-walnut", amount: 2, unit: "개", isOptional: false },
        ],
      }),
      DICT_MAP,
    );
    expect(ageBlocked.passed).toBe(false);
    expect(ageBlocked.issues.some((i) => i.code === "AGE_RESTRICTED_INGREDIENT")).toBe(true);

    // ④ 간장 과다 사용으로 저염 상한(200mg) 초과 차단
    const saltyBlocked = validateRecipeSafety(
      makeValidCandidate({
        ageStages: [2, 3],
        saltLevel: "LOW",
        declaredAllergens: ["SOYBEAN", "WHEAT"],
        ingredients: [
          { ingredientId: "ing-rice", amount: 100, unit: "g", isOptional: false },
          { ingredientId: "ing-soy-sauce", amount: 1, unit: "큰술", isOptional: false },
        ],
      }),
      DICT_MAP,
    );
    expect(saltyBlocked.passed).toBe(false);
    expect(saltyBlocked.issues.some((i) => i.code === "SODIUM_EXCEEDS_SALT_LEVEL")).toBe(true);

    // ⑤ 비정상 중량 및 빈 출처 URL 차단
    const abnormalPortion = validateRecipeSafety(
      makeValidCandidate({
        baseServings: 1,
        ingredients: [{ ingredientId: "ing-rice", amount: 600, unit: "g", isOptional: false }],
        sources: [{ url: "   ", title: "출처" }],
      }),
      DICT_MAP,
    );
    expect(abnormalPortion.passed).toBe(false);
    expect(abnormalPortion.issues.some((i) => i.code === "ABNORMAL_PORTION_SIZE")).toBe(true);
    expect(abnormalPortion.issues.some((i) => i.code === "MISSING_REQUIRED_FIELD")).toBe(true);
  });
});
