/**
 * 유아식 안전 검증 순수 함수 모음 (PRD 3.3 REC-02, 3.6 AGE-03/05, 3.9 AI-05)
 *
 * 사람 검수가 없으므로 이 모듈이 아기 안전을 지키는 핵심 게이트다.
 * DB나 외부 API에 의존하지 않는 순수 함수로 유지하여 서버 필터와 AI 생성 파이프라인에서 동일하게 재사용한다.
 */
import { getAgeStageInfo, MIN_AGE_MONTH, MAX_AGE_MONTH, youngestMonthForStages } from "@/lib/age";
import type {
  AgeStage,
  Allergen,
  IngredientInfo,
  RecipeCategory,
  RecipeIngredientInput,
  SaltLevel,
} from "@/lib/domain/types";
import {
  MAX_SERVINGS,
  MAX_SINGLE_INGREDIENT_GRAMS_PER_SERVING,
  MAX_SODIUM_MG_PER_SERVING,
  MAX_TOTAL_GRAMS_PER_SERVING,
  MIN_SERVINGS,
  MIN_TOTAL_GRAMS_PER_SERVING,
  PIECE_UNITS,
  PINCH_GRAMS,
  PINCH_UNITS,
  VOLUME_UNIT_TO_ML,
  WEIGHT_UNIT_TO_GRAMS,
} from "@/lib/safety/constants";

/** 식재료명 정규화 (공백·특수기호 제거, 소문자 변환) */
export function normalizeIngredientName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** 이름 또는 동의어로 식재료 사전에서 항목 조회 (ING-01, PRF-05, AI-05 ①) */
export function findIngredientByName(
  dictionary: readonly IngredientInfo[],
  query: string,
): IngredientInfo | undefined {
  const normalized = normalizeIngredientName(query);
  if (!normalized) return undefined;

  return dictionary.find((item) => {
    if (normalizeIngredientName(item.name) === normalized) return true;
    return item.synonyms.some((syn) => normalizeIngredientName(syn) === normalized);
  });
}

/** 아기의 알레르기·기피 조건 입력 (CONFIRMED + SUSPECTED 모두 포함 — REC-02, LOG-04) */
export interface BabyAllergyProfile {
  /** 식약처 알레르기 분류 코드 (예: EGG, MILK) */
  allergens?: readonly Allergen[];
  /** 직접 등록한 알레르기·의심·기피 식재료 ID */
  ingredientIds?: readonly string[];
  /** 텍스트 검색어/동의어로 전달된 알레르기·기피 식재료명 */
  terms?: readonly string[];
}

export interface AllergyConflict {
  ingredientId: string;
  ingredientName: string;
  reason: "ALLERGEN_GROUP" | "INGREDIENT_ID" | "TERM_OR_SYNONYM";
  matchedAllergens?: Allergen[];
  matchedTerm?: string;
}

/**
 * (a) 레시피 재료 vs 아기 알레르기·기피 충돌 검사 (REC-02, PRF-05, LOG-04)
 * 선택 재료(isOptional: true)라도 레시피 상세에 노출되면 위험하므로 동일하게 차단한다.
 */
