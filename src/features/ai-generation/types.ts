/**
 * AI 레시피 생성 파이프라인 도메인 타입 및 프로바이더 인터페이스 (PRD 3.9 AI-01~13)
 */
import type {
  AgeStage,
  Allergen,
  MealTime,
  RecipeCategory,
  SaltLevel,
} from "@/lib/domain/types";

export type SourceTypeLiteral = "YOUTUBE" | "WEB" | "PUBLIC_INSTITUTION";

export interface CollectedSource {
  url: string;
  title: string;
  channelOrSite: string;
  sourceType: SourceTypeLiteral;
  viewCount?: number;
  trustScore: number;
}

export interface AiGenerationRequestContext {
  /** 메뉴 주제 또는 재료 기반 요청 설명 */
  topicOrMenuName?: string;
  category: RecipeCategory;
  ageStage: AgeStage;
  saltLevel: SaltLevel;
  /** 사용자가 선택한 보유 식재료 이름 목록 */
  selectedIngredientNames: string[];
  /** 절대 포함되면 안 되는 알레르기 코드 (CONFIRMED + SUSPECTED) */
  excludedAllergens: Allergen[];
  /** 절대 포함되면 안 되는 개별 식재료명 (기피/의심 포함) */
  excludedIngredientNames: string[];
  /** 식재료 사전에 등록된 허용 식재료 표준명 목록 */
  allowedIngredientNames: string[];
  /** 재시도 횟수 (0 = 첫 시도, 1..2 = 재생성) */
  attempt: number;
  /** 직전 시도 안전 검증 실패 사유 (재생성 프롬프트 피드백용) */
  previousFailureReasons: string[];
}

export interface AiSearchQueryInput {
  queryText: string;
  ageStage: AgeStage;
  saltLevel: SaltLevel;
  signal?: AbortSignal;
}

/** AI-01, AI-02: 외부 검색 프로바이더 인터페이스 (테스트 모킹 가능) */
export interface AiSearchProvider {
  searchSources(input: AiSearchQueryInput): Promise<CollectedSource[]>;
}

export interface AiLlmGenerationResult {
  /** 모델이 반환한 원본 JSON 문자열 */
  rawJsonText: string;
  /** Google 검색 그라운딩 메타데이터 등에서 추출된 추가 출처 */
  groundingSources: CollectedSource[];
}

/** AI-03, AI-04: 구조화 레시피 생성 LLM 프로바이더 인터페이스 (테스트 모킹 가능) */
export interface AiRecipeLlmProvider {
  generateRecipeJson(
    context: AiGenerationRequestContext,
    referenceSources: CollectedSource[],
    signal?: AbortSignal,
  ): Promise<AiLlmGenerationResult>;
}

export interface ValidatedAiRecipePayload {
  name: string;
  summary: string;
  category: RecipeCategory;
  mealCategories: MealTime[];
  ageStages: AgeStage[];
  saltLevel: SaltLevel;
  cookMinutes: number;
  difficulty: number;
  tools: string[];
  baseServings: number;
  sodiumMgPerServing: number;
  allergens: Allergen[];
  ingredients: {
    ingredientId: string;
    amount: number | null;
    unit: string;
    prepNote: string | null;
    isOptional: boolean;
    substituteId: string | null;
  }[];
  steps: {
    order: number;
    instruction: string;
    timerSeconds: number | null;
  }[];
  babyTips: {
    textureTip: string;
    cuttingSizeTip: string;
    seasoningTip: string;
    stageVariations: Record<string, string>;
  };
  storageInfo: {
    fridgeDays: number | null;
    freezerDays: number | null;
    reheatTip: string;
    portionTip: string | null;
  };
  sources: CollectedSource[];
}

export interface AiQuotaStatus {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  globalLimitReached: boolean;
  usageDateKst: string;
  resetsAtKst: string;
}
