/**
 * 공식 Gemini API 구조화 레시피 생성 프로바이더 및 개발/테스트 모킹 프로바이더 (PRD 3.9 AI-01~04)
 *
 * 보안 주의:
 * - GEMINI_API_KEY는 오직 서버 환경변수(process.env.GEMINI_API_KEY)에서만 읽으며,
 *   절대 NEXT_PUBLIC_ 접두사를 쓰거나 클라이언트로 노출하지 않는다.
 */
import { AppError } from "@/lib/http/errors";
import { buildAiSystemPrompt, buildAiUserPrompt } from "./prompt-and-schema";
import { extractGeminiGroundingSources } from "./search";
import type {
  AiGenerationRequestContext,
  AiLlmGenerationResult,
  AiRecipeLlmProvider,
  CollectedSource,
} from "./types";

export function extractJsonFromModelText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

const GEMINI_JSON_SCHEMA_INSTRUCTION = `
출력 JSON 형식 예시(키 이름과 타입을 정확히 준수):
{
  "name": "소고기감자진밥",
  "summary": "부드러운 감자와 소고기로 영양을 채운 한그릇 유아식",
  "category": "MEAL",
  "mealCategories": ["LUNCH", "DINNER"],
  "ageStages": [1, 2],
  "saltLevel": "NONE",
  "cookMinutes": 20,
  "difficulty": 1,
  "tools": ["냄비"],
  "baseServings": 2,
  "declaredAllergens": ["BEEF"],
  "ingredients": [
    { "name": "쌀밥", "amount": 160, "unit": "g", "prepNote": "따뜻한 밥", "isOptional": false, "substituteName": null },
    { "name": "소고기다짐육", "amount": 40, "unit": "g", "prepNote": "핏물 제거", "isOptional": false, "substituteName": "닭안심" },
    { "name": "감자", "amount": 50, "unit": "g", "prepNote": "5mm 깍둑썰기", "isOptional": false, "substituteName": "고구마" },
    { "name": "채수", "amount": 150, "unit": "ml", "prepNote": null, "isOptional": false, "substituteName": "물" }
  ],
  "steps": [
    { "order": 1, "instruction": "소고기다짐육은 핏물을 제거하고 감자는 작게 깍둑썰기합니다.", "timerSeconds": null },
    { "order": 2, "instruction": "냄비에 채수와 감자, 소고기를 넣고 중약불에서 푹 익힙니다.", "timerSeconds": 300 },
    { "order": 3, "instruction": "쌀밥을 넣고 농도를 맞춰 한소끔 더 끓인 뒤 한 김 식혀 완성합니다.", "timerSeconds": 180 }
  ],
  "babyTips": {
    "textureTip": "감자가 숟가락으로 쉽게 으깨질 정도로 충분히 익혀 주세요.",
    "cuttingSizeTip": "완료기는 5mm, 유아식 1단계는 7mm 크기로 손질하세요.",
    "seasoningTip": "소금 대신 채수와 감자의 담백한 맛을 살립니다.",
    "stageVariations": { "1": "채수를 조금 더 넣어 촉촉하게 조리하세요.", "2": "진밥 농도로 조리해 주세요." }
  },
  "storageInfo": {
    "fridgeDays": 2,
    "freezerDays": 14,
    "reheatTip": "물 1작은술을 더해 전자레인지에서 1분 30초 데운 뒤 온도를 확인하세요.",
    "portionTip": "한 끼 분량씩 식혀 밀폐 용기에 소분 보관하세요."
  },
  "sources": [
    { "url": "https://www.foodsafetykorea.go.kr/portal/board/board.do", "title": "영유아 식생활 안전 가이드", "channelOrSite": "식품안전나라", "sourceType": "PUBLIC_INSTITUTION" }
  ]
}
`;

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function resolveGeminiModelName(envModel?: string): string {
  const trimmed = envModel?.trim();
  if (!trimmed || trimmed === "gemini-2.5-flash" || trimmed === "gemini-1.5-flash") {
    return DEFAULT_GEMINI_MODEL;
  }
  return trimmed;
}

export class GeminiRestLlmProvider implements AiRecipeLlmProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.GEMINI_API_KEY,
    private readonly modelName: string = resolveGeminiModelName(process.env.GEMINI_MODEL),
  ) {}

  getModelName(): string {
    return this.modelName;
  }

  async generateRecipeJson(
    context: AiGenerationRequestContext,
    referenceSources: CollectedSource[],
    signal?: AbortSignal,
  ): Promise<AiLlmGenerationResult> {
    const key = this.apiKey?.trim();
    if (!key) {
      throw new AppError(
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "현재 AI 레시피 생성 서비스가 설정되지 않아 기존 검증 레시피만 이용할 수 있습니다. (생성 횟수는 차감되지 않았습니다)",
        "GEMINI_API_KEY is empty",
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}:generateContent?key=${encodeURIComponent(key)}`;
    const systemText = `${buildAiSystemPrompt(context)}\n\n${GEMINI_JSON_SCHEMA_INSTRUCTION}`;
    const userText = buildAiUserPrompt(context, referenceSources);

    // 외부 검색 출처가 이미 있으면 순수 JSON 모드를, 없으면 Google 검색 그라운딩 도구를 활성화한다.
    const useGoogleSearchTool = referenceSources.length === 0;

    const requestBody: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: systemText }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
        ...(useGoogleSearchTool ? {} : { responseMimeType: "application/json" }),
      },
      ...(useGoogleSearchTool ? { tools: [{ google_search: {} }] } : {}),
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (err) {
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
        "AI_NETWORK_ERROR",
        "AI 서비스 연결 중 일시적인 오류가 발생했습니다. (생성 횟수는 차감되지 않았습니다)",
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new AppError(
        502,
        "AI_UPSTREAM_ERROR",
        "AI 레시피 생성 요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요. (생성 횟수는 차감되지 않았습니다)",
        `Gemini HTTP ${response.status}: ${errText.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        groundingMetadata?: unknown;
      }[];
    };

    const candidate = data.candidates?.[0];
    const combinedText = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("\n")
      .trim();

    if (!combinedText) {
      throw new AppError(
        502,
        "AI_EMPTY_RESPONSE",
        "AI 응답이 비어 있어 레시피를 생성하지 못했습니다. (생성 횟수는 차감되지 않았습니다)",
      );
    }

    const groundingSources = extractGeminiGroundingSources(candidate?.groundingMetadata);

    return {
      rawJsonText: extractJsonFromModelText(combinedText),
      groundingSources,
    };
  }
}
