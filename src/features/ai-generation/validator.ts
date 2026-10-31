/**
 * AI 생성 레시피 규칙 기반 자동 안전 검증기 (PRD 3.9 AI-05)
 *
 * 사람 검수가 없으므로 이 검증기가 유일한 안전 게이트다:
 * 0. JSON 파싱 + Zod 스키마 검사 (깨진 JSON·필드 누락 즉시 반려)
 * ① 모든 식재료가 식재료 사전에 매핑되는지 확인 (미등록 식재료 1개라도 있으면 불통과)
 * ② AI가 주장한 알레르기 태그를 신뢰하지 않고 사전 기준으로 재계산·교차검증 + 아기 제외 알레르기 포함 시 불통과
 * ③ 월령별 금지·주의 식재료 차단 (꿀, 통견과, 날음식 등)
 * ④ 식재료 사전 기준 1회분 나트륨 재계산으로 무염/저염/일반 상한 및 무염 금지 양념 검증
 * ⑤ 필수 필드·단위 환산·1회분 총량 범위·최소 1개 이상의 유효한 https/http 출처 링크 검사
 */
import type { AgeStage, Allergen, IngredientInfo } from "@/lib/domain/types";
import {
  type BabyAllergyProfile,
  checkAllergyConflicts,
  findIngredientByName,
  validateRecipeSafety,
} from "@/lib/safety";
import { type AiGeneratedRecipeRaw, aiGeneratedRecipeRawSchema } from "./prompt-and-schema";
import { classifySourceType, computeSourceTrustScore, mergeAndRankSources } from "./search";
import type { CollectedSource, ValidatedAiRecipePayload } from "./types";

export type AiValidationErrorCode =
  | "INVALID_JSON_OR_SCHEMA"
  | "UNREGISTERED_INGREDIENT"
  | "DUPLICATE_INGREDIENT"
  | "ALLERGEN_TAG_MISMATCH"
  | "EXCLUDED_ALLERGEN_INCLUDED"
  | "AGE_RESTRICTED_INGREDIENT"
  | "INVALID_AMOUNT_OR_UNIT"
  | "ABNORMAL_PORTION_SIZE"
  | "SODIUM_EXCEEDS_SALT_LEVEL"
  | "MISSING_REQUIRED_FIELD";

export interface AiValidationIssue {
  code: AiValidationErrorCode;
  message: string;
}

export type AiValidationOutcome =
  | {
      passed: true;
      payload: ValidatedAiRecipePayload;
      issues: [];
    }
  | {
      passed: false;
      payload: null;
      issues: AiValidationIssue[];
    };

export interface ValidateAiCandidateOptions {
  rawJsonText: string;
  externalSources: readonly CollectedSource[];
  dictionary: readonly IngredientInfo[];
  targetAllergyProfile?: BabyAllergyProfile;
  requiredCategory?: "MEAL" | "SNACK";
  requiredAgeStage?: AgeStage;
  requiredSaltLevel?: "NONE" | "LOW" | "NORMAL";
}

