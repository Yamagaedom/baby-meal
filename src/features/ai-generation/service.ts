/**
 * 즉석 AI 레시피 생성 통합 오케스트레이션 서비스 (PRD 3.9 AI-01~11, ING-06)
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type BabyProfileView, buildBabyAllergyFilter } from "@/features/profile";
import {
  type RecipeDetailView,
  getRecipeDetailForBaby,
  isRecipeSafeForBaby,
  loadIngredientDictionaryMap,
} from "@/features/recipe";
import { getPrisma } from "@/lib/db";
import { ALLERGENS, RECIPE_CATEGORIES, type Allergen, type IngredientInfo } from "@/lib/domain/types";
import { AppError } from "@/lib/http/errors";
import { checkAllergyConflicts } from "@/lib/safety";
import {
  buildGenerationCacheKey,
  getAiQuotaStatus,
  refundAiGenerationSlot,
  reserveAiGenerationSlot,
} from "./cache-and-quota";
import { GeminiRestLlmProvider } from "./gemini-provider";
import { YouTubeDataApiSearchProvider, mergeAndRankSources } from "./search";
import type {
  AiGenerationRequestContext,
  AiQuotaStatus,
  AiRecipeLlmProvider,
  AiSearchProvider,
  CollectedSource,
  ValidatedAiRecipePayload,
} from "./types";
import { validateAiGeneratedCandidate } from "./validator";

export const MAX_AI_RETRIES = 2; // 최초 1회 + 최대 2회 재생성 = 총 3회 시도
export const ON_DEMAND_TIMEOUT_MS = 25_000;

export const onDemandAiGenerateInputSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).min(1, "재료를 1개 이상 선택해 주세요.").max(15),
  category: z.enum(RECIPE_CATEGORIES).optional().default("MEAL"),
});

export interface GenerateOnDemandDependencies {
  prisma?: PrismaClient;
  searchProvider?: AiSearchProvider;
  llmProvider?: AiRecipeLlmProvider;
  now?: Date;
  globalLimitOverride?: number;
  timeoutMs?: number;
}

/** 검증 통과한 AI 레시피 페이로드를 DB에 저장한다 (출처 링크 포함, 출처 이미지 없음) */
export async function persistValidatedAiRecipe(
  payload: ValidatedAiRecipePayload,
  options: { cacheKey?: string | null; slug?: string | null },
  prisma: PrismaClient = getPrisma(),
): Promise<string> {
  const created = await prisma.recipe.create({
    data: {
      slug: options.slug ?? null,
      cacheKey: options.cacheKey ?? null,
      name: payload.name,
      summary: payload.summary,
      category: payload.category,
      mealCategories: payload.mealCategories,
      ageStages: payload.ageStages,
      saltLevel: payload.saltLevel,
      cookMinutes: payload.cookMinutes,
      difficulty: payload.difficulty,
      tools: payload.tools,
      baseServings: payload.baseServings,
      sodiumMgPerServing: payload.sodiumMgPerServing,
      allergens: payload.allergens,
      steps: payload.steps,
      babyTips: payload.babyTips,
      storageInfo: payload.storageInfo,
      status: "ACTIVE",
      qualityScore: 0,
      ingredients: {
        create: payload.ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          amount: ing.amount,
          unit: ing.unit,
          prepNote: ing.prepNote,
          isOptional: ing.isOptional,
          substituteId: ing.substituteId,
        })),
      },
      sources: {
        create: payload.sources.map((src) => ({
          url: src.url,
          title: src.title,
          channelOrSite: src.channelOrSite,
          sourceType: src.sourceType,
          trustScore: src.trustScore,
        })),
      },
    },
    select: { id: true },
  });

  return created.id;
}

/**
 * E2E 자동화 테스트 전용 결정적 모킹 프로바이더 (AI_E2E_MOCK_MODE=1 환경변수가 명시된 테스트 서버에서만 활성화)
 */
