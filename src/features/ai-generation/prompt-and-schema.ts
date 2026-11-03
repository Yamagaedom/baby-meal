/**
 * AI 구조화 출력 스키마 및 아기 맞춤 재작성 프롬프트 빌더 (PRD 3.9 AI-03, AI-04, AI-07)
 *
 * - 출처 이미지 URL 필드를 아예 두지 않아 출처 이미지 복제 가능성을 원천 차단한다 (AI-07).
 * - 원문 문장 복제 금지, 식재료 사전 표준명 강제, 연령·간 단계·알레르기 제외 조건을 시스템 프롬프트에 명시한다.
 */
import { z } from "zod";
import { getAgeStageInfo } from "@/lib/age";
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  MEAL_TIMES,
  RECIPE_CATEGORIES,
  SALT_LEVELS,
} from "@/lib/domain/types";
import { STANDARD_RICE_GRAMS_BY_STAGE } from "@/lib/safety/constants";
import type { AiGenerationRequestContext, CollectedSource } from "./types";

export const aiGeneratedRecipeRawSchema = z.object({
  name: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(5).max(160),
  category: z.enum(RECIPE_CATEGORIES),
  mealCategories: z.array(z.enum(MEAL_TIMES)).min(1).max(4),
  ageStages: z.array(z.number().int().min(1).max(4)).min(1).max(4),
  saltLevel: z.enum(SALT_LEVELS),
  cookMinutes: z.number().int().min(1).max(180),
  difficulty: z.number().int().min(1).max(3).default(1),
  tools: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
  baseServings: z.number().int().min(1).max(5),
  declaredAllergens: z.array(z.enum(ALLERGENS)).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        amount: z.number().nullable(),
        unit: z.string().trim().min(1).max(15),
        prepNote: z.string().trim().max(80).nullable().optional(),
        isOptional: z.boolean().optional().default(false),
        substituteName: z.string().trim().max(40).nullable().optional(),
      }),
    )
    .min(1)
    .max(15),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1).max(20),
        instruction: z.string().trim().min(4).max(400),
        timerSeconds: z.number().int().min(5).max(7200).nullable().optional(),
      }),
    )
    .min(2)
    .max(12),
  babyTips: z.object({
    textureTip: z.string().trim().min(3).max(240),
    cuttingSizeTip: z.string().trim().min(3).max(240),
    seasoningTip: z.string().trim().min(3).max(240),
    stageVariations: z.record(z.string(), z.string()).optional().default({}),
  }),
  storageInfo: z.object({
    fridgeDays: z.number().int().min(0).max(7).nullable().optional(),
    freezerDays: z.number().int().min(0).max(60).nullable().optional(),
    reheatTip: z.string().trim().min(3).max(240),
    portionTip: z.string().trim().max(240).nullable().optional(),
  }),
  sources: z
    .array(
      z.object({
        url: z.string().trim().url(),
        title: z.string().trim().min(2).max(160),
        channelOrSite: z.string().trim().min(1).max(80),
        sourceType: z.enum(["YOUTUBE", "WEB", "PUBLIC_INSTITUTION"]).optional(),
      }),
    )
    .optional()
    .default([]),
});

export type AiGeneratedRecipeRaw = z.infer<typeof aiGeneratedRecipeRawSchema>;