export function validateAiGeneratedCandidate(
  options: ValidateAiCandidateOptions,
): AiValidationOutcome {
  // 0. JSON 파싱 및 Zod 구조 검증
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(options.rawJsonText);
  } catch {
    return {
      passed: false,
      payload: null,
      issues: [
        {
          code: "INVALID_JSON_OR_SCHEMA",
          message: "AI 출력이 유효한 JSON 형식이 아닙니다.",
        },
      ],
    };
  }

  const schemaResult = aiGeneratedRecipeRawSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    const detail = schemaResult.error.issues
      .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
      .join("; ");
    return {
      passed: false,
      payload: null,
      issues: [
        {
          code: "INVALID_JSON_OR_SCHEMA",
          message: `AI JSON 스키마 불일치: ${detail}`,
        },
      ],
    };
  }

  const raw: AiGeneratedRecipeRaw = schemaResult.data;
  const issues: AiValidationIssue[] = [];

  if (options.requiredCategory && raw.category !== options.requiredCategory) {
    issues.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `요청한 카테고리(${options.requiredCategory})와 다른 카테고리(${raw.category})가 반환되었습니다.`,
    });
  }

  if (
    options.requiredAgeStage &&
    !(raw.ageStages as number[]).includes(options.requiredAgeStage)
  ) {
    issues.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `요청한 연령 단계(${options.requiredAgeStage}단계)가 적합 연령 단계에 포함되지 않았습니다.`,
    });
  }

  if (options.requiredSaltLevel && raw.saltLevel !== options.requiredSaltLevel) {
    issues.push({
      code: "SODIUM_EXCEEDS_SALT_LEVEL",
      message: `요청한 간 단계(${options.requiredSaltLevel})와 다른 간 단계(${raw.saltLevel})가 반환되었습니다.`,
    });
  }

  // ① 식재료 사전 매핑 검사 (미등록 식재료 1개라도 있으면 즉시 불통과)
  const dictMap = new Map<string, IngredientInfo>(options.dictionary.map((d) => [d.id, d]));
  const mappedIngredients: ValidatedAiRecipePayload["ingredients"] = [];
  const seenPrimaryIds = new Set<string>();

  for (const item of raw.ingredients) {
    const found = findIngredientByName(options.dictionary, item.name);
    if (!found) {
      issues.push({
        code: "UNREGISTERED_INGREDIENT",
        message: `식재료 사전에 등록되지 않은 재료입니다: "${item.name}"`,
      });
      continue;
    }

    if (seenPrimaryIds.has(found.id)) {
      issues.push({
        code: "DUPLICATE_INGREDIENT",
        message: `동일한 식재료가 중복 기재되었습니다: "${found.name}"`,
      });
      continue;
    }
    seenPrimaryIds.add(found.id);

    let substituteId: string | null = null;
    if (item.substituteName && item.substituteName.trim()) {
      const subFound = findIngredientByName(options.dictionary, item.substituteName);
      if (!subFound) {
        issues.push({
          code: "UNREGISTERED_INGREDIENT",
          message: `대체 식재료가 식재료 사전에 없습니다: "${item.substituteName}"`,
        });
      } else if (subFound.id !== found.id) {
        substituteId = subFound.id;
      }
    }

    mappedIngredients.push({
      ingredientId: found.id,
      amount: item.amount,
      unit: item.unit.trim(),
      prepNote: item.prepNote?.trim() || null,
      isOptional: Boolean(item.isOptional),
      substituteId,
    });
  }

  // 출처 병합 및 검증 (외부 검색 출처 우선 + 모델 반환 출처 보조, 최소 1개 필수)
  const rawConvertedSources: CollectedSource[] = raw.sources.map((s) => {
    const st = s.sourceType ?? classifySourceType(s.url, s.channelOrSite, s.title);
    return {
      url: s.url,
      title: s.title,
      channelOrSite: s.channelOrSite,
      sourceType: st,
      trustScore: computeSourceTrustScore({
        url: s.url,
        title: s.title,
        channelOrSite: s.channelOrSite,
        sourceType: st,
      }),
    };
  });

  const mergedSources = mergeAndRankSources([options.externalSources, rawConvertedSources], 5);

  if (issues.some((i) => i.code === "UNREGISTERED_INGREDIENT" || i.code === "DUPLICATE_INGREDIENT")) {
    return { passed: false, payload: null, issues };
  }

  // ②~⑤ 1단계 lib/safety.validateRecipeSafety()로 교차 검증 실행
  const ageStages = Array.from(new Set(raw.ageStages)).sort() as AgeStage[];
  const safetyReport = validateRecipeSafety(
    {
      name: raw.name,
      category: raw.category,
      ageStages,
      saltLevel: raw.saltLevel,
      cookMinutes: raw.cookMinutes,
      baseServings: raw.baseServings,
      declaredAllergens: raw.declaredAllergens as Allergen[],
      ingredients: mappedIngredients.map((mi) => ({
        ingredientId: mi.ingredientId,
        amount: mi.amount,
        unit: mi.unit,
        isOptional: mi.isOptional,
      })),
      steps: raw.steps,
      storageInfo: {
        fridgeDays: raw.storageInfo.fridgeDays ?? null,
        freezerDays: raw.storageInfo.freezerDays ?? null,
        reheatTip: raw.storageInfo.reheatTip,
      },
      sources: mergedSources.map((s) => ({ url: s.url, title: s.title })),
    },
    dictMap,
  );

  for (const si of safetyReport.issues) {
    issues.push({
      code: si.code,
      message: si.message,
    });
  }

  // ② 추가 검증: 아기 제외 알레르기·기피 재료가 레시피(대체 재료 포함)에 섞여 있는지 사전 기준으로 재차단
  if (options.targetAllergyProfile) {
    const checkTargets = [
      ...mappedIngredients.map((m) => ({ ingredientId: m.ingredientId })),
      ...mappedIngredients
        .filter((m) => m.substituteId !== null)
        .map((m) => ({ ingredientId: m.substituteId! })),
    ];
    const allergyConflict = checkAllergyConflicts(
      checkTargets,
      dictMap,
      options.targetAllergyProfile,
    );
    if (allergyConflict.hasConflict) {
      issues.push({
        code: "EXCLUDED_ALLERGEN_INCLUDED",
        message: `제외 요청된 알레르기·주의 식재료가 포함되었습니다: ${allergyConflict.conflicts.map((c) => c.ingredientName).join(", ")}`,
      });
    }
  }

  if (issues.length > 0 || !safetyReport.passed) {
    return {
      passed: false,
      payload: null,
      issues,
    };
  }

  // 핵심 안전 원칙(AI-05 ②): DB 저장 시 AI가 선언한 declaredAllergens가 아니라
  // 식재료 사전 기준으로 재계산된 derivedAllergens와 computedSodiumMgPerServing만 사용한다.
  const sortedSteps = raw.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({
      order: idx + 1,
      instruction: s.instruction.trim(),
      timerSeconds: s.timerSeconds ?? null,
    }));

  return {
    passed: true,
    issues: [],
    payload: {
      name: raw.name.trim(),
      summary: raw.summary.trim(),
      category: raw.category,
      mealCategories: Array.from(new Set(raw.mealCategories)),
      ageStages,
      saltLevel: raw.saltLevel,
      cookMinutes: raw.cookMinutes,
      difficulty: raw.difficulty,
      tools: raw.tools,
      baseServings: raw.baseServings,
      sodiumMgPerServing: safetyReport.computedSodiumMgPerServing,
      allergens: safetyReport.derivedAllergens,
      ingredients: mappedIngredients,
      steps: sortedSteps,
      babyTips: {
        textureTip: raw.babyTips.textureTip.trim(),
        cuttingSizeTip: raw.babyTips.cuttingSizeTip.trim(),
        seasoningTip: raw.babyTips.seasoningTip.trim(),
        stageVariations: raw.babyTips.stageVariations ?? {},
      },
      storageInfo: {
        fridgeDays: raw.storageInfo.fridgeDays ?? 2,
        freezerDays: raw.storageInfo.freezerDays ?? 14,
        reheatTip: raw.storageInfo.reheatTip.trim(),
        portionTip:
          raw.storageInfo.portionTip?.trim() ||
          "한 끼 분량씩 밀폐 용기에 소분해 식힌 뒤 냉장·냉동 보관하세요.",
      },
      sources: mergedSources,
    },
  };
}