function buildDevMockProvidersIfEnabled(
  mockBehavior?: string | null,
  allowE2eMock?: boolean,
): { searchProvider: AiSearchProvider; llmProvider: AiRecipeLlmProvider } | null {
  const isExplicitE2eMock =
    process.env.AI_E2E_MOCK_MODE === "1" &&
    (allowE2eMock === true || process.env.NODE_ENV !== "production");
  const isDevMock = process.env.NODE_ENV !== "production" && process.env.AI_MOCK_MODE === "1";
  if (!isExplicitE2eMock && !isDevMock) {
    return null;
  }

  const searchProvider: AiSearchProvider = {
    async searchSources(input) {
      return [
        {
          url: `https://www.foodsafetykorea.go.kr/portal/board/board.do?q=${encodeURIComponent(input.queryText)}`,
          title: `[공공영양자료] ${input.queryText} 조리 가이드`,
          channelOrSite: "식품안전나라",
          sourceType: "PUBLIC_INSTITUTION",
          trustScore: 0.95,
        },
      ];
    },
  };

  const llmProvider: AiRecipeLlmProvider = {
    async generateRecipeJson(ctx, referenceSources) {
      if (mockBehavior === "FAIL_SAFETY") {
        // 미등록 식재료 + 꿀 포함으로 안전 검증 실패 유도
        return {
          rawJsonText: JSON.stringify({
            name: "실패유도레시피",
            summary: "안전 검증 반려 테스트용 응답",
            category: ctx.category,
            mealCategories: ctx.category === "SNACK" ? ["SNACK"] : ["LUNCH"],
            ageStages: [ctx.ageStage],
            saltLevel: ctx.saltLevel,
            cookMinutes: 15,
            difficulty: 1,
            tools: ["냄비"],
            baseServings: 2,
            declaredAllergens: [],
            ingredients: [{ name: "사전에없는외계식재료", amount: 50, unit: "g" }],
            steps: [
              { order: 1, instruction: "재료를 손질합니다." },
              { order: 2, instruction: "익혀서 완성합니다." },
            ],
            babyTips: {
              textureTip: "부드럽게 익힙니다.",
              cuttingSizeTip: "작게 다집니다.",
              seasoningTip: "간을 하지 않습니다.",
              stageVariations: {},
            },
            storageInfo: {
              fridgeDays: 2,
              freezerDays: 14,
              reheatTip: "전자레인지에 데워 주세요.",
            },
            sources: referenceSources,
          }),
          groundingSources: [],
        };
      }

      if (mockBehavior === "UPSTREAM_ERROR") {
        throw new AppError(
          502,
          "AI_UPSTREAM_ERROR",
          "AI 레시피 생성 요청 처리에 실패했습니다. (생성 횟수는 차감되지 않았습니다)",
        );
      }

      const mainNames = ctx.selectedIngredientNames.slice(0, 3);
      const baseIng = ctx.category === "SNACK" ? "감자" : "쌀밥";
      const useNames = Array.from(new Set([baseIng, ...mainNames]));

      // 사전 기준 알레르기 태그를 정확히 맞추기 위해 대표 매핑
      const allergenByIngName: Record<string, Allergen[]> = {
        소고기: ["BEEF"],
        소고기다짐육: ["BEEF"],
        닭안심: ["CHICKEN"],
        닭가슴살: ["CHICKEN"],
        두부: ["SOYBEAN"],
        순두부: ["SOYBEAN"],
        달걀: ["EGG"],
        우유: ["MILK"],
      };
      const declared = new Set<Allergen>();
      for (const n of useNames) {
        for (const a of allergenByIngName[n] ?? []) {
          declared.add(a);
        }
      }

      const recipeTitle = `${mainNames.join("") || "채소"}영양${ctx.category === "SNACK" ? "스틱" : "진밥"}`;

      return {
        rawJsonText: JSON.stringify({
          name: recipeTitle,
          summary: `${useNames.join(", ")}의 자연스러운 맛을 살려 만든 맞춤 ${ctx.category === "SNACK" ? "간식" : "유아식"}`,
          category: ctx.category,
          mealCategories: ctx.category === "SNACK" ? ["SNACK"] : ["LUNCH", "DINNER"],
          ageStages: [ctx.ageStage],
          saltLevel: ctx.saltLevel,
          cookMinutes: 18,
          difficulty: 1,
          tools: ["냄비"],
          baseServings: 2,
          declaredAllergens: Array.from(declared),
          ingredients: [
            ...useNames.map((n, idx) => ({
              name: n,
              amount: idx === 0 ? 120 : 40,
              unit: "g",
              prepNote: "아기 한입 크기로 손질",
              isOptional: false,
              substituteName: null,
            })),
            {
              name: "물",
              amount: 100,
              unit: "ml",
              prepNote: null,
              isOptional: false,
              substituteName: null,
            },
          ],
          steps: [
            {
              order: 1,
              instruction: `${useNames.join(", ")} 재료를 깨끗이 씻어 아기 월령에 맞게 잘게 손질합니다.`,
              timerSeconds: null,
            },
            {
              order: 2,
              instruction: "냄비에 분량의 물과 손질한 재료를 넣고 중약불에서 푹 무르게 익힙니다.",
              timerSeconds: 300,
            },
            {
              order: 3,
              instruction: "농도를 확인한 뒤 한 김 식혀 아기 그릇에 담아냅니다.",
              timerSeconds: 60,
            },
          ],
          babyTips: {
            textureTip: "숟가락으로 가볍게 으깨지는 부드러운 식감으로 익혀 주세요.",
            cuttingSizeTip: "질식 위험이 없도록 5~8mm 내외로 손질합니다.",
            seasoningTip: "소금이나 설탕 없이 식재료 본연의 단맛과 감칠맛을 활용합니다.",
            stageVariations: {
              [String(ctx.ageStage)]: "현재 아기 월령 식감에 맞춰 수분량을 조절해 주세요.",
            },
          },
          storageInfo: {
            fridgeDays: 2,
            freezerDays: 14,
            reheatTip: "물 1작은술을 더해 전자레인지에서 1분 30초 데운 뒤 온도를 확인하세요.",
            portionTip: "한 끼 분량씩 밀폐 용기에 소분해 식힌 뒤 보관하세요.",
          },
          sources: referenceSources,
        }),
        groundingSources: [],
      };
    },
  };

  return { searchProvider, llmProvider };
}