export function buildAiSystemPrompt(ctx: AiGenerationRequestContext): string {
  const stageInfo = getAgeStageInfo(ctx.ageStage);
  const riceRange = STANDARD_RICE_GRAMS_BY_STAGE[ctx.ageStage];
  const saltRule =
    ctx.saltLevel === "NONE"
      ? "무염(NONE): 소금, 국간장, 진간장, 아기간장, 된장, 고추장, 액젓, 굴소스 등 간 양념을 미량도 절대 넣지 마세요(1회분 나트륨 80mg 이하 필수). 맛은 채수, 무염 멸치육수, 과일·채소 자연 단맛으로만 내세요."
      : ctx.saltLevel === "LOW"
        ? "저염(LOW): 설탕·꿀·매운 양념은 배제하고 아기간장·저염된장 등도 극소량(약간 또는 0.5작은술 이하)만 사용해 1회분 나트륨이 반드시 200mg 이하가 되게 하세요."
        : "일반 유아식(NORMAL): 성인 간보다 훨씬 싱겁게 조리하며 1회분 나트륨이 350mg 이하가 되게 하세요.";

  const excludedAllergenLabels = ctx.excludedAllergens.map(
    (code) => `${code}(${ALLERGEN_LABELS[code]})`,
  );

  return [
    "당신은 대한민국 영유아 영양·조리 안전 수칙을 철저히 준수하는 12~48개월 유아식 레시피 작성 도우미입니다.",
    "",
    "[필수 준수 규칙]",
    `1. 대상 연령 단계: ${ctx.ageStage}단계 - ${stageInfo.label} (${stageInfo.minMonth}~${stageInfo.maxMonth}개월, 권장 식감: ${stageInfo.texture})`,
    `2. 대상 간 단계: ${saltRule}`,
    `3. 제외 알레르기 유발군(절대 포함 금지): ${excludedAllergenLabels.length > 0 ? excludedAllergenLabels.join(", ") : "없음"}`,
    `4. 제외 개별 식재료(절대 포함 금지): ${ctx.excludedIngredientNames.length > 0 ? ctx.excludedIngredientNames.join(", ") : "없음"}`,
    "5. 영유아 절대 금지 식재료: 꿀, 통견과류(통땅콩·통아몬드·통호두), 통포도·통방울토마토(손질 안 된 통째), 날생선·회·육회·덜 익힌 달걀, 카페인(초콜릿·커피·홍차), 매운 고추·자극적 향신료, 떡류 질식 유발 형태 절대 금지.",
    `6. 1회분 기준 분량: 기준 인분(baseServings)은 2회분을 권장하며, 1회분 전체 재료 합계 중량은 반드시 40g~400g 범위(밥 기준 ${riceRange.min}~${riceRange.max}g 내외)로 맞추세요. 단위는 반드시 g, ml, 개, 모, 장, 큰술, 작은술, 약간 중 하나만 사용하세요.`,
    "7. 저작권 보호(AI-04): 참고 자료의 문장이나 표현을 절대 그대로 복제하지 말고, 아기 월령에 맞게 조리법·분량·식감·크기를 완전히 새로 재구성해 작성하세요. 출처 이미지는 절대 포함하지 마세요.",
    "8. 식재료명 표준화(AI-05 ①): 모든 재료의 name(및 substituteName)은 아래 [허용 식재료 사전 목록]에 있는 정확한 이름만 사용하세요. 사전에 없는 재료가 1개라도 있으면 안전 검증에서 즉시 폐기됩니다.",
    "9. 알레르기 태그 정확성(AI-05 ②): 사용한 재료에 포함된 모든 알레르기 유발군 코드를 declaredAllergens 배열에 빠짐없이 기재하세요.",
    "",
    `[허용 식재료 사전 목록 (${ctx.allowedIngredientNames.length}종)]`,
    ctx.allowedIngredientNames.join(", "),
  ].join("\n");
}

export function buildAiUserPrompt(
  ctx: AiGenerationRequestContext,
  referenceSources: readonly CollectedSource[],
): string {
  const lines: string[] = [];
  lines.push(
    `검색 범위: ${ctx.scope ?? "SHOPPING"}. ON_HAND는 허용 목록에 있는 보유 재료만 사용, SHOPPING은 선택 재료를 필수 주재료로 사용하고 추가 필수 재료 ${ctx.maxMissing ?? 3}개 이하, EXPLORE는 허용 사전에서 자유롭게 구성.`,
  );
  lines.push(
    `요리 유형: ${ctx.dishType ?? "ANY"}. 요청이 ANY가 아니면 반드시 해당 형태의 요리를 만들고 JSON 최상위 dishType에 이 값을 넣으세요. SOUP는 스프, ONE_BOWL은 밥/면 등을 포함한 한그릇 음식, SIDE는 밥 없이 먹는 반찬입니다.`,
  );

  if (ctx.topicOrMenuName) {
    lines.push(`요청 메뉴/주제: ${ctx.topicOrMenuName}`);
  }
  lines.push(`카테고리: ${ctx.category === "MEAL" ? "식사(MEAL)" : "간식(SNACK)"}`);
  if (ctx.selectedIngredientNames.length > 0) {
    lines.push(
      `집에 있는 보유 재료(최대한 주재료로 활용): ${ctx.selectedIngredientNames.join(", ")}`,
    );
  }

  if (referenceSources.length > 0) {
    lines.push("");
    lines.push("[참고 출처 메타데이터 (내용 복제 금지, 출처 표기용으로만 활용)]");
    for (const src of referenceSources) {
      lines.push(`- 제목: ${src.title} | 채널/사이트: ${src.channelOrSite} | URL: ${src.url}`);
    }
  }

  if (ctx.attempt > 0 && ctx.previousFailureReasons.length > 0) {
    lines.push("");
    lines.push(
      `[중요: 이전 생성 시도가 안전 검증에서 반려되었습니다 (재시도 ${ctx.attempt}회차). 아래 문제를 반드시 모두 수정해 다시 작성하세요]`,
    );
    for (const reason of ctx.previousFailureReasons) {
      lines.push(`- 반려 사유: ${reason}`);
    }
  }

  lines.push("");
  lines.push("반드시 지정된 JSON 스키마 형식으로만 응답하세요.");
  return lines.join("\n");
}