export function checkAllergyConflicts(
  recipeIngredients: readonly Pick<RecipeIngredientInput, "ingredientId">[],
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
  profile: BabyAllergyProfile,
): { hasConflict: boolean; conflicts: AllergyConflict[] } {
  const blockedAllergens = new Set<Allergen>(profile.allergens ?? []);
  const blockedIds = new Set<string>(profile.ingredientIds ?? []);
  const normalizedTerms = (profile.terms ?? [])
    .map(normalizeIngredientName)
    .filter((t) => t.length > 0);

  // 텍스트 검색어가 식재료 사전의 대표 항목(예: "계란" → "달걀" → EGG)에 매핑되면
  // 해당 식재료 ID와 알레르기 분류까지 함께 차단 범위에 넣는다.
  const allDictionaryItems = Array.from(dictionaryById.values());
  for (const term of normalizedTerms) {
    const matched = findIngredientByName(allDictionaryItems, term);
    if (matched) {
      blockedIds.add(matched.id);
      // 단일 원재료가 곧 알레르기 유발원 자체인 경우(예: 달걀→EGG, 우유→MILK, 땅콩→PEANUT)
      // 하위 가공식품(마요네즈, 빵 등)도 함께 차단하기 위해 알레르기 그룹을 확장한다.
      if (matched.group !== "PROCESSED" && matched.allergens.length === 1) {
        blockedAllergens.add(matched.allergens[0]);
      }
    }
  }

  const conflicts: AllergyConflict[] = [];

  for (const ri of recipeIngredients) {
    const info = dictionaryById.get(ri.ingredientId);
    if (!info) {
      conflicts.push({
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredientId,
        reason: "INGREDIENT_ID",
      });
      continue;
    }

    const matchedAllergens = info.allergens.filter((a) => blockedAllergens.has(a));
    if (matchedAllergens.length > 0) {
      conflicts.push({
        ingredientId: info.id,
        ingredientName: info.name,
        reason: "ALLERGEN_GROUP",
        matchedAllergens,
      });
      continue;
    }

    if (blockedIds.has(info.id)) {
      conflicts.push({
        ingredientId: info.id,
        ingredientName: info.name,
        reason: "INGREDIENT_ID",
      });
      continue;
    }

    const candidateNames = [info.name, ...info.synonyms].map(normalizeIngredientName);
    const hitTerm = normalizedTerms.find((t) => candidateNames.includes(t));
    if (hitTerm) {
      conflicts.push({
        ingredientId: info.id,
        ingredientName: info.name,
        reason: "TERM_OR_SYNONYM",
        matchedTerm: hitTerm,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

export interface AgeRestrictionViolation {
  ingredientId: string;
  ingredientName: string;
  requiredMinAgeMonth: number;
  targetAgeMonth: number;
  cautionNote: string | null;
}

/**
 * (b) 월령별 금지·주의 식재료 검사 (AGE-05, AI-05 ③)
 * 유아식 전체 금지 재료는 사전에 minAgeMonth > 48(예: 49 또는 60)로 등록한다.
 */
export function checkAgeRestrictions(
  recipeIngredients: readonly Pick<RecipeIngredientInput, "ingredientId">[],
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
  targetAgeMonth: number,
): { allowed: boolean; violations: AgeRestrictionViolation[] } {
  const violations: AgeRestrictionViolation[] = [];

  for (const ri of recipeIngredients) {
    const info = dictionaryById.get(ri.ingredientId);
    if (!info) {
      violations.push({
        ingredientId: ri.ingredientId,
        ingredientName: ri.ingredientId,
        requiredMinAgeMonth: MAX_AGE_MONTH + 1,
        targetAgeMonth,
        cautionNote: "미등록 식재료",
      });
      continue;
    }

    if (info.minAgeMonth > targetAgeMonth) {
      violations.push({
        ingredientId: info.id,
        ingredientName: info.name,
        requiredMinAgeMonth: info.minAgeMonth,
        targetAgeMonth,
        cautionNote: info.cautionNote,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}

/**
 * 재료 분량 + 단위를 그램(g)으로 환산한다.
 * 환산할 수 없거나 비정상 수치이면 null을 반환한다.
 */
export function convertIngredientToGrams(
  amount: number | null,
  unit: string,
  ingredient: IngredientInfo,
): number | null {
  const trimmedUnit = unit.trim();
  if (!trimmedUnit) return null;

  if (PINCH_UNITS.has(trimmedUnit)) {
    if (amount !== null && amount < 0) return null;
    const multiplier = amount === null || amount === 0 ? 1 : amount;
    return multiplier * PINCH_GRAMS;
  }

  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (trimmedUnit in WEIGHT_UNIT_TO_GRAMS) {
    return amount * WEIGHT_UNIT_TO_GRAMS[trimmedUnit];
  }

  if (trimmedUnit in VOLUME_UNIT_TO_ML) {
    const ml = amount * VOLUME_UNIT_TO_ML[trimmedUnit];
    const density = ingredient.densityGPerMl > 0 ? ingredient.densityGPerMl : 1;
    return ml * density;
  }

  if (PIECE_UNITS.has(trimmedUnit)) {
    if (ingredient.gramsPerPiece === null || ingredient.gramsPerPiece <= 0) {
      return null;
    }
    return amount * ingredient.gramsPerPiece;
  }

  return null;
}

export interface SodiumCalculationResult {
  ok: boolean;
  sodiumMgPerServing: number;
  rawSodiumMgPerServing: number;
  totalGramsPerServing: number;
  invalidIngredients: string[];
}

/**
 * (c) 1회분 나트륨 및 총 중량 계산 (AGE-03, AI-05 ④⑤)
 */
export function calculateSodiumPerServing(
  recipeIngredients: readonly RecipeIngredientInput[],
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
  baseServings: number,
): SodiumCalculationResult {
  if (!Number.isInteger(baseServings) || baseServings < MIN_SERVINGS || baseServings > MAX_SERVINGS) {
    return {
      ok: false,
      sodiumMgPerServing: 0,
      rawSodiumMgPerServing: 0,
      totalGramsPerServing: 0,
      invalidIngredients: ["BASE_SERVINGS"],
    };
  }

  let totalSodiumMg = 0;
  let totalGrams = 0;
  const invalidIngredients: string[] = [];

  for (const ri of recipeIngredients) {
    const info = dictionaryById.get(ri.ingredientId);
    if (!info) {
      invalidIngredients.push(ri.ingredientId);
      continue;
    }
    const grams = convertIngredientToGrams(ri.amount, ri.unit, info);
    if (grams === null) {
      invalidIngredients.push(info.name);
      continue;
    }
    totalGrams += grams;
    totalSodiumMg += (grams / 100) * info.sodiumMgPer100g;
  }

  const rawSodiumMgPerServing = totalSodiumMg / baseServings;
  const totalGramsPerServing = totalGrams / baseServings;

  return {
    ok: invalidIngredients.length === 0,
    sodiumMgPerServing: Math.round(rawSodiumMgPerServing),
    rawSodiumMgPerServing,
    totalGramsPerServing,
    invalidIngredients,
  };
}

export interface SaltComplianceResult {
  compliant: boolean;
  maxAllowedMg: number;
  actualMg: number;
  forbiddenSeasonings: string[];
}

/**
 * (d) 나트륨 수치 및 양념이 간 단계 기준을 만족하는지 판정 (AGE-03, AGE-04, AI-05 ④)
 * 무염(NONE) 레시피에는 소금·간장·된장 등 간 양념(isSaltySeasoning)이 미량이라도 들어가면 안 된다.
 */
export function checkSaltLevelCompliance(
  sodiumMgPerServing: number,
  saltLevel: SaltLevel,
  recipeIngredients: readonly Pick<RecipeIngredientInput, "ingredientId">[],
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
): SaltComplianceResult {
  const maxAllowedMg = MAX_SODIUM_MG_PER_SERVING[saltLevel];
  const forbiddenSeasonings: string[] = [];

  if (saltLevel === "NONE") {
    for (const ri of recipeIngredients) {
      const info = dictionaryById.get(ri.ingredientId);
      if (info?.isSaltySeasoning) {
        forbiddenSeasonings.push(info.name);
      }
    }
  }

  const compliant =
    sodiumMgPerServing >= 0 &&
    sodiumMgPerServing <= maxAllowedMg &&
    forbiddenSeasonings.length === 0;

  return {
    compliant,
    maxAllowedMg,
    actualMg: sodiumMgPerServing,
    forbiddenSeasonings,
  };
}

/** 식재료 사전 기준으로 레시피에 포함된 알레르기 유발 성분을 산출한다 (AI-05 ②) */
export function deriveRecipeAllergens(
  recipeIngredients: readonly Pick<RecipeIngredientInput, "ingredientId">[],
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
): Allergen[] {
  const found = new Set<Allergen>();
  for (const ri of recipeIngredients) {
    const info = dictionaryById.get(ri.ingredientId);
    if (!info) continue;
    for (const allergen of info.allergens) {
      found.add(allergen);
    }
  }
  return Array.from(found).sort();
}

export interface RecipeCandidateForSafety {
  name: string;
  category: RecipeCategory;
  ageStages: readonly AgeStage[];
  saltLevel: SaltLevel;
  cookMinutes: number;
  baseServings: number;
  declaredAllergens?: readonly Allergen[];
  ingredients: readonly RecipeIngredientInput[];
  steps: readonly { order: number; instruction: string; timerSeconds?: number | null }[];
  storageInfo: {
    fridgeDays?: number | null;
    freezerDays?: number | null;
    reheatTip: string;
  } | null;
  sources: readonly { url: string; title: string }[];
}

export type SafetyFailureCode =
  | "MISSING_REQUIRED_FIELD"
  | "UNREGISTERED_INGREDIENT"
  | "ALLERGEN_TAG_MISMATCH"
  | "AGE_RESTRICTED_INGREDIENT"
  | "INVALID_AMOUNT_OR_UNIT"
  | "ABNORMAL_PORTION_SIZE"
  | "SODIUM_EXCEEDS_SALT_LEVEL";

export interface SafetyIssue {
  code: SafetyFailureCode;
  message: string;
}

export interface RecipeSafetyReport {
  passed: boolean;
  computedSodiumMgPerServing: number;
  computedTotalGramsPerServing: number;
  derivedAllergens: Allergen[];
  issues: SafetyIssue[];
}

/**
 * AI-05 통합 안전 검증 — 시드 데이터와 AI 생성 레시피 모두 이 함수를 통과해야 게시 가능.
 */
export function validateRecipeSafety(
  candidate: RecipeCandidateForSafety,
  dictionaryById: ReadonlyMap<string, IngredientInfo>,
): RecipeSafetyReport {
  const issues: SafetyIssue[] = [];

  // ⑤ 필수 필드 검증
  if (!candidate.name.trim()) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "메뉴명이 비어 있습니다." });
  }
  if (candidate.ageStages.length === 0) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "적합 연령 단계가 비어 있습니다." });
  }
  for (const stage of candidate.ageStages) {
    try {
      const info = getAgeStageInfo(stage);
      if (info.minMonth < MIN_AGE_MONTH || info.maxMonth > MAX_AGE_MONTH) {
        issues.push({
          code: "MISSING_REQUIRED_FIELD",
          message: `지원 범위 밖 연령 단계: ${stage}`,
        });
      }
    } catch {
      issues.push({ code: "MISSING_REQUIRED_FIELD", message: `알 수 없는 연령 단계: ${stage}` });
    }
  }
  if (!Number.isInteger(candidate.cookMinutes) || candidate.cookMinutes <= 0 || candidate.cookMinutes > 180) {
    issues.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `조리시간이 비정상입니다: ${candidate.cookMinutes}분`,
    });
  }
  if (candidate.ingredients.length === 0) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "재료 목록이 비어 있습니다." });
  }
  const requiredCount = candidate.ingredients.filter((i) => !i.isOptional).length;
  if (requiredCount === 0) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "필수 재료가 최소 1개 이상 필요합니다." });
  }
  if (
    candidate.steps.length === 0 ||
    candidate.steps.some((s) => !s.instruction || !s.instruction.trim())
  ) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "조리 단계 설명이 누락되었습니다." });
  }
  if (!candidate.storageInfo || !candidate.storageInfo.reheatTip?.trim()) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "보관·데우기 안내가 누락되었습니다." });
  }
  if (
    candidate.sources.length === 0 ||
    candidate.sources.some((s) => !s.url.trim() || !s.title.trim())
  ) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", message: "출처 링크가 최소 1개 필요합니다." });
  }

  // ① 모든 재료가 식재료 사전에 매핑되는지 확인
  const unregistered = candidate.ingredients.filter((i) => !dictionaryById.has(i.ingredientId));
  if (unregistered.length > 0) {
    issues.push({
      code: "UNREGISTERED_INGREDIENT",
      message: `식재료 사전에 없는 재료: ${unregistered.map((u) => u.ingredientId).join(", ")}`,
    });
  }

  // ② 알레르기 성분 태그와 재료 목록 교차 검증
  const derivedAllergens = deriveRecipeAllergens(candidate.ingredients, dictionaryById);
  if (candidate.declaredAllergens !== undefined) {
    const declaredSet = new Set(candidate.declaredAllergens);
    const missingTags = derivedAllergens.filter((a) => !declaredSet.has(a));
    if (missingTags.length > 0) {
      issues.push({
        code: "ALLERGEN_TAG_MISMATCH",
        message: `재료에 포함된 알레르기 성분이 태그에서 누락됨: ${missingTags.join(", ")}`,
      });
    }
  }

  // ③ 월령별 금지·주의 식재료 차단 (허용 연령 단계 중 가장 어린 월령 기준)
  if (candidate.ageStages.length > 0 && unregistered.length === 0) {
    let youngestMonth = MIN_AGE_MONTH;
    try {
      youngestMonth = youngestMonthForStages(candidate.ageStages);
    } catch {
      youngestMonth = MIN_AGE_MONTH;
    }
    const ageCheck = checkAgeRestrictions(candidate.ingredients, dictionaryById, youngestMonth);
    if (!ageCheck.allowed) {
      for (const v of ageCheck.violations) {
        issues.push({
          code: "AGE_RESTRICTED_INGREDIENT",
          message: `${v.ingredientName}은(는) 최소 ${v.requiredMinAgeMonth}개월 이상 권장 (대상 ${v.targetAgeMonth}개월)`,
        });
      }
    }
  }

  // ④⑤ 분량 환산 및 나트륨 재계산 검증
  const sodiumCalc = calculateSodiumPerServing(
    candidate.ingredients,
    dictionaryById,
    candidate.baseServings,
  );
  if (!sodiumCalc.ok) {
    issues.push({
      code: "INVALID_AMOUNT_OR_UNIT",
      message: `분량/단위 환산 실패: ${sodiumCalc.invalidIngredients.join(", ")}`,
    });
  } else {
    if (
      sodiumCalc.totalGramsPerServing < MIN_TOTAL_GRAMS_PER_SERVING ||
      sodiumCalc.totalGramsPerServing > MAX_TOTAL_GRAMS_PER_SERVING
    ) {
      issues.push({
        code: "ABNORMAL_PORTION_SIZE",
        message: `1회분 총량(${Math.round(sodiumCalc.totalGramsPerServing)}g)이 허용 범위(${MIN_TOTAL_GRAMS_PER_SERVING}~${MAX_TOTAL_GRAMS_PER_SERVING}g)를 벗어났습니다.`,
      });
    }

    for (const ri of candidate.ingredients) {
      const info = dictionaryById.get(ri.ingredientId);
      if (!info) continue;
      const grams = convertIngredientToGrams(ri.amount, ri.unit, info);
      if (grams !== null && grams / candidate.baseServings > MAX_SINGLE_INGREDIENT_GRAMS_PER_SERVING) {
        issues.push({
          code: "ABNORMAL_PORTION_SIZE",
          message: `개별 재료(${info.name}) 1회분 중량이 상한(${MAX_SINGLE_INGREDIENT_GRAMS_PER_SERVING}g)을 초과합니다.`,
        });
      }
    }

    const saltCheck = checkSaltLevelCompliance(
      sodiumCalc.sodiumMgPerServing,
      candidate.saltLevel,
      candidate.ingredients,
      dictionaryById,
    );
    if (!saltCheck.compliant) {
      const seasoningMsg =
        saltCheck.forbiddenSeasonings.length > 0
          ? ` / 무염 금지 양념 포함(${saltCheck.forbiddenSeasonings.join(", ")})`
          : "";
      issues.push({
        code: "SODIUM_EXCEEDS_SALT_LEVEL",
        message: `1회분 나트륨 ${saltCheck.actualMg}mg (간 단계 ${candidate.saltLevel} 상한 ${saltCheck.maxAllowedMg}mg)${seasoningMsg}`,
      });
    }
  }

  return {
    passed: issues.length === 0,
    computedSodiumMgPerServing: sodiumCalc.sodiumMgPerServing,
    computedTotalGramsPerServing: Math.round(sodiumCalc.totalGramsPerServing),
    derivedAllergens,
    issues,
  };
}