/**
 * AI-01~11, ING-06: 즉석 AI 레시피 생성 엔드투엔드 파이프라인
 * - 캐시 적중 시 한도 미차감
 * - 검증 실패(최대 2회 재시도 후 폐기)·외부 오류·타임아웃 시 한도 즉시 환불(미차감)
 */
export async function generateOnDemandRecipeForBaby(
  userId: string,
  baby: BabyProfileView,
  rawInput: unknown,
  deps: GenerateOnDemandDependencies & {
    mockBehavior?: string | null;
    allowE2eMock?: boolean;
  } = {},
): Promise<{
  recipe: RecipeDetailView;
  cached: boolean;
  quota: AiQuotaStatus;
}> {
  const prisma = deps.prisma ?? getPrisma();
  const now = deps.now ?? new Date();
  const input = onDemandAiGenerateInputSchema.parse(rawInput);

  const dictMap = await loadIngredientDictionaryMap(prisma);
  const allDictionary: IngredientInfo[] = Array.from(dictMap.values());
  const allergyProfile = buildBabyAllergyFilter(baby);

  // 선택된 재료가 식재료 사전에 존재하고 아기 알레르기·유아식 금지 재료가 아닌지 먼저 확인
  const uniqueIngredientIds = Array.from(new Set(input.ingredientIds));
  const selectedInfos: IngredientInfo[] = [];
  for (const id of uniqueIngredientIds) {
    const info = dictMap.get(id);
    if (!info || info.minAgeMonth > 48) {
      throw new AppError(400, "INVALID_INGREDIENT", "유효하지 않은 식재료가 포함되어 있습니다.");
    }
    selectedInfos.push(info);
  }

  const inputAllergyCheck = checkAllergyConflicts(
    selectedInfos.map((i) => ({ ingredientId: i.id })),
    dictMap,
    allergyProfile,
  );
  if (inputAllergyCheck.hasConflict) {
    throw new AppError(
      400,
      "ALLERGY_CONFLICT_INPUT",
      "선택한 재료 중 아기의 알레르기·주의 식재료가 포함되어 있어 생성할 수 없습니다.",
    );
  }

  // 제외 알레르기 코드 집합 산출 (직접 등록된 식재료가 단일 알레르기 원재료인 경우도 포함)
  const effectiveExcludedAllergens = new Set<Allergen>(allergyProfile.allergens ?? []);
  const excludedIngredientIds = new Set<string>(allergyProfile.ingredientIds ?? []);
  const excludedIngredientNames: string[] = [];
  for (const id of excludedIngredientIds) {
    const info = dictMap.get(id);
    if (info) {
      excludedIngredientNames.push(info.name);
      if (info.group !== "PROCESSED" && info.allergens.length === 1) {
        effectiveExcludedAllergens.add(info.allergens[0]);
      }
    }
  }

  const cacheKey = buildGenerationCacheKey({
    category: input.category,
    ageStage: baby.ageStage,
    saltLevel: baby.saltLevel,
    ingredientIds: uniqueIngredientIds,
    excludedAllergens: Array.from(effectiveExcludedAllergens),
    excludedIngredientIds: Array.from(excludedIngredientIds),
  });

  // 1. 캐시 조회 (AI-09, AI-10: 캐시 적중 시 횟수 차감 없음)
  const cachedRow = await prisma.recipe.findUnique({
    where: { cacheKey },
    include: { ingredients: { select: { ingredientId: true } } },
  });
  if (
    cachedRow &&
    cachedRow.status === "ACTIVE" &&
    isRecipeSafeForBaby(cachedRow.ingredients, dictMap, baby)
  ) {
    const [detail, quota] = await Promise.all([
      getRecipeDetailForBaby(userId, baby, cachedRow.id, undefined, prisma),
      getAiQuotaStatus(userId, prisma, now, deps.globalLimitOverride),
    ]);
    return {
      recipe: detail,
      cached: true,
      quota,
    };
  }

  // 2. 원자적 일일 한도 예약 (동시 4개 요청 레이스 컨디션 차단 + 전역 상한 보호)
  const reservation = await reserveAiGenerationSlot(
    userId,
    prisma,
    now,
    deps.globalLimitOverride,
  );

  const mockProviders = buildDevMockProvidersIfEnabled(deps.mockBehavior, deps.allowE2eMock);
  const searchProvider =
    deps.searchProvider ?? mockProviders?.searchProvider ?? new YouTubeDataApiSearchProvider();
  const llmProvider =
    deps.llmProvider ?? mockProviders?.llmProvider ?? new GeminiRestLlmProvider();

  const allowedIngredientsForBaby = allDictionary
    .filter(
      (item) =>
        item.minAgeMonth <= baby.currentAgeMonth &&
        !checkAllergyConflicts([{ ingredientId: item.id }], dictMap, allergyProfile).hasConflict,
    )
    .map((item) => item.name);

  const timeoutMs = deps.timeoutMs ?? ON_DEMAND_TIMEOUT_MS;
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  let savedRecipeId: string | null = null;
  let usedCachedFallbackId: string | null = null;

  try {
    const queryText = selectedInfos.map((i) => i.name).join(" ");
    let externalSources: CollectedSource[] = [];
    try {
      externalSources = await searchProvider.searchSources({
        queryText,
        ageStage: baby.ageStage,
        saltLevel: baby.saltLevel,
        signal: abortController.signal,
      });
    } catch {
      // 검색 실패 시 공공기관 검증 출처로 폴백
      externalSources = [];
    }

    // 외부 검색 결과가 없으면 공공기관 검증 출처(식품안전나라)를 기본 제공하여 빠른 순수 JSON 생성과 확실한 출처를 보장
    if (externalSources.length === 0) {
      externalSources = [
        {
          url: "https://www.foodsafetykorea.go.kr/portal/board/board.do",
          title: "영유아 이유식 및 유아식 식생활 안전 가이드",
          channelOrSite: "식품안전나라",
          sourceType: "PUBLIC_INSTITUTION",
          trustScore: 0.95,
        },
      ];
    }

    let previousFailureReasons: string[] = [];
    let validatedPayload: ValidatedAiRecipePayload | null = null;

    for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt += 1) {
      const ctx: AiGenerationRequestContext = {
        category: input.category,
        ageStage: baby.ageStage,
        saltLevel: baby.saltLevel,
        selectedIngredientNames: selectedInfos.map((i) => i.name),
        excludedAllergens: Array.from(effectiveExcludedAllergens).filter((a) =>
          (ALLERGENS as readonly string[]).includes(a),
        ),
        excludedIngredientNames,
        allowedIngredientNames: allowedIngredientsForBaby,
        attempt,
        previousFailureReasons,
      };

      const llmResult = await llmProvider.generateRecipeJson(
        ctx,
        externalSources,
        abortController.signal,
      );

      const combinedExternal = mergeAndRankSources(
        [externalSources, llmResult.groundingSources],
        5,
      );

      const validation = validateAiGeneratedCandidate({
        rawJsonText: llmResult.rawJsonText,
        externalSources: combinedExternal,
        dictionary: allDictionary,
        targetAllergyProfile: allergyProfile,
        requiredCategory: input.category,
        requiredAgeStage: baby.ageStage,
        requiredSaltLevel: baby.saltLevel,
      });

      if (validation.passed) {
        validatedPayload = validation.payload;
        break;
      }

      previousFailureReasons = validation.issues.map((iss) => `[${iss.code}] ${iss.message}`);
    }

    if (!validatedPayload) {
      console.warn("[AI-05 Safety Gate Rejected after retries]", {
        userId,
        reasons: previousFailureReasons,
      });
      throw new AppError(
        422,
        "AI_SAFETY_REJECTED",
        "생성된 레시피가 영유아 안전 기준(식재료·나트륨·분량 검증)을 통과하지 못해 폐기되었습니다. 다른 재료 조합으로 다시 시도해 주세요. (생성 횟수는 차감되지 않았습니다)",
        previousFailureReasons.join("; "),
      );
    }

    try {
      savedRecipeId = await persistValidatedAiRecipe(validatedPayload, { cacheKey }, prisma);
    } catch (dbErr) {
      // 동시 동일 조건 생성 요청이 먼저 cacheKey를 저장한 경우 기존 레시피를 재사용하고 횟수는 환불한다.
      const concurrentCached = await prisma.recipe.findUnique({
        where: { cacheKey },
        select: { id: true, status: true },
      });
      if (concurrentCached && concurrentCached.status === "ACTIVE") {
        usedCachedFallbackId = concurrentCached.id;
      } else {
        throw dbErr;
      }
    }
  } catch (err) {
    await refundAiGenerationSlot(userId, reservation.dbDate, prisma);
    if (err instanceof AppError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError(
        504,
        "AI_TIMEOUT",
        "AI 레시피 생성 시간이 초과되었습니다(20초). 잠시 후 다시 시도해 주세요. (생성 횟수는 차감되지 않았습니다)",
        err.message,
      );
    }
    throw new AppError(
      502,
      "AI_GENERATION_FAILED",
      "AI 레시피 생성 중 오류가 발생했습니다. (생성 횟수는 차감되지 않았습니다)",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }

  if (usedCachedFallbackId) {
    await refundAiGenerationSlot(userId, reservation.dbDate, prisma);
    const [detail, quota] = await Promise.all([
      getRecipeDetailForBaby(userId, baby, usedCachedFallbackId, undefined, prisma),
      getAiQuotaStatus(userId, prisma, now, deps.globalLimitOverride),
    ]);
    return {
      recipe: detail,
      cached: true,
      quota,
    };
  }

  const [detail, quota] = await Promise.all([
    getRecipeDetailForBaby(userId, baby, savedRecipeId!, undefined, prisma),
    getAiQuotaStatus(userId, prisma, now, deps.globalLimitOverride),
  ]);

  return {
    recipe: detail,
    cached: false,
    quota,
  };
}
