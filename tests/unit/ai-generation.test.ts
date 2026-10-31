import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signupUser } from "@/features/auth";
import {
  calculateQualityScoreFromCounts,
  computeSourceTrustScore,
  extractJsonFromModelText,
  generateOnDemandRecipeForBaby,
  getAiQuotaStatus,
  validateAiGeneratedCandidate,
  GeminiRestLlmProvider,
  type AiRecipeLlmProvider,
  type AiSearchProvider,
  type CollectedSource,
} from "@/features/ai-generation";
import { createBabyProfile } from "@/features/profile";
import { loadIngredientDictionaryMap } from "@/features/recipe";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import type { IngredientInfo } from "@/lib/domain/types";

describe("AI 레시피 생성 파이프라인 및 안전 검증 게이트 (AI-01~11)", () => {
  const prisma = getPrisma();
  const createdUserIds: string[] = [];
  let dictionary: IngredientInfo[] = [];

  const samplePublicSources: CollectedSource[] = [
    {
      url: "https://www.foodsafetykorea.go.kr/portal/healthyfoodlife/guide",
      title: "영유아 조리 안전 가이드",
      channelOrSite: "식품안전나라",
      sourceType: "PUBLIC_INSTITUTION",
      trustScore: 0.95,
    },
  ];

  beforeAll(async () => {
    const dictMap = await loadIngredientDictionaryMap(prisma);
    dictionary = Array.from(dictMap.values());
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.recipe.deleteMany({
      where: {
        OR: [{ name: { startsWith: "[AI단위테스트]" } }],
      },
    });
  });

  it("AI-02: 출처 신뢰도 점수는 공공기관 > 유아식 전문 채널 > 일반 채널 순이며 조회수 가산이 반영된다", () => {
    const publicScore = computeSourceTrustScore({
      url: "https://www.foodsafetykorea.go.kr/guide",
      title: "영유아 영양 관리",
      channelOrSite: "식품안전나라",
      sourceType: "PUBLIC_INSTITUTION",
    });
    const specialistScore = computeSourceTrustScore({
      url: "https://www.youtube.com/watch?v=abc123",
      title: "15개월 무염 유아식 한그릇",
      channelOrSite: "소아과영양사맘마",
      sourceType: "YOUTUBE",
      viewCount: 50_000,
    });
    const generalLowViews = computeSourceTrustScore({
      url: "https://www.youtube.com/watch?v=xyz999",
      title: "오늘의 브이로그 요리",
      channelOrSite: "일상채널",
      sourceType: "YOUTUBE",
      viewCount: 200,
    });
    const generalHighViews = computeSourceTrustScore({
      url: "https://www.youtube.com/watch?v=xyz888",
      title: "오늘의 브이로그 요리",
      channelOrSite: "일상채널",
      sourceType: "YOUTUBE",
      viewCount: 500_000,
    });

    expect(publicScore).toBeGreaterThan(specialistScore);
    expect(specialistScore).toBeGreaterThan(generalHighViews);
    expect(generalHighViews).toBeGreaterThan(generalLowViews);
  });

  it("AI-04: GeminiRestLlmProvider는 GEMINI_MODEL 환경변수 또는 기본값 'gemini-2.5-flash'를 사용하고 JSON을 정상 추출한다", () => {
    const defaultProvider = new GeminiRestLlmProvider("dummy-key");
    expect(defaultProvider.getModelName()).toBe(process.env.GEMINI_MODEL || "gemini-2.5-flash");

    const customProvider = new GeminiRestLlmProvider("dummy-key", "gemini-2.0-flash");
    expect(customProvider.getModelName()).toBe("gemini-2.0-flash");

    expect(extractJsonFromModelText('```json\n{"name": "test"}\n```')).toBe('{"name": "test"}');
    expect(extractJsonFromModelText('앞부분 설명 {"name": "test"} 뒷부분 설명')).toBe('{"name": "test"}');
  });

  it("AI-05 'AI가 거짓말하는' 7종 케이스(JSON 깨짐, 미등록 재료, 알레르기 태그 누락, 꿀/통견과 포함, 간장 과다, 음수·비정상 분량, 출처 없음)를 모두 차단한다", () => {
    const makeBaseCandidate = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        name: "테스트진밥",
        summary: "안전 검증 테스트용 레시피입니다.",
        category: "MEAL",
        mealCategories: ["LUNCH"],
        ageStages: [1],
        saltLevel: "NONE",
        cookMinutes: 18,
        difficulty: 1,
        tools: ["냄비"],
        baseServings: 2,
        declaredAllergens: ["BEEF"],
        ingredients: [
          { name: "쌀밥", amount: 150, unit: "g" },
          { name: "소고기다짐육", amount: 40, unit: "g" },
          { name: "애호박", amount: 40, unit: "g" },
          { name: "채수", amount: 120, unit: "ml" },
        ],
        steps: [
          { order: 1, instruction: "재료를 잘게 손질합니다." },
          { order: 2, instruction: "냄비에 넣고 푹 끓여 완성합니다.", timerSeconds: 300 },
        ],
        babyTips: {
          textureTip: "무르게 익힙니다.",
          cuttingSizeTip: "5mm 크기로 다집니다.",
          seasoningTip: "채수로 맛을 냅니다.",
          stageVariations: {},
        },
        storageInfo: {
          fridgeDays: 2,
          freezerDays: 14,
          reheatTip: "전자레인지에 데워 주세요.",
        },
        sources: [],
        ...overrides,
      });

    // 0) JSON 깨짐
    const brokenJson = validateAiGeneratedCandidate({
      rawJsonText: '{"name": "깨진JSON", ',
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(brokenJson.passed).toBe(false);
    if (!brokenJson.passed) {
      expect(brokenJson.issues.some((i) => i.code === "INVALID_JSON_OR_SCHEMA")).toBe(true);
    }

    // ① 미등록 재료 포함
    const unregistered = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        ingredients: [
          { name: "쌀밥", amount: 150, unit: "g" },
          { name: "우주신비버섯추출물", amount: 30, unit: "g" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(unregistered.passed).toBe(false);
    if (!unregistered.passed) {
      expect(unregistered.issues.some((i) => i.code === "UNREGISTERED_INGREDIENT")).toBe(true);
    }

    // ② 알레르기 태그 누락 (달걀을 넣으면서 declaredAllergens를 빈 배열로 거짓말 + 달걀 알레르기 아기 필터)
    const missingAllergen = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        declaredAllergens: [],
        ingredients: [
          { name: "쌀밥", amount: 150, unit: "g" },
          { name: "달걀", amount: 1, unit: "개" },
          { name: "채수", amount: 100, unit: "ml" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
      targetAllergyProfile: { allergens: ["EGG"] },
    });
    expect(missingAllergen.passed).toBe(false);
    if (!missingAllergen.passed) {
      expect(missingAllergen.issues.some((i) => i.code === "ALLERGEN_TAG_MISMATCH")).toBe(true);
      expect(missingAllergen.issues.some((i) => i.code === "EXCLUDED_ALLERGEN_INCLUDED")).toBe(
        true,
      );
    }

    // ③ 월령 금지 재료: 1단계(12개월 포함) 레시피에 꿀(13개월 이상) 및 통땅콩(49개월 이상) 포함
    const honeyAndNut = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        declaredAllergens: ["PEANUT"],
        ingredients: [
          { name: "쌀밥", amount: 150, unit: "g" },
          { name: "꿀", amount: 5, unit: "g" },
          { name: "통땅콩", amount: 10, unit: "g" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(honeyAndNut.passed).toBe(false);
    if (!honeyAndNut.passed) {
      expect(honeyAndNut.issues.some((i) => i.code === "AGE_RESTRICTED_INGREDIENT")).toBe(true);
    }

    // ④ 간장 과다로 저염(LOW, 상한 200mg) 나트륨 기준 초과
    const saltySoy = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        ageStages: [2],
        saltLevel: "LOW",
        declaredAllergens: ["SOYBEAN", "WHEAT"],
        ingredients: [
          { name: "쌀밥", amount: 160, unit: "g" },
          { name: "애호박", amount: 50, unit: "g" },
          { name: "양조간장", amount: 25, unit: "ml" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(saltySoy.passed).toBe(false);
    if (!saltySoy.passed) {
      expect(saltySoy.issues.some((i) => i.code === "SODIUM_EXCEEDS_SALT_LEVEL")).toBe(true);
    }

    // ⑤-a 음수/0 분량 및 ⑤-b 비정상 과다 분량(1회분 900g)
    const zeroAmount = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        ingredients: [
          { name: "쌀밥", amount: 0, unit: "g" },
          { name: "애호박", amount: -10, unit: "g" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(zeroAmount.passed).toBe(false);
    if (!zeroAmount.passed) {
      expect(zeroAmount.issues.some((i) => i.code === "INVALID_AMOUNT_OR_UNIT")).toBe(true);
    }

    const hugePortion = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({
        baseServings: 1,
        ingredients: [
          { name: "쌀밥", amount: 500, unit: "g" },
          { name: "애호박", amount: 400, unit: "g" },
        ],
      }),
      externalSources: samplePublicSources,
      dictionary,
    });
    expect(hugePortion.passed).toBe(false);
    if (!hugePortion.passed) {
      expect(hugePortion.issues.some((i) => i.code === "ABNORMAL_PORTION_SIZE")).toBe(true);
    }

    // ⑤-c 출처 링크 0개
    const noSource = validateAiGeneratedCandidate({
      rawJsonText: makeBaseCandidate({ sources: [] }),
      externalSources: [],
      dictionary,
    });
    expect(noSource.passed).toBe(false);
    if (!noSource.passed) {
      expect(noSource.issues.some((i) => i.code === "MISSING_REQUIRED_FIELD")).toBe(true);
    }
  });

  it("AI-05~11: 재시도 성공, 캐시 적중·실패 시 미차감, 동시 4개 요청 레이스 컨디션 방어(최대 3회), KST 자정 초기화, 전역 상한 차단이 정확히 동작한다", async () => {
    const suffix = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
    const signup = await signupUser({
      loginId: `aiquota${suffix}`,
      password: "safepass1234",
      agreeIrrecoverable: true,
    });
    createdUserIds.push(signup.user.id);

    const { baby } = await createBabyProfile(signup.user.id, {
      nickname: "별이",
      ageMonth: 15,
      saltLevel: "NONE",
      allergens: [],
    });

    const ingPotato = dictionary.find((d) => d.name === "감자")!;
    const ingCarrot = dictionary.find((d) => d.name === "당근")!;
    const ingZucchini = dictionary.find((d) => d.name === "애호박")!;
    const ingBroccoli = dictionary.find((d) => d.name === "브로콜리")!;
    const ingRadish = dictionary.find((d) => d.name === "무")!;

    const mockSearch: AiSearchProvider = {
      async searchSources() {
        return samplePublicSources;
      },
    };

    const makeSafeLlm = (tag: string): AiRecipeLlmProvider => ({
      async generateRecipeJson(ctx) {
        return {
          rawJsonText: JSON.stringify({
            name: `[AI단위테스트] ${tag}-${ctx.selectedIngredientNames.join("")}`,
            summary: "단위 테스트용 안전 레시피",
            category: ctx.category,
            mealCategories: ["LUNCH"],
            ageStages: [ctx.ageStage],
            saltLevel: ctx.saltLevel,
            cookMinutes: 15,
            difficulty: 1,
            tools: ["냄비"],
            baseServings: 2,
            declaredAllergens: [],
            ingredients: [
              { name: "쌀밥", amount: 140, unit: "g" },
              ...ctx.selectedIngredientNames.map((n) => ({ name: n, amount: 40, unit: "g" })),
              { name: "물", amount: 100, unit: "ml" },
            ],
            steps: [
              { order: 1, instruction: "재료를 5mm로 다집니다." },
              { order: 2, instruction: "물과 함께 무르게 끓입니다.", timerSeconds: 240 },
            ],
            babyTips: {
              textureTip: "부드럽게 익혀 주세요.",
              cuttingSizeTip: "5mm 크기 권장",
              seasoningTip: "무염 조리",
              stageVariations: {},
            },
            storageInfo: {
              fridgeDays: 2,
              freezerDays: 14,
              reheatTip: "전자레인지에 데워 주세요.",
            },
            sources: [],
          }),
          groundingSources: [],
        };
      },
    });

    // KST 2026-10-31 23:59:58 (= UTC 2026-10-31 14:59:58)
    const beforeKstMidnight = new Date("2026-10-31T14:59:58.000Z");

    // 1) 검증 실패(3회 연속 미등록 재료 반환) 시 횟수 차감 0 확인
    const alwaysFailLlm: AiRecipeLlmProvider = {
      async generateRecipeJson() {
        return {
          rawJsonText: JSON.stringify({
            name: "[AI단위테스트] 실패레시피",
            summary: "안전 검증 반려 테스트용 레시피",
            category: "MEAL",
            mealCategories: ["LUNCH"],
            ageStages: [1],
            saltLevel: "NONE",
            cookMinutes: 15,
            difficulty: 1,
            tools: ["냄비"],
            baseServings: 2,
            declaredAllergens: [],
            ingredients: [{ name: "없는재료XYZ", amount: 50, unit: "g" }],
            steps: [
              { order: 1, instruction: "단계 1 설명입니다." },
              { order: 2, instruction: "단계 2 설명입니다." },
            ],
            babyTips: {
              textureTip: "부드럽게 익히기",
              cuttingSizeTip: "작게 다지기",
              seasoningTip: "무염 조리하기",
              stageVariations: {},
            },
            storageInfo: { reheatTip: "전자레인지에 데우기" },
            sources: [],
          }),
          groundingSources: [],
        };
      },
    };

    await expect(
      generateOnDemandRecipeForBaby(
        signup.user.id,
        baby,
        { ingredientIds: [ingPotato.id], category: "MEAL" },
        {
          searchProvider: mockSearch,
          llmProvider: alwaysFailLlm,
          now: beforeKstMidnight,
        },
      ),
    ).rejects.toMatchObject({ code: "AI_SAFETY_REJECTED" });

    const quotaAfterFailure = await getAiQuotaStatus(signup.user.id, prisma, beforeKstMidnight);
    expect(quotaAfterFailure.usedToday).toBe(0);
    expect(quotaAfterFailure.remainingToday).toBe(3);

    // 2) 전역 상한 도달 시(globalLimitOverride: 0) 생성 차단 및 미차감 확인
    await expect(
      generateOnDemandRecipeForBaby(
        signup.user.id,
        baby,
        { ingredientIds: [ingPotato.id], category: "MEAL" },
        {
          searchProvider: mockSearch,
          llmProvider: makeSafeLlm("전역상한"),
          now: beforeKstMidnight,
          globalLimitOverride: 0,
        },
      ),
    ).rejects.toMatchObject({ code: "GLOBAL_QUOTA_EXCEEDED" });

    // 3) 첫 시도 실패 → 재시도(attempt=1)에서 피드백 반영 성공 + 동일 조합 재호출 시 캐시 적중(미차감)
    let retryCallCount = 0;
    const retryThenPassLlm: AiRecipeLlmProvider = {
      async generateRecipeJson(ctx, refs, sig) {
        retryCallCount += 1;
        if (ctx.attempt === 0) {
          return alwaysFailLlm.generateRecipeJson(ctx, refs, sig);
        }
        expect(ctx.previousFailureReasons.some((r) => r.includes("UNREGISTERED_INGREDIENT"))).toBe(
          true,
        );
        return makeSafeLlm("재시도성공").generateRecipeJson(ctx, refs, sig);
      },
    };

    const firstSuccess = await generateOnDemandRecipeForBaby(
      signup.user.id,
      baby,
      { ingredientIds: [ingPotato.id], category: "MEAL" },
      {
        searchProvider: mockSearch,
        llmProvider: retryThenPassLlm,
        now: beforeKstMidnight,
      },
    );
    expect(retryCallCount).toBe(2);
    expect(firstSuccess.cached).toBe(false);
    expect(firstSuccess.quota.usedToday).toBe(1);
    expect(firstSuccess.quota.remainingToday).toBe(2);

    // 동일 재료 조합 캐시 적중 → 횟수 변화 없음 (usedToday === 1 유지)
    const cacheHit = await generateOnDemandRecipeForBaby(
      signup.user.id,
      baby,
      { ingredientIds: [ingPotato.id], category: "MEAL" },
      {
        searchProvider: mockSearch,
        llmProvider: makeSafeLlm("호출되면안됨"),
        now: beforeKstMidnight,
      },
    );
    expect(cacheHit.cached).toBe(true);
    expect(cacheHit.recipe.id).toBe(firstSuccess.recipe.id);
    expect(cacheHit.quota.usedToday).toBe(1);

    // 4) 남은 한도 2개 상태에서 서로 다른 재료 조합 3개를 동시에(Promise.all) 요청 → 정확히 2개만 성공해 총 3회에서 멈추고 나머지 1개는 429 차단!
    const concurrentResults = await Promise.allSettled([
      generateOnDemandRecipeForBaby(
        signup.user.id,
        baby,
        { ingredientIds: [ingCarrot.id], category: "MEAL" },
        { searchProvider: mockSearch, llmProvider: makeSafeLlm("동시A"), now: beforeKstMidnight },
      ),
      generateOnDemandRecipeForBaby(
        signup.user.id,
        baby,
        { ingredientIds: [ingZucchini.id], category: "MEAL" },
        { searchProvider: mockSearch, llmProvider: makeSafeLlm("동시B"), now: beforeKstMidnight },
      ),
      generateOnDemandRecipeForBaby(
        signup.user.id,
        baby,
        { ingredientIds: [ingBroccoli.id], category: "MEAL" },
        { searchProvider: mockSearch, llmProvider: makeSafeLlm("동시C"), now: beforeKstMidnight },
      ),
    ]);

    const fulfilled = concurrentResults.filter((r) => r.status === "fulfilled");
    const rejected = concurrentResults.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(AppError);
    expect((rejectedReason as AppError).code).toBe("USER_QUOTA_EXCEEDED");

    const quotaExhausted = await getAiQuotaStatus(signup.user.id, prisma, beforeKstMidnight);
    expect(quotaExhausted.usedToday).toBe(3);
    expect(quotaExhausted.remainingToday).toBe(0);

    // 5) KST 자정 경과 직후 (UTC는 여전히 2026-10-31 15:00:02이나 KST는 2026-11-01 00:00:02) → 한도 3/3으로 즉시 초기화!
    const afterKstMidnight = new Date("2026-10-31T15:00:02.000Z");
    const quotaNextKstDay = await getAiQuotaStatus(signup.user.id, prisma, afterKstMidnight);
    expect(quotaNextKstDay.usageDateKst).toBe("2026-11-01");
    expect(quotaNextKstDay.usedToday).toBe(0);
    expect(quotaNextKstDay.remainingToday).toBe(3);

    const nextDayGen = await generateOnDemandRecipeForBaby(
      signup.user.id,
      baby,
      { ingredientIds: [ingRadish.id], category: "MEAL" },
      { searchProvider: mockSearch, llmProvider: makeSafeLlm("다음날"), now: afterKstMidnight },
    );
    expect(nextDayGen.cached).toBe(false);
    expect(nextDayGen.quota.usedToday).toBe(1);

    // AI-13: 품질 점수 순수 계산 확인
    expect(
      calculateQualityScoreFromCounts({
        goodCount: 3,
        okCount: 1,
        refusedCount: 0,
        reportCount: 0,
      }),
    ).toBeGreaterThan(0);
    expect(
      calculateQualityScoreFromCounts({
        goodCount: 0,
        okCount: 0,
        refusedCount: 2,
        reportCount: 1,
      }),
    ).toBeLessThan(0);
  });
});
