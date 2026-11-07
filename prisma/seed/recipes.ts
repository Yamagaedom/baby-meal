/**
 * 개발용 샘플 레시피 30개 (PRD 8장, 1단계 시드 요구사항)
 * - 구성: 식사(MEAL) 20개 + 간식(SNACK) 10개 = 총 30개
 * - 연령 단계: 1단계(완료기) ~ 4단계(유아식 3단계) 고르게 분포
 * - 간 단계: 무염(NONE) 16개 + 저염(LOW) 14개
 * - 모든 레시피는 시드 실행 전 및 단위 테스트에서 lib/safety.validateRecipeSafety()를 통과한다.
 */
import type { AgeStage, MealTime, RecipeCategory, SaltLevel } from "@/lib/domain/types";
import { EXPANDED_RECIPES } from "@/data/expanded-recipes";

export interface SeedRecipeItem {
  slug: string;
  name: string;
  summary: string;
  category: RecipeCategory;
  mealRole?: "MAIN" | "SIDE" | "SOUP" | "SNACK" | "UNKNOWN";
  mealCategories: MealTime[];
  ageStages: AgeStage[];
  saltLevel: SaltLevel;
  cookMinutes: number;
  difficulty: 1 | 2 | 3;
  tools: string[];
  baseServings: number;
  ingredients: {
    ingredientSlug: string;
    amount: number | null;
    unit: string;
    prepNote?: string;
    isOptional?: boolean;
    substituteSlug?: string;
  }[];
  steps: {
    order: number;
    instruction: string;
    timerSeconds?: number | null;
  }[];
  babyTips: {
    textureTip: string;
    cuttingSizeTip: string;
    seasoningTip: string;
    stageVariations?: Record<string, string>;
  };
  storageInfo: {
    fridgeDays: number;
    freezerDays: number;
    reheatTip: string;
    portionTip?: string;
  };
  sources: {
    url: string;
    title: string;
    channelOrSite: string;
    sourceType: "YOUTUBE" | "WEB" | "PUBLIC_INSTITUTION";
    trustScore: number;
  }[];
}

export const CORE_SEED_RECIPES: SeedRecipeItem[] = [
  // ==================== 식사 (MEAL) — 무염 (NONE) 10개 ====================
  {
    slug: "beef-zucchini-soft-rice",
    name: "소고기애호박무른밥",
    summary: "채수로 은은한 단맛을 낸 완료기·초기 유아식 대표 한그릇 무른밥",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g", prepNote: "따뜻한 밥" },
      { ingredientSlug: "beef-minced", amount: 40, unit: "g", prepNote: "핏물 제거" },
      {
        ingredientSlug: "zucchini",
        amount: 40,
        unit: "g",
        prepNote: "5mm 다지기",
        substituteSlug: "sweet-pumpkin",
      },
      { ingredientSlug: "carrot", amount: 20, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "vegetable-broth", amount: 150, unit: "ml" },
      { ingredientSlug: "sesame-oil", amount: 0.5, unit: "작은술", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction: "소고기 다짐육은 키친타월로 핏물을 닦고, 애호박과 당근은 5mm 크기로 다집니다.",
      },
      {
        order: 2,
        instruction: "냄비에 채수 2큰술과 소고기를 넣고 중불에서 뭉치지 않게 풀어가며 익힙니다.",
        timerSeconds: 120,
      },
      {
        order: 3,
        instruction: "당근, 애호박, 남은 채수, 밥을 넣고 약불에서 무르게 끓입니다.",
        timerSeconds: 360,
      },
      { order: 4, instruction: "불을 끄고 참기름을 살짝 둘러 골고루 섞어 한 김 식힙니다." },
    ],
    babyTips: {
      textureTip: "잇몸으로 가볍게 으깨지는 무른 농도로 채수 양을 조절하세요.",
      cuttingSizeTip: "완료기는 5mm, 1단계는 7mm 내외로 썰어주세요.",
      seasoningTip: "소금 없이 양파·무·배추로 우린 채수로 감칠맛을 냅니다.",
      stageVariations: {
        "1": "채수를 30ml 더 넣어 촉촉한 무른밥으로 만드세요.",
        "2": "채수를 줄여 진밥 형태나 주먹밥으로 응용할 수 있습니다.",
      },
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "물 1작은술을 더한 뒤 전자레인지에서 1분 30초 데워 속 온도를 확인하세요.",
      portionTip: "한 끼 분량씩 내열 용기에 담아 식힌 뒤 냉동 보관하세요.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "영유아 한그릇 무염 조리 가이드",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "chicken-broccoli-risotto",
    name: "닭안심브로콜리우유리조또",
    summary: "고소한 우유와 닭안심으로 단백질·칼슘을 챙기는 무염 리조또",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      {
        ingredientSlug: "chicken-tenderloin",
        amount: 50,
        unit: "g",
        substituteSlug: "chicken-breast",
      },
      { ingredientSlug: "broccoli", amount: 30, unit: "g", prepNote: "꽃 부분만 데쳐 다지기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "milk", amount: 140, unit: "ml", substituteSlug: "soy-milk-unsweetened" },
      { ingredientSlug: "unsalted-butter", amount: 5, unit: "g", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "브로콜리는 끓는 물에 1분 데친 뒤 꽃 부분만 잘게 다지고, 닭안심과 양파도 작게 썹니다.",
        timerSeconds: 60,
      },
      {
        order: 2,
        instruction: "팬에 무염버터를 녹이고 양파와 닭안심을 겉면이 하얘질 때까지 볶습니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction: "우유와 밥, 브로콜리를 넣고 약불에서 눌어붙지 않게 저으며 걸쭉하게 끓입니다.",
        timerSeconds: 300,
      },
    ],
    babyTips: {
      textureTip: "우유가 졸아들며 밥알이 부드럽게 퍼지도록 약불을 유지하세요.",
      cuttingSizeTip: "닭안심 힘줄은 미리 제거한 뒤 결 반대 방향으로 잘게 썰어주세요.",
      seasoningTip: "양파를 충분히 볶아 자연 단맛을 끌어올리면 간 없이도 잘 먹습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "우유 소스가 되직해지므로 우유나 물 1큰술을 넣어 데우세요.",
    },
    sources: [
      {
        url: "https://health.kdca.go.kr",
        title: "영유아 이유식 및 균형 식생활 지침",
        channelOrSite: "질병관리청 국가건강정보포털",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "cod-radish-clear-soup",
    name: "대구살무맑은국",
    summary: "시원한 무와 담백한 흰살생선으로 끓인 자극 없는 아기 국",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "cod", amount: 60, unit: "g", substituteSlug: "flounder" },
      { ingredientSlug: "radish", amount: 60, unit: "g", prepNote: "얇게 나박썰기" },
      { ingredientSlug: "tofu", amount: 50, unit: "g" },
      { ingredientSlug: "green-onion", amount: 10, unit: "g", isOptional: true },
      { ingredientSlug: "vegetable-broth", amount: 250, unit: "ml" },
    ],
    steps: [
      {
        order: 1,
        instruction: "대구살은 손끝으로 만져 잔가시를 완전히 제거하고 한입 크기로 썹니다.",
      },
      {
        order: 2,
        instruction: "냄비에 채수와 무를 넣고 무가 투명해질 때까지 중약불로 끓입니다.",
        timerSeconds: 360,
      },
      {
        order: 3,
        instruction: "대구살과 두부, 대파를 넣고 생선살이 하얗게 익을 때까지 한소끔 더 끓입니다.",
        timerSeconds: 240,
      },
    ],
    babyTips: {
      textureTip: "대구살과 두부는 숟가락으로도 쉽게 부서져 완료기 아기에게 좋습니다.",
      cuttingSizeTip: "무는 2~3mm 두께로 얇게 썰어야 빨리 무르게 익습니다.",
      seasoningTip: "무를 오래 끓이면 시원하고 달큰한 맛이 우러나 무염으로도 충분합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 7,
      reheatTip: "냉동 시 두부 식감이 변할 수 있어 냉장 보관 후 냄비에 팔팔 끓여 주세요.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "우리 아이 건강 식단 및 조리법",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "tofu-egg-steamed-custard",
    name: "순두부달걀찜",
    summary: "푸딩처럼 보드라워 밥 반찬이나 아침 식사로 좋은 무염 달걀찜",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 10,
    difficulty: 1,
    tools: ["전자레인지", "냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "soft-tofu", amount: 100, unit: "g" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      {
        ingredientSlug: "carrot",
        amount: 15,
        unit: "g",
        prepNote: "곱게 다지기",
        isOptional: true,
      },
      { ingredientSlug: "chives", amount: 5, unit: "g", isOptional: true },
      { ingredientSlug: "vegetable-broth", amount: 50, unit: "ml" },
    ],
    steps: [
      { order: 1, instruction: "달걀을 알끈을 제거해 곱게 풀고 채수와 섞습니다." },
      {
        order: 2,
        instruction: "내열 용기에 순두부를 으깨 담고 달걀물과 다진 당근·쪽파를 넣습니다.",
      },
      {
        order: 3,
        instruction:
          "뚜껑을 살짝 얹어 중탕 냄비나 전자레인지(약 2분 30초~3분)로 속까지 완전히 익힙니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "달걀물을 체에 한 번 내리면 기포 없이 훨씬 부드럽습니다.",
      cuttingSizeTip: "당근은 먼저 살짝 익히거나 아주 곱게 다져야 이물감이 없습니다.",
      seasoningTip: "채수나 멸치다시마육수를 사용하면 비린내 없이 감칠맛이 납니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "달걀찜은 냉동 시 수분이 분리되므로 당일 섭취를 권장합니다.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "나트륨 줄인 건강식단 - 부드러운 달걀찜",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "abalone-carrot-porridge",
    name: "전복당근영양진밥",
    summary: "기력 보충에 좋은 전복을 부드럽게 다져 넣은 무염 영양식",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "abalone", amount: 1, unit: "개", prepNote: "손질 후 잘게 다지기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g" },
      { ingredientSlug: "shiitake-mushroom", amount: 1, unit: "개" },
      { ingredientSlug: "water", amount: 150, unit: "ml" },
      { ingredientSlug: "sesame-oil", amount: 0.5, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction: "전복은 솔로 깨끗이 씻어 이빨과 내장을 제거한 뒤 살만 아주 잘게 다집니다.",
      },
      {
        order: 2,
        instruction: "냄비에 참기름을 두르고 다진 전복, 당근, 표고버섯을 가볍게 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 3,
        instruction: "밥과 물을 넣고 약불에서 저어가며 푹 퍼지도록 끓입니다.",
        timerSeconds: 480,
      },
    ],
    babyTips: {
      textureTip: "전복은 오래 끓이면 질겨질 수 있어 최대한 잘게 다져 넣어주세요.",
      cuttingSizeTip: "전복 살은 3~4mm 이하로 곱게 다져 질식 위험을 예방하세요.",
      seasoningTip: "표고버섯과 참기름 향만으로도 깊은 풍미가 납니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 10,
      reheatTip: "해산물 메뉴이므로 해동 후에는 재냉동하지 말고 바로 급여하세요.",
    },
    sources: [],
  },
  {
    slug: "salmon-sweet-pumpkin-rice-balls",
    name: "연어단호박주먹밥",
    summary: "손으로 집어 먹기 좋은 달콤 고소 자기주도 유아식 주먹밥",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["프라이팬", "전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "salmon", amount: 50, unit: "g", substituteSlug: "cod" },
      { ingredientSlug: "sweet-pumpkin", amount: 60, unit: "g", prepNote: "껍질 벗겨 찌기" },
      { ingredientSlug: "broccoli", amount: 20, unit: "g", isOptional: true },
      { ingredientSlug: "olive-oil", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "sesame-powder", amount: 0.5, unit: "작은술", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "단호박은 내열 용기에 담아 전자레인지에 3분 익혀 으깨고, 브로콜리는 데쳐 곱게 다집니다.",
        timerSeconds: 180,
      },
      {
        order: 2,
        instruction:
          "팬에 올리브유를 살짝 두르고 연어를 속까지 완전히 익힌 뒤 가시를 확인하며 잘게 부숩니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction:
          "따뜻한 밥에 연어, 단호박, 브로콜리, 참깨가루를 섞어 아기 한입 크기로 동그랗게 빚습니다.",
      },
    ],
    babyTips: {
      textureTip: "으깬 단호박이 밥알을 촉촉하게 잡아주어 목 막힘이 적습니다.",
      cuttingSizeTip: "주먹밥 지름은 2~2.5cm 내외로 작게 만들어 한 번에 삼키지 않게 해주세요.",
      seasoningTip: "단호박의 자연 단맛으로 무염에서도 맛있는 밥이 됩니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 14,
      reheatTip: "젖은 키친타월을 덮어 전자레인지에 1분 데우면 촉촉함이 유지됩니다.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "영유아 핑거푸드 영양 레시피",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },
  {
    slug: "beef-radish-miyeok-soup",
    name: "소고기무염미역국",
    summary: "돌 이후 가장 자주 끓이는 기본 소고기 미역국 무염 버전",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 25,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 3,
    ingredients: [
      { ingredientSlug: "beef-brisket-soup", amount: 60, unit: "g", substituteSlug: "beef-lean" },
      {
        ingredientSlug: "miyeok-soaked",
        amount: 45,
        unit: "g",
        prepNote: "충분히 헹군 뒤 잘게 썰기",
      },
      { ingredientSlug: "water", amount: 350, unit: "ml" },
      { ingredientSlug: "sesame-oil", amount: 1, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "불린 미역은 찬물에 서너 번 주물러 헹궈 자연 염분을 빼고 아기 한입 크기로 잘게 썹니다.",
      },
      {
        order: 2,
        instruction: "냄비에 참기름과 작게 썬 소고기, 미역을 넣고 중약불에서 2분간 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 3,
        instruction: "물을 붓고 중약불에서 소고기와 미역이 푹 퍼질 때까지 15분 이상 끓입니다.",
        timerSeconds: 900,
      },
    ],
    babyTips: {
      textureTip: "미역 줄기 부분이 억세지 않도록 잎 위주로 사용하고 푹 끓여주세요.",
      cuttingSizeTip: "미역은 끓으면서 불어나므로 조리 전 1cm 이하로 잘게 썰어주세요.",
      seasoningTip: "소고기와 미역을 충분히 볶아 우려내면 간장 없이도 뽀얗고 구수합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "소분 냉동한 미역국은 냄비에서 한 번 팔팔 끓여 식힌 뒤 급여하세요.",
    },
    sources: [
      {
        url: "https://www.childcare.go.kr",
        title: "돌 아기 첫 생일 영양 미역국 가이드",
        channelOrSite: "보건복지부 아이사랑",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "pork-apple-tender-patties",
    name: "한돈안심사과동그랑땡",
    summary: "간 사과를 넣어 퍽퍽함 없이 촉촉하게 구운 무염 돼지안심 완자",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "pork-minced", amount: 80, unit: "g", substituteSlug: "pork-tenderloin" },
      { ingredientSlug: "tofu", amount: 50, unit: "g", prepNote: "물기 꼭 짜기" },
      { ingredientSlug: "apple", amount: 30, unit: "g", prepNote: "강판에 갈기" },
      { ingredientSlug: "onion", amount: 20, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "rice-flour", amount: 1, unit: "큰술", substituteSlug: "starch-potato" },
      { ingredientSlug: "canola-oil", amount: 1, unit: "작은술" },
    ],
    steps: [
      { order: 1, instruction: "두부는 면포로 물기를 꼭 짜서 으깨고, 사과는 강판에 곱게 갑니다." },
      {
        order: 2,
        instruction:
          "볼에 돼지고기 다짐육, 두부, 간 사과, 다진 양파, 쌀가루를 넣고 끈기가 생기도록 치댑니다.",
      },
      {
        order: 3,
        instruction:
          "납작하고 작은 동그랑땡 모양으로 빚어 약불 팬에 앞뒤로 뚜껑을 덮어 속까지 완전히 익힙니다.",
        timerSeconds: 420,
      },
    ],
    babyTips: {
      textureTip: "두부와 간 사과가 고기 섬유질을 부드럽게 해 아기가 잘 씹습니다.",
      cuttingSizeTip: "두께를 1cm 이하로 얇게 빚어야 겉이 타지 않고 속까지 잘 익습니다.",
      seasoningTip: "사과즙이 잡내를 잡고 은은한 단맛을 더해 무염 반찬으로 훌륭합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 21,
      reheatTip: "냉동 보관 후 팬에 물 1큰술을 넣고 뚜껑 덮어 약불로 데우면 촉촉합니다.",
    },
    sources: [],
  },
  {
    slug: "unsalted-somyeon-anchovy-noodles",
    name: "무염소면채수잔치국수",
    summary: "담백한 채수에 애호박과 당근, 달걀노른자 고명을 올린 아기 첫 국수",
    category: "MEAL",
    mealCategories: ["LUNCH"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 1,
    ingredients: [
      { ingredientSlug: "somyeon-low-sodium", amount: 35, unit: "g" },
      {
        ingredientSlug: "vegetable-broth",
        amount: 180,
        unit: "ml",
        substituteSlug: "anchovy-broth",
      },
      { ingredientSlug: "zucchini", amount: 25, unit: "g", prepNote: "가늘게 채썰기" },
      { ingredientSlug: "carrot", amount: 15, unit: "g", prepNote: "가늘게 채썰기" },
      { ingredientSlug: "egg-yolk", amount: 1, unit: "개", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "끓는 물에 무염소면을 3~4분간 푹 삶아 찬물에 헹군 뒤 아기가 먹기 좋게 가위로 짧게 자릅니다.",
        timerSeconds: 210,
      },
      {
        order: 2,
        instruction: "냄비에 채수와 채 썬 애호박·당근을 넣고 부드러워질 때까지 끓입니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction:
          "선택 재료인 달걀노른자를 풀어 줄알을 치고 완전히 익힌 뒤 면 위에 국물을 붓습니다.",
      },
    ],
    babyTips: {
      textureTip: "성인보다 1분 더 푹 삶아야 밀가루 풋내가 없고 소화가 잘 됩니다.",
      cuttingSizeTip: "긴 면발은 목에 걸리기 쉬우므로 2~3cm 길이로 잘라 주세요.",
      seasoningTip: "무염소면과 순수 채수를 사용해 나트륨 부담을 최소화했습니다.",
    },
    storageInfo: {
      fridgeDays: 0,
      freezerDays: 0,
      reheatTip: "면 요리는 불기 쉬우므로 육수만 미리 냉동해 두고 면은 바로 삶아 주세요.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "무염 소면과 채수를 활용한 영유아 국수 조리법",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.93,
      },
    ],
  },
  {
    slug: "flounder-spinach-cream-stew",
    name: "가자미시금치두유스튜",
    summary: "우유 알레르기 아기도 먹을 수 있는 무가당 두유 베이스 생선 스튜",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "flounder", amount: 70, unit: "g", substituteSlug: "cod" },
      { ingredientSlug: "potato", amount: 60, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "spinach", amount: 25, unit: "g", prepNote: "데쳐서 다지기" },
      { ingredientSlug: "onion", amount: 30, unit: "g" },
      { ingredientSlug: "soy-milk-unsweetened", amount: 150, unit: "ml", substituteSlug: "milk" },
      { ingredientSlug: "olive-oil", amount: 0.5, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "시금치는 끓는 물에 30초 데쳐 찬물에 헹군 뒤 잘게 썰고, 가자미살은 가시를 거듭 확인합니다.",
      },
      {
        order: 2,
        instruction: "냄비에 올리브유와 양파, 감자를 넣고 반투명해질 때까지 볶습니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction:
          "무가당 두유와 가자미살을 넣고 감자가 포슬하게 익을 때까지 약불로 끓인 뒤 시금치를 섞습니다.",
        timerSeconds: 420,
      },
    ],
    babyTips: {
      textureTip: "감자 전분이 자연스럽게 국물을 걸쭉하게 만들어 밥에 비벼 주기 좋습니다.",
      cuttingSizeTip: "시금치 줄기는 질길 수 있으니 잎 부분 위주로 잘게 썰어 주세요.",
      seasoningTip: "감자와 양파, 두유의 고소함으로 무염 스튜를 완성합니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "약불에서 천천히 저어가며 데워 주세요.",
    },
    sources: [],
  },

  // ==================== 식사 (MEAL) — 저염 (LOW) 10개 ====================
  {
    slug: "beef-potato-braised-low-sodium",
    name: "소고기감자조림",
    summary: "아기간장 소량으로 은은하게 맛을 낸 촉촉한 포슬 감자 반찬",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 3,
    ingredients: [
      {
        ingredientSlug: "potato",
        amount: 180,
        unit: "g",
        prepNote: "1cm 깍둑썰기 후 찬물에 담그기",
      },
      { ingredientSlug: "beef-minced", amount: 70, unit: "g" },
      { ingredientSlug: "carrot", amount: 40, unit: "g" },
      { ingredientSlug: "onion", amount: 40, unit: "g" },
      { ingredientSlug: "water", amount: 180, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 1, unit: "작은술" },
      { ingredientSlug: "sesame-oil", amount: 0.5, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "감자는 1cm 크기로 썰어 모서리를 둥글게 다듬고 찬물에 5분 담가 전분기를 뺍니다.",
      },
      {
        order: 2,
        instruction: "냄비에 소고기와 양파, 당근을 먼저 볶다가 감자와 물, 아기간장을 넣습니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction:
          "뚜껑을 덮고 중약불에서 국물이 자작해지고 감자가 푹 익을 때까지 조린 뒤 참기름으로 마무리합니다.",
        timerSeconds: 600,
      },
    ],
    babyTips: {
      textureTip: "국물을 완전히 졸이지 않고 2~3큰술 남겨두면 밥에 비벼 먹이기 편합니다.",
      cuttingSizeTip: "1단계는 8mm, 2~3단계는 1.2cm 크기로 맞춰 주세요.",
      seasoningTip: "아기간장 1작은술을 3회분에 나누어 넣어 1회분 나트륨을 낮췄습니다.",
    },
    storageInfo: {
      fridgeDays: 3,
      freezerDays: 0,
      reheatTip: "감자는 냉동 시 푸석해지므로 냉장 보관 후 3일 이내 섭취하세요.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "유아기 저염 조림 반찬 가이드",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.94,
      },
    ],
  },
  {
    slug: "baby-doenjang-zucchini-tofu-soup",
    name: "아기된장애호박두부국",
    summary: "저염 아기된장으로 구수하게 끓인 속 편한 유아식 된장국",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 3,
    ingredients: [
      { ingredientSlug: "tofu", amount: 120, unit: "g" },
      { ingredientSlug: "zucchini", amount: 70, unit: "g" },
      { ingredientSlug: "onion", amount: 40, unit: "g" },
      { ingredientSlug: "enoki-mushroom", amount: 30, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "anchovy-broth", amount: 350, unit: "ml" },
      { ingredientSlug: "baby-doenjang", amount: 1, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "애호박, 양파, 두부는 아기 한입 크기로 썰고 팽이버섯은 5mm 길이로 잘게 썹니다.",
      },
      {
        order: 2,
        instruction: "멸치다시마육수에 아기된장을 체에 걸러 풀고 양파·애호박을 넣어 끓입니다.",
        timerSeconds: 300,
      },
      {
        order: 3,
        instruction: "두부와 팽이버섯을 넣고 2분간 더 끓여 완성합니다.",
        timerSeconds: 120,
      },
    ],
    babyTips: {
      textureTip: "된장 건더기를 체에 걸러내면 아기가 거부감 없이 국물을 잘 먹습니다.",
      cuttingSizeTip: "팽이버섯은 이 사이에 끼거나 질식할 수 있어 반드시 짧게 잘라 주세요.",
      seasoningTip: "일반 된장 대신 저염 아기된장을 소량 사용해 나트륨을 크게 낮췄습니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 0,
      reheatTip: "먹을 만큼만 덜어 냄비에서 끓여 급여하세요.",
    },
    sources: [
      {
        url: "https://www.childcare.go.kr",
        title: "성장기 유아를 위한 순한 저염 된장국",
        channelOrSite: "보건복지부 아이사랑",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "shrimp-egg-fried-rice",
    name: "새우달걀볶음밥",
    summary: "탱글한 새우살과 스크램블 에그로 감칠맛을 살린 한그릇 볶음밥",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "shrimp", amount: 50, unit: "g", prepNote: "내장 제거 후 다지기" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "carrot", amount: 25, unit: "g" },
      { ingredientSlug: "green-onion", amount: 15, unit: "g" },
      { ingredientSlug: "canola-oil", amount: 1, unit: "작은술" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction: "새우살은 등 쪽 내장을 빼고 잘게 다지며, 당근과 대파도 잘게 다집니다.",
      },
      {
        order: 2,
        instruction:
          "팬에 기름을 두르고 대파·당근·새우를 완전히 익도록 볶은 뒤 한쪽으로 밀고 달걀 스크램블을 만듭니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction: "밥과 아기간장 반 작은술을 넣어 고루 볶아 완성합니다.",
        timerSeconds: 120,
      },
    ],
    babyTips: {
      textureTip: "볶음밥이 고슬고슬해 삼키기 어려워하면 물 2큰술을 넣어 촉촉하게 볶으세요.",
      cuttingSizeTip: "통새우는 탄력이 강해 목에 걸릴 수 있으니 월령에 맞게 다져 주세요.",
      seasoningTip: "새우와 달걀 자체에 자연 나트륨이 있어 아기간장은 아주 소량만 넣습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 14,
      reheatTip: "냉동 볶음밥은 전자레인지에 1분 30초 데워 주세요.",
    },
    sources: [],
  },
  {
    slug: "chicken-mild-curry-rice",
    name: "닭가슴살순한아기카레덮밥",
    summary: "채소를 듬뿍 넣어도 아이들이 잘 먹는 저염 유아용 카레",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 3,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 270, unit: "g" },
      { ingredientSlug: "chicken-breast", amount: 90, unit: "g" },
      { ingredientSlug: "potato", amount: 80, unit: "g" },
      { ingredientSlug: "carrot", amount: 40, unit: "g" },
      { ingredientSlug: "onion", amount: 60, unit: "g" },
      { ingredientSlug: "water", amount: 220, unit: "ml" },
      { ingredientSlug: "milk", amount: 60, unit: "ml", isOptional: true },
      { ingredientSlug: "curry-powder-mild", amount: 18, unit: "g" },
    ],
    steps: [
      {
        order: 1,
        instruction: "닭가슴살, 감자, 당근, 양파를 모두 1cm 크기로 작게 깍둑썰기합니다.",
      },
      {
        order: 2,
        instruction: "냄비에 재료를 볶다가 물과 우유를 붓고 감자가 익을 때까지 끓입니다.",
        timerSeconds: 480,
      },
      {
        order: 3,
        instruction:
          "유아용 순한 카레가루를 조금씩 풀어 넣고 약불에서 3분간 저어가며 끓여 밥에 얹습니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "우유를 함께 넣으면 향신료 자극이 한결 부드러워집니다.",
      cuttingSizeTip: "당근과 감자는 모서리가 없도록 푹 익혀 주세요.",
      seasoningTip:
        "성인 카레 대신 나트륨·향신료를 줄인 유아용 순한 카레가루 정량 이하를 사용합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "카레 소스만 소분 냉동할 때는 감자를 빼거나 으깨서 보관하면 식감이 유지됩니다.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "편식 예방 채소 유아식 카레 가이드",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.93,
      },
    ],
  },
  {
    slug: "pork-tofu-tomato-ragu-pasta",
    name: "한돈두부토마토라구파스타",
    summary: "무염 토마토퓨레와 두부·한돈으로 만든 새콤달콤 유아 파스타",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["냄비", "프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "pasta-fusilli", amount: 60, unit: "g" },
      { ingredientSlug: "pork-minced", amount: 60, unit: "g", substituteSlug: "beef-minced" },
      { ingredientSlug: "tofu", amount: 50, unit: "g" },
      { ingredientSlug: "tomato-paste-unsalted", amount: 100, unit: "g" },
      { ingredientSlug: "onion", amount: 40, unit: "g" },
      { ingredientSlug: "baby-cheese", amount: 1, unit: "장" },
      { ingredientSlug: "olive-oil", amount: 1, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction: "푸실리 파스타면은 포장 표시 시간보다 2~3분 더 삶아 부드럽게 익힙니다.",
        timerSeconds: 660,
      },
      {
        order: 2,
        instruction: "팬에 올리브유와 다진 양파, 돼지고기, 으깬 두부를 완전히 익도록 볶습니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction:
          "무염 토마토퓨레와 면수를 조금 넣어 끓인 뒤 삶은 면과 아기치즈 1장을 녹여 버무립니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "푸실리나 마카로니는 포크로 찍기 쉬워 자기주도 식사에 좋습니다.",
      cuttingSizeTip: "2단계 이하 아기는 삶은 푸실리를 반으로 한 번 더 잘라 주세요.",
      seasoningTip: "소금 대신 아기치즈 1장으로 감칠맛과 저염 간을 맞췄습니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "라구 소스만 소분 냉동해 두면 밥이나 면에 바로 활용할 수 있습니다.",
    },
    sources: [],
  },
  {
    slug: "mackerel-radish-braised-mild",
    name: "무염고등어무순한조림",
    summary: "생강즙과 무로 비린내를 잡은 오메가3 풍부 등푸른생선 반찬",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "mackerel-unsalted", amount: 100, unit: "g", prepNote: "가시 제거한 순살" },
      { ingredientSlug: "radish", amount: 80, unit: "g" },
      { ingredientSlug: "onion", amount: 30, unit: "g" },
      { ingredientSlug: "water", amount: 150, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 1, unit: "작은술" },
      { ingredientSlug: "ginger-juice", amount: 0.25, unit: "작은술", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "생고등어 순살은 쌀뜨물이나 우유에 10분 담갔다 헹궈 비린내를 줄이고 가시를 꼼꼼히 발라냅니다.",
      },
      {
        order: 2,
        instruction:
          "냄비 바닥에 얇게 썬 무와 양파를 깔고 고등어, 물, 아기간장, 생강즙을 넣습니다.",
      },
      {
        order: 3,
        instruction: "뚜껑을 덮고 중약불에서 무가 푹 무르고 국물이 자작해질 때까지 조립니다.",
        timerSeconds: 900,
      },
    ],
    babyTips: {
      textureTip: "조림 국물에 적셔 살을 발라 주면 퍽퍽하지 않고 촉촉합니다.",
      cuttingSizeTip: "급여 직전 손가락으로 한 번 더 잔가시 유무를 확인하세요.",
      seasoningTip:
        "자염 고등어가 아닌 반드시 무염(생물) 고등어를 사용해야 나트륨이 넘지 않습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "등푸른생선은 산패가 빠르므로 조리 당일~익일 내 섭취를 권장합니다.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "어린이 등푸른 생선 안전 조리법",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.94,
      },
    ],
  },
  {
    slug: "beef-spinach-carrot-bibimbap",
    name: "소고기시금치아기비빔밥",
    summary: "세 가지 나물과 소고기 고명을 참기름으로 고소하게 비빈 유아식",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["냄비", "프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 200, unit: "g" },
      { ingredientSlug: "beef-minced", amount: 60, unit: "g" },
      { ingredientSlug: "spinach", amount: 40, unit: "g" },
      { ingredientSlug: "bean-sprouts", amount: 40, unit: "g" },
      { ingredientSlug: "carrot", amount: 30, unit: "g" },
      { ingredientSlug: "baby-soy-sauce", amount: 1, unit: "작은술" },
      { ingredientSlug: "sesame-oil", amount: 1, unit: "작은술" },
      { ingredientSlug: "sesame-powder", amount: 0.5, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "시금치와 콩나물은 각각 데쳐서 아기가 씹기 좋게 잘게 썰고 참기름과 참깨가루로 무칩니다.",
        timerSeconds: 180,
      },
      {
        order: 2,
        instruction:
          "채 썬 당근은 팬에 살짝 볶고, 소고기는 아기간장을 넣어 완전히 익도록 볶습니다.",
        timerSeconds: 240,
      },
      { order: 3, instruction: "따뜻한 밥 위에 나물과 소고기를 올리고 골고루 비벼 줍니다." },
    ],
    babyTips: {
      textureTip: "비빔밥이 뻑뻑하면 맑은 소고기국이나 채수를 2큰술 곁들여 비벼 주세요.",
      cuttingSizeTip: "콩나물 줄기와 시금치는 1.5cm 내외로 잘라야 목에 걸리지 않습니다.",
      seasoningTip: "고추장 대신 소고기 간장볶음과 참기름으로 고소한 맛을 냅니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "나물은 쉽게 상하므로 만든 당일 섭취하세요.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "어린이 균형 영양 나물 비빔밥",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },
  {
    slug: "clam-zucchini-rice-noodle-soup",
    name: "바지락육수애호박쌀국수",
    summary: "밀가루 없이 쌀국수면과 시원한 바지락육수로 끓인 저염 면 요리",
    category: "MEAL",
    mealCategories: ["LUNCH"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "rice-noodle",
        amount: 80,
        unit: "g",
        prepNote: "미지근한 물에 20분 불리기",
      },
      { ingredientSlug: "clam-broth", amount: 300, unit: "ml" },
      { ingredientSlug: "clam-meat", amount: 30, unit: "g", isOptional: true },
      { ingredientSlug: "zucchini", amount: 50, unit: "g" },
      { ingredientSlug: "mung-bean-sprouts", amount: 40, unit: "g" },
      { ingredientSlug: "soup-soy-sauce", amount: 0.25, unit: "작은술", isOptional: true },
    ],
    steps: [
      { order: 1, instruction: "불린 쌀국수면은 먹기 좋은 길이로 자르고, 숙주는 다듬어 씻습니다." },
      {
        order: 2,
        instruction: "바지락육수에 애호박과 바지락살을 넣고 팔팔 끓입니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction: "불린 쌀국수면과 숙주를 넣어 2~3분 더 끓여 완성합니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "쌀국수면은 밀가루 면보다 부드럽게 끊어져 유아가 먹기 편합니다.",
      cuttingSizeTip: "바지락살은 깨진 패각 조각이 없는지 확인하고 반으로 잘라 주세요.",
      seasoningTip: "바지락육수 자체에 감칠맛과 염분이 있어 국간장은 극소량만 넣거나 생략합니다.",
    },
    storageInfo: {
      fridgeDays: 0,
      freezerDays: 0,
      reheatTip: "조리 직후 따뜻할 때 바로 급여하세요.",
    },
    sources: [],
  },
  {
    slug: "duck-vegetable-stir-fry-rice",
    name: "생오리채소덮밥",
    summary: "훈제오리가 아닌 신선한 생오리살과 파프리카로 만든 영양 덮밥",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 200, unit: "g" },
      {
        ingredientSlug: "duck-breast",
        amount: 80,
        unit: "g",
        prepNote: "기름기 제거 후 잘게 썰기",
      },
      { ingredientSlug: "paprika", amount: 40, unit: "g" },
      { ingredientSlug: "onion", amount: 40, unit: "g" },
      { ingredientSlug: "king-oyster-mushroom", amount: 30, unit: "g" },
      { ingredientSlug: "baby-soy-sauce", amount: 1, unit: "작은술" },
      { ingredientSlug: "starch-potato", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 80, unit: "ml" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "생오리살은 눈에 보이는 지방을 떼어내고 잘게 썰어 마른 팬에 먼저 볶은 뒤 나온 기름을 닦아냅니다.",
        timerSeconds: 240,
      },
      {
        order: 2,
        instruction: "양파, 새송이버섯, 파프리카를 넣고 함께 볶습니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction:
          "물과 아기간장을 붓고 끓으면 감자전분을 물 1큰술에 풀어 농도를 맞춘 뒤 밥에 올립니다.",
        timerSeconds: 120,
      },
    ],
    babyTips: {
      textureTip: "전분물로 걸쭉한 덮밥 소스를 만들면 고기와 밥이 따로 놀지 않습니다.",
      cuttingSizeTip: "오리고기는 결 반대 방향으로 잘게 썰어야 질기지 않습니다.",
      seasoningTip: "첨가물이 많은 훈제오리 대신 생오리와 아기간장 소량을 사용합니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "덮밥 소스와 밥을 분리 보관 후 데워 부어 주세요.",
    },
    sources: [],
  },
  {
    slug: "tteokguk-beef-egg-stage4",
    name: "소고기사골떡국(3단계용)",
    summary: "37개월 이상 유아를 위한 작게 자른 떡과 무염 사골육수 떡국",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH"],
    ageStages: [4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "tteokguk-tteok",
        amount: 80,
        unit: "g",
        prepNote: "반 또는 4등분으로 작게 자르기",
      },
      { ingredientSlug: "beef-bone-broth-unsalted", amount: 280, unit: "ml" },
      { ingredientSlug: "beef-minced", amount: 40, unit: "g" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "laver-plain", amount: 1, unit: "장", isOptional: true },
      { ingredientSlug: "baby-soy-sauce", amount: null, unit: "약간", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction: "떡국떡은 찬물에 15분 불린 뒤 주방가위로 반 또는 4등분으로 작게 자릅니다.",
      },
      {
        order: 2,
        instruction:
          "무염 사골육수에 소고기를 넣고 끓으면 손질한 떡과 국간장 극소량을 넣어 말랑해질 때까지 끓입니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction: "풀어둔 달걀을 둘러 완전히 익히고 부순 무염김을 약간 올립니다.",
        timerSeconds: 60,
      },
    ],
    babyTips: {
      textureTip: "떡이 충분히 말랑해지도록 끓이고 식으면서 굳기 전에 천천히 먹이세요.",
      cuttingSizeTip:
        "37개월 이상이라도 통째 떡국떡은 질식 위험이 있으므로 반드시 작게 잘라 급여하세요.",
      seasoningTip: "시판 사골곰탕은 반드시 무염 제품인지 영양성분표를 확인하세요.",
    },
    storageInfo: {
      fridgeDays: 0,
      freezerDays: 0,
      reheatTip: "떡은 불고 식감이 굳어지므로 먹을 만큼만 바로 조리하세요.",
    },
    sources: [
      {
        url: "https://health.kdca.go.kr",
        title: "유아기 떡류 섭취 시 질식 예방 가이드",
        channelOrSite: "질병관리청 국가건강정보포털",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.96,
      },
    ],
  },

  // ==================== 간식 (SNACK) — 무염 (NONE) 6개 ====================
  {
    slug: "banana-oatmeal-pancake",
    name: "바나나오트밀팬케이크",
    summary: "밀가루·설탕·소금 없이 바나나와 귀리·달걀만으로 굽는 영양 간식",
    category: "SNACK",
    mealCategories: ["SNACK", "BREAKFAST"],
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "banana", amount: 1, unit: "개", prepNote: "잘 익은 바나나 으깨기" },
      { ingredientSlug: "oats", amount: 40, unit: "g", prepNote: "고운 오트밀" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "milk", amount: 30, unit: "ml", substituteSlug: "soy-milk-unsweetened" },
      { ingredientSlug: "unsalted-butter", amount: 3, unit: "g", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "잘 익은 바나나를 포크로 곱게 으깨고 달걀, 우유, 오트밀을 섞어 5분간 불립니다.",
        timerSeconds: 300,
      },
      {
        order: 2,
        instruction:
          "약불로 예열한 팬에 무염버터를 살짝 바르고 반죽을 한 숟가락씩 동그랗게 올립니다.",
      },
      {
        order: 3,
        instruction: "기포가 올라오면 뒤집어 앞뒤로 노릇하게 속까지 완전히 익힙니다.",
        timerSeconds: 240,
      },
    ],
    babyTips: {
      textureTip: "오트밀을 5분 불린 뒤 구우면 거친 식감 없이 촉촉합니다.",
      cuttingSizeTip: "아기가 손으로 잡기 좋은 스틱 모양으로 잘라 주세요.",
      seasoningTip: "검은 반점이 올라온 숙성 바나나를 쓰면 설탕 없이도 충분히 달콤합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "종이호일을 사이에 끼워 냉동 후 전자레인지에 30~40초 데우세요.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "노설탕 노밀가루 통곡물 간식 조리법",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.93,
      },
    ],
  },
  {
    slug: "sweet-potato-apple-mash-balls",
    name: "고구마사과볼",
    summary: "달콤한 고구마와 상큼한 사과로 빚어 오븐·에어프라이어에 구운 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["에어프라이어", "전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "sweet-potato", amount: 1, unit: "개", prepNote: "찐 고구마" },
      { ingredientSlug: "apple", amount: 40, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "milk", amount: 20, unit: "ml", substituteSlug: "water" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "껍질 벗긴 고구마를 쪄서 뜨거울 때 포크로 곱게 으깨고 우유를 섞어 부드럽게 만듭니다.",
      },
      {
        order: 2,
        instruction:
          "잘게 다진 사과를 전자레인지에 1분 익혀 수분을 날린 뒤 고구마 반죽에 섞습니다.",
        timerSeconds: 60,
      },
      {
        order: 3,
        instruction: "한입 크기로 빚어 에어프라이어 170℃에서 7~8분 노릇하게 굽습니다.",
        timerSeconds: 450,
      },
    ],
    babyTips: {
      textureTip: "고구마가 목이 메지 않도록 우유 양으로 촉촉함을 맞춰 주세요.",
      cuttingSizeTip: "사과 조각이 크면 볼이 갈라지므로 3~4mm로 잘게 다져 주세요.",
      seasoningTip:
        "알레르기 유발 원료(달걀·밀·견과)가 거의 없는 순한 과일·구황작물 간식입니다(우유는 물로 대체 가능).",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지에 30초 데운 뒤 우유나 물과 함께 급여하세요.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "자연 단맛을 살린 영유아 핑거푸드",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },
  {
    slug: "blueberry-yogurt-rice-muffin",
    name: "블루베리요거트쌀머핀",
    summary: "전자레인지와 습식쌀가루로 10분 만에 쪄내는 폭신한 쌀 찐빵 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 10,
    difficulty: 1,
    tools: ["전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "rice-flour", amount: 50, unit: "g" },
      { ingredientSlug: "plain-yogurt", amount: 50, unit: "g" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "blueberry", amount: 20, unit: "g", prepNote: "반으로 자르기" },
    ],
    steps: [
      {
        order: 1,
        instruction: "볼에 달걀과 플레인요거트를 고루 섞은 뒤 쌀가루를 넣어 멍울 없이 저어줍니다.",
      },
      {
        order: 2,
        instruction: "내열 머핀 틀에 반죽을 70%만 채우고 반으로 자른 블루베리를 올립니다.",
      },
      {
        order: 3,
        instruction: "전자레인지에서 2분 30초~3분간 속까지 완전히 익힙니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "전자레인지 조리 후 뚜껑을 덮어 1분 뜸을 들이면 표면이 마르지 않습니다.",
      cuttingSizeTip: "블루베리는 통째로 넣지 말고 반드시 반 이상 잘라 넣어 주세요.",
      seasoningTip: "베이킹파우더나 설탕 없이도 달걀 거품과 요거트로 폭신하게 익습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 14,
      reheatTip: "쌀빵은 냉장 시 굳으므로 실온 식힘 후 바로 냉동했다가 데워 주세요.",
    },
    sources: [],
  },
  {
    slug: "avocado-banana-yogurt-cup",
    name: "아보카도바나나요거트볼",
    summary: "불 없이 5분 만에 만드는 건강한 지방·유산균 보충 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 5,
    difficulty: 1,
    tools: ["조리도구없음"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "avocado", amount: 0.5, unit: "개", prepNote: "후숙된 것" },
      { ingredientSlug: "banana", amount: 0.5, unit: "개" },
      { ingredientSlug: "plain-yogurt", amount: 80, unit: "g" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "잘 후숙된 아보카도와 바나나를 껍질을 벗겨 그릇에 담고 포크로 부드럽게 으깹니다.",
      },
      { order: 2, instruction: "무가당 플레인요거트를 넣고 고루 섞어 바로 급여합니다." },
    ],
    babyTips: {
      textureTip: "아보카도는 껍질이 거무스름하게 잘 익은 것을 써야 버터처럼 부드럽습니다.",
      cuttingSizeTip: "덩어리가 남지 않게 월령에 맞춰 으깨기 정도를 조절하세요.",
      seasoningTip: "시럽이나 꿀 없이 바나나의 단맛으로 요거트의 신맛을 중화합니다.",
    },
    storageInfo: {
      fridgeDays: 0,
      freezerDays: 0,
      reheatTip: "갈변이 빠르므로 만든 직후 바로 먹이세요.",
    },
    sources: [],
  },
  {
    slug: "pear-steamed-warm-compote",
    name: "배숙퓨레(무설탕)",
    summary: "환절기 수분 보충에 좋은 달콤하고 따뜻한 찐 배 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "pear", amount: 0.5, unit: "개", prepNote: "씨와 껍질 제거" },
      { ingredientSlug: "water", amount: 60, unit: "ml" },
    ],
    steps: [
      { order: 1, instruction: "배는 껍질과 씨 부분의 까끌한 심지를 도려내고 작게 썹니다." },
      {
        order: 2,
        instruction: "냄비에 배와 물을 넣고 약불에서 투명하고 말랑해질 때까지 15분간 끓입니다.",
        timerSeconds: 900,
      },
      {
        order: 3,
        instruction: "월령에 따라 포크로 으깨거나 한입 크기로 식혀 따뜻하게 급여합니다.",
      },
    ],
    babyTips: {
      textureTip: "생배의 아삭함이 부담스러운 완료기 아기에게도 아주 부드럽습니다.",
      cuttingSizeTip: "씨 주변의 석세포(까슬한 부분)를 넉넉히 도려내야 식감이 좋습니다.",
      seasoningTip: "꿀이나 설탕을 전혀 넣지 않고 배 고유의 과즙 단맛만 살립니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 7,
      reheatTip: "중탕이나 전자레인지로 미지근하게 데워 주세요.",
    },
    sources: [
      {
        url: "https://www.childcare.go.kr",
        title: "환절기 영유아 목 건강을 위한 배숙 가이드",
        channelOrSite: "보건복지부 아이사랑",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },
  {
    slug: "tofu-sweet-pumpkin-smooth-pudding",
    name: "연두부단호박수프",
    summary: "연두부와 찐 단호박을 갈아 따뜻하게 끓인 부드러운 영양 간식",
    category: "SNACK",
    mealCategories: ["SNACK", "BREAKFAST"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비", "전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "soft-tofu", amount: 100, unit: "g" },
      { ingredientSlug: "sweet-pumpkin", amount: 80, unit: "g" },
      { ingredientSlug: "soy-milk-unsweetened", amount: 80, unit: "ml", substituteSlug: "milk" },
    ],
    steps: [
      {
        order: 1,
        instruction: "단호박은 껍질과 씨를 제거해 전자레인지에 3분 익힙니다.",
        timerSeconds: 180,
      },
      {
        order: 2,
        instruction:
          "익힌 단호박, 연두부, 무가당 두유를 곱게 으깨 섞은 뒤 냄비에서 약불로 한소끔 끓입니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "목이 부었거나 치아가 나는 시기에 부담 없이 넘길 수 있는 식감입니다.",
      cuttingSizeTip: "덩어리가 없도록 고루 으깨 주세요.",
      seasoningTip: "우유·달걀·밀 없이 식물성 단백질로만 구성한 담백한 간식입니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "약불에서 저어가며 따뜻하게 데워 주세요.",
    },
    sources: [],
  },

  // ==================== 간식 (SNACK) — 저염 (LOW) 4개 ====================
  {
    slug: "potato-cheese-pancake-stick",
    name: "감자아기치즈전",
    summary: "겉은 노릇하고 속은 쫀득한 아기치즈 감자 스틱 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "potato", amount: 1, unit: "개", prepNote: "삶아 으깨기" },
      { ingredientSlug: "baby-cheese", amount: 1, unit: "장", prepNote: "잘게 찢기" },
      { ingredientSlug: "starch-potato", amount: 1, unit: "큰술" },
      { ingredientSlug: "canola-oil", amount: 1, unit: "작은술" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "포슬하게 삶은 감자를 뜨거울 때 으깨고 잘게 찢은 아기치즈와 감자전분을 섞어 반죽합니다.",
      },
      {
        order: 2,
        instruction:
          "납작한 동그라미나 스틱 모양으로 성형해 기름을 살짝 두른 약불 팬에서 앞뒤로 노릇하게 굽습니다.",
        timerSeconds: 300,
      },
    ],
    babyTips: {
      textureTip: "감자가 뜨거울 때 치즈를 넣어야 뭉침 없이 잘 녹아 섞입니다.",
      cuttingSizeTip:
        "한입에 쏙 들어가지 않게 손가락 길이의 스틱으로 자르면 베어 물기 연습에 좋습니다.",
      seasoningTip: "소금 대신 저염 아기치즈 1장으로 짭조름한 풍미를 더했습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "에어프라이어 160℃에서 3~4분 데우면 다시 쫀득해집니다.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "영유아 감자 간식 레시피",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },
  {
    slug: "french-toast-apple-finger",
    name: "식빵달걀프렌치토스트스틱",
    summary: "우유·달걀물에 촉촉히 적셔 구운 부드러운 핑거푸드 토스트",
    category: "SNACK",
    mealCategories: ["SNACK", "BREAKFAST"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 10,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-bread",
        amount: 2,
        unit: "장",
        prepNote: "테두리 제거 후 스틱 썰기",
      },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "milk", amount: 60, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 5, unit: "g" },
    ],
    steps: [
      {
        order: 1,
        instruction: "식빵은 질긴 갈색 테두리를 잘라내고 손가락 굵기의 스틱 모양으로 썹니다.",
      },
      { order: 2, instruction: "달걀과 우유를 고루 풀어 식빵 스틱을 속까지 촉촉하게 적십니다." },
      {
        order: 3,
        instruction:
          "약불 팬에 무염버터를 녹이고 네 면을 굴려가며 달걀물이 완전히 익도록 굽습니다.",
        timerSeconds: 240,
      },
    ],
    babyTips: {
      textureTip: "우유 달걀물에 충분히 적셔야 속까지 카스테라처럼 부드럽습니다.",
      cuttingSizeTip: "마른 식빵 테두리는 꼭 제거해 주세요.",
      seasoningTip: "식빵 자체에 염분이 들어 있으므로 소금·설탕을 추가하지 않습니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "전자레인지에 20~30초 데워 따뜻하게 주세요.",
    },
    sources: [],
  },
  {
    slug: "sweet-corn-mozzarella-egg-cup",
    name: "옥수수생모짜렐라달걀컵",
    summary: "톡톡 씹히는 다진 옥수수와 저염 생모짜렐라를 넣은 오븐 에그컵",
    category: "SNACK",
    mealCategories: ["SNACK", "BREAKFAST"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["에어프라이어", "전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "egg", amount: 2, unit: "개" },
      { ingredientSlug: "sweet-corn", amount: 30, unit: "g", prepNote: "알갱이 다지기" },
      { ingredientSlug: "mozzarella-fresh", amount: 25, unit: "g" },
      { ingredientSlug: "milk", amount: 30, unit: "ml" },
      { ingredientSlug: "broccoli", amount: 15, unit: "g", isOptional: true },
    ],
    steps: [
      {
        order: 1,
        instruction: "찐 옥수수 알갱이와 데친 브로콜리를 잘게 다지고 생모짜렐라도 작게 썹니다.",
      },
      { order: 2, instruction: "달걀과 우유를 풀어 재료를 섞은 뒤 내열 머핀컵에 나누어 담습니다." },
      {
        order: 3,
        instruction: "에어프라이어 170℃에서 10~12분간 중심부까지 완전히 익힙니다.",
        timerSeconds: 660,
      },
    ],
    babyTips: {
      textureTip: "우유를 넣으면 오븐에 구워도 퍽퍽하지 않고 촉촉합니다.",
      cuttingSizeTip: "옥수수 통알갱이는 껍질이 질기므로 2단계 아기는 반드시 다져서 넣어 주세요.",
      seasoningTip: "피자치즈 대신 염분이 훨씬 낮은 생모짜렐라치즈를 사용합니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "냉장 보관 시 전자레인지에 40초 데워 속까지 따뜻한지 확인하세요.",
    },
    sources: [],
  },
  {
    slug: "almond-walnut-banana-rice-cake",
    name: "견과류가루바나나쌀케이크",
    summary: "통견과 대신 고운 아몬드·호두가루로 영양을 채운 고소한 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["에어프라이어", "전자레인지"],
    baseServings: 2,
    ingredients: [
      { ingredientSlug: "rice-flour", amount: 50, unit: "g" },
      { ingredientSlug: "almond-powder", amount: 15, unit: "g" },
      { ingredientSlug: "walnut-powder", amount: 10, unit: "g" },
      { ingredientSlug: "banana", amount: 1, unit: "개" },
      { ingredientSlug: "egg", amount: 1, unit: "개" },
      { ingredientSlug: "milk", amount: 40, unit: "ml" },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "으깬 바나나에 달걀과 우유를 섞은 뒤 쌀가루, 아몬드가루, 호두가루를 넣어 고루 섞습니다.",
      },
      { order: 2, instruction: "호두가루에 굵은 조각이 섞여 있지 않은지 꼭 확인합니다." },
      {
        order: 3,
        instruction:
          "내열 용기에 담아 에어프라이어 170℃에서 15분(또는 전자레인지 3분) 속까지 완전히 익힙니다.",
        timerSeconds: 900,
      },
    ],
    babyTips: {
      textureTip: "아몬드가루가 들어가 일반 쌀빵보다 훨씬 촉촉하고 고소합니다.",
      cuttingSizeTip: "통견과는 질식 위험이 크므로 반드시 덩어리 없는 100% 가루만 사용하세요.",
      seasoningTip: "첫 견과류 시도 아기는 소량씩 알레르기 반응을 먼저 확인한 뒤 먹이세요.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 14,
      reheatTip: "소분 냉동 후 전자레인지에 30~40초 데워 주세요.",
    },
    sources: [
      {
        url: "https://health.kdca.go.kr",
        title: "영유아 견과류 가루 형태 섭취 지침",
        channelOrSite: "질병관리청 국가건강정보포털",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.96,
      },
    ],
  },

  // ==================== 추가 검증 레시피 20개 (31~50번) ====================

  {
    slug: "anchovy-zucchini-rice-ball",
    name: "멸치애호박주먹밥",
    summary: "지리멸치의 짠기를 물에 씻어내고 달큼한 애호박과 버무린 한입 핑거푸드 주먹밥",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["프라이팬", "볼"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
        prepNote: "따뜻한 진밥",
      },
      {
        ingredientSlug: "anchovy-low-sodium",
        amount: 10,
        unit: "g",
        prepNote: "찬물에 10분 담가 짠기 뺀 후 다지기",
      },
      {
        ingredientSlug: "zucchini",
        amount: 30,
        unit: "g",
        prepNote: "3mm 잘게 다지기",
      },
      {
        ingredientSlug: "laver-plain",
        amount: 1,
        unit: "g",
        prepNote: "구운 무염김 잘게 부수기",
      },
      {
        ingredientSlug: "sesame-oil",
        amount: 1,
        unit: "작은술",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "저염 잔멸치는 찬물에 10분간 담가 짠기를 뺀 뒤 물기를 꼭 짜고 잘게 다집니다.",
        timerSeconds: 600,
      },
      {
        order: 2,
        instruction:
          "애호박은 3mm 크기로 잘게 다져 마른 팬에 물 1큰술을 넣고 투명해질 때까지 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 3,
        instruction: "볼에 따뜻한 밥, 볶은 애호박, 멸치, 참기름, 부순 무염김을 넣고 고루 섞습니다.",
      },
      {
        order: 4,
        instruction: "아기가 한입에 쏙 넣을 수 있도록 1.5~2cm 크기로 동글동글 빚어 완성합니다.",
      },
    ],
    babyTips: {
      textureTip: "밥알이 촉촉하게 뭉쳐지도록 따뜻한 상태에서 빚어주세요.",
      cuttingSizeTip: "완료기는 1.5cm 한입 크기, 유아식 2단계는 손가락 스틱형으로 빚어도 좋습니다.",
      seasoningTip: "멸치를 물에 충분히 헹궈 소금기 없이 멸치 고유의 고소한 감칠맛만 살립니다.",
      stageVariations: {
        "1": "진밥에 채수 1큰술을 더해 더 부드럽게 뭉쳐주세요.",
        "2": "아기가 손으로 직접 집어먹는 자기주도 식판식으로 안성맞춤입니다.",
      },
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "랩을 씌워 전자레인지에 20초간 살짝 데워 굳은 밥을 부드럽게 만들어주세요.",
      portionTip: "한 끼 분량(6~8알)씩 랩으로 소분해 밀폐용기에 담아 보관하세요.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "영유아 주먹밥 안전 조리 및 멸치 짠기 제거 가이드",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },

  {
    slug: "beef-tofu-rice-bowl",
    name: "소고기두부덮밥",
    summary: "부드러운 연두부와 다진 소고기, 채소로 걸쭉하고 촉촉하게 끓여낸 무염 덮밥",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
      },
      {
        ingredientSlug: "beef-tenderloin",
        amount: 40,
        unit: "g",
        prepNote: "핏물 제거 후 잘게 다지기",
        substituteSlug: "beef-minced",
      },
      {
        ingredientSlug: "tofu",
        amount: 50,
        unit: "g",
        prepNote: "끓는 물에 데쳐 1cm 깍둑썰기",
        substituteSlug: "soft-tofu",
      },
      {
        ingredientSlug: "enoki-mushroom",
        amount: 20,
        unit: "g",
        prepNote: "1cm 길이로 썰기",
        substituteSlug: "shiitake-mushroom",
      },
      {
        ingredientSlug: "carrot",
        amount: 20,
        unit: "g",
        prepNote: "3mm 다지기",
      },
      {
        ingredientSlug: "vegetable-broth",
        amount: 150,
        unit: "ml",
      },
      {
        ingredientSlug: "starch-potato",
        amount: 2,
        unit: "g",
        prepNote: "물 1큰술에 풀어 전분물 준비",
        isOptional: true,
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "소고기는 핏물을 제거하고 곱게 다지며, 두부는 끓는 물에 데쳐 1cm 크기로 깍둑썹니다.",
      },
      {
        order: 2,
        instruction: "당근과 팽이버섯은 아기가 씹기 편하도록 5mm 이하로 잘게 다집니다.",
      },
      {
        order: 3,
        instruction: "냄비에 채수와 소고기를 넣고 뭉치지 않게 저어가며 중불에서 끓입니다.",
        timerSeconds: 180,
      },
      {
        order: 4,
        instruction:
          "당근, 버섯, 두부를 넣고 약불에서 5분간 뭉근하게 끓인 뒤, 전분물을 둘러 농도를 맞춥니다.",
        timerSeconds: 300,
      },
      {
        order: 5,
        instruction: "따뜻한 밥 위에 걸쭉한 소스를 얹어 비벼 먹입니다.",
      },
    ],
    babyTips: {
      textureTip: "전분물로 부드러운 농도를 잡아 목넘김이 촉촉합니다.",
      cuttingSizeTip: "두부는 숟가락으로 살짝 으깰 수 있는 크기로 썰어주세요.",
      seasoningTip: "채수와 소고기 육즙으로 자연스러운 감칠맛을 냅니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 10,
      reheatTip: "전자레인지 1분 데운 뒤 골고루 저어 온도를 맞춰주세요.",
    },
    sources: [],
  },

  {
    slug: "chicken-sweet-pumpkin-rice",
    name: "닭가슴살단호박진밥",
    summary: "달콤한 찐 단호박과 부드러운 닭고기로 영양과 소화 흡수를 돕는 무염 진밥",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
      },
      {
        ingredientSlug: "chicken-breast",
        amount: 40,
        unit: "g",
        prepNote: "힘줄 제거 후 잘게 다지기",
        substituteSlug: "chicken-tenderloin",
      },
      {
        ingredientSlug: "sweet-pumpkin",
        amount: 50,
        unit: "g",
        prepNote: "껍질 벗겨 5mm 썰기",
      },
      {
        ingredientSlug: "onion",
        amount: 20,
        unit: "g",
        prepNote: "곱게 다지기",
      },
      {
        ingredientSlug: "chicken-broth-unsalted",
        amount: 140,
        unit: "ml",
        substituteSlug: "vegetable-broth",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "단호박은 껍질을 벗겨 5mm 크기로 썰고, 양파와 닭가슴살도 곱게 다집니다.",
      },
      {
        order: 2,
        instruction:
          "냄비에 닭육수와 닭가슴살, 양파를 넣고 닭고기가 익을 때까지 중불에서 끓입니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction:
          "단호박과 따뜻한 밥을 넣고 주걱으로 저어가며 약불에서 부드럽게 퍼지도록 끓입니다.",
        timerSeconds: 360,
      },
      {
        order: 4,
        instruction: "단호박이 부드럽게 으스러지면 불을 끄고 뜸을 들여 완성합니다.",
      },
    ],
    babyTips: {
      textureTip: "단호박의 당분 덕분에 아기들이 거부감 없이 싹싹 비우는 진밥입니다.",
      cuttingSizeTip: "닭가슴살은 결 반대 방향으로 잘게 다져 퍽퍽하지 않게 해주세요.",
      seasoningTip: "단호박의 천연 단맛과 닭육수만으로 충분히 맛있습니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "물 1큰술을 더해 전자레인지에 1분 20초간 데워주세요.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "영유아 단호박 닭고기 진밥 영양 조리법",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.94,
      },
    ],
  },

  {
    slug: "cod-potato-clear-soup",
    name: "대구살감자맑은탕",
    summary: "담백한 흰살 대구살과 포슬포슬한 감자로 끓여낸 맑고 시원한 아기 국",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "cod",
        amount: 50,
        unit: "g",
        prepNote: "가시 확인 후 1cm 썰기",
        substituteSlug: "flounder",
      },
      {
        ingredientSlug: "potato",
        amount: 40,
        unit: "g",
        prepNote: "얇게 나박썰기",
      },
      {
        ingredientSlug: "radish",
        amount: 30,
        unit: "g",
        prepNote: "얇게 나박썰기",
      },
      {
        ingredientSlug: "dashima",
        amount: 2,
        unit: "g",
        prepNote: "다시마 우린 물용",
      },
      {
        ingredientSlug: "water",
        amount: 200,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "대구살은 손으로 꼼꼼히 만져 잔가시를 확인하고 1cm 크기로 깍둑썹니다.",
      },
      {
        order: 2,
        instruction: "감자와 무는 아기가 잇몸으로 부술 수 있도록 얇게 나박썹니다.",
      },
      {
        order: 3,
        instruction:
          "냄비에 물과 다시마를 넣고 끓어오르면 다시마를 건져낸 뒤 무와 감자를 넣고 끓입니다.",
        timerSeconds: 300,
      },
      {
        order: 4,
        instruction:
          "감자가 익으면 대구살을 넣고 살이 부서지지 않게 약불에서 3분간 더 끓여 맑게 완성합니다.",
        timerSeconds: 180,
      },
    ],
    babyTips: {
      textureTip: "생선살이 퍽퍽해지지 않도록 감자가 다 익은 마지막에 넣어 살짝 익힙니다.",
      cuttingSizeTip: "무와 감자는 푹 익혀 숟가락으로 쉽게 으깨질 정도로 끓입니다.",
      seasoningTip: "무와 다시마에서 우러난 천연 시원한 맛으로 간을 맞춥니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 7,
      reheatTip: "냄비에 부어 한소끔 바글바글 끓인 후 식혀 먹입니다.",
    },
    sources: [],
  },

  {
    slug: "spinach-egg-yolk-porridge",
    name: "시금치달걀노른자죽",
    summary: "철분이 풍부한 시금치와 고소한 달걀노른자로 부드럽게 넘기는 아침 영양죽",
    category: "MEAL",
    mealCategories: ["BREAKFAST"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 140,
        unit: "g",
      },
      {
        ingredientSlug: "egg-yolk",
        amount: 20,
        unit: "g",
        prepNote: "신선한 달걀노른자 1개",
      },
      {
        ingredientSlug: "spinach",
        amount: 25,
        unit: "g",
        prepNote: "잎 부분만 끓는 물에 데쳐 다지기",
      },
      {
        ingredientSlug: "vegetable-broth",
        amount: 160,
        unit: "ml",
      },
      {
        ingredientSlug: "sesame-oil",
        amount: 0.5,
        unit: "작은술",
        isOptional: true,
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "시금치는 끓는 물에 30초간 데친 뒤 찬물에 헹궈 물기를 짜고 부드러운 잎 위주로 곱게 다집니다.",
        timerSeconds: 30,
      },
      {
        order: 2,
        instruction: "냄비에 채수와 밥을 넣고 주걱으로 으깨어가며 중약불에서 끓입니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction: "죽이 끓어오르면 다진 시금치와 달걀노른자를 넣고 재빨리 저어 완전히 익힙니다.",
        timerSeconds: 120,
      },
      {
        order: 4,
        instruction: "불을 끄고 참기름을 살짝 떨어뜨려 고소한 향을 더합니다.",
      },
    ],
    babyTips: {
      textureTip: "식중독 예방을 위해 달걀노른자는 반드시 속까지 완전히 익혀 제공합니다.",
      cuttingSizeTip: "시금치 줄기는 질길 수 있으므로 부드러운 잎 위주로 조리하세요.",
      seasoningTip: "달걀노른자의 고소함으로 별도 조미료 없이 부드러운 풍미가 완성됩니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "전자레인지 1분 데운 후 잘 섞어 따뜻하게 먹입니다.",
    },
    sources: [
      {
        url: "https://health.kdca.go.kr",
        title: "영유아 달걀 완숙 조리 및 알레르기 예방 가이드",
        channelOrSite: "질병관리청 국가건강정보포털",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.96,
      },
    ],
  },

  {
    slug: "beef-meatball-veggie-simmer",
    name: "소고기완자채소조림",
    summary: "소고기 다짐육으로 동글동글 빚은 완자를 당근·브로콜리와 함께 조린 핑거푸드 반찬",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["프라이팬", "냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "beef-minced",
        amount: 60,
        unit: "g",
      },
      {
        ingredientSlug: "onion",
        amount: 25,
        unit: "g",
        prepNote: "곱게 다지기",
      },
      {
        ingredientSlug: "carrot",
        amount: 25,
        unit: "g",
        prepNote: "5mm 부드럽게 썰기",
      },
      {
        ingredientSlug: "broccoli",
        amount: 20,
        unit: "g",
        prepNote: "한입 크기로 작게 송이 떼기",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 2.5,
        unit: "ml",
        prepNote: "0.5작은술",
      },
      {
        ingredientSlug: "vegetable-broth",
        amount: 100,
        unit: "ml",
      },
      {
        ingredientSlug: "starch-potato",
        amount: 3,
        unit: "g",
        prepNote: "완자 반죽 결착용",
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "볼에 소고기 다짐육, 다진 양파, 감자전분을 넣고 끈기가 생길 때까지 치댄 후 직경 2cm 크기로 동글동글 빚습니다.",
      },
      {
        order: 2,
        instruction: "끓는 물에 완자를 넣고 3분간 데쳐 기름기를 빼고 건져냅니다.",
        timerSeconds: 180,
      },
      {
        order: 3,
        instruction: "냄비에 채수, 아기간장, 당근, 데친 완자를 넣고 중불에서 5분간 조립니다.",
        timerSeconds: 300,
      },
      {
        order: 4,
        instruction: "브로콜리를 넣고 국물이 자작해질 때까지 2분간 더 조려 완성합니다.",
        timerSeconds: 120,
      },
    ],
    babyTips: {
      textureTip: "완자를 한번 데쳐 조리면 겉은 단단해져 부스러지지 않고 속은 촉촉합니다.",
      cuttingSizeTip: "아기가 두 손가락으로 쥐기 좋은 크기(약 2cm)로 빚어주세요.",
      seasoningTip: "아기간장 0.5작은술로 은은한 색과 향만 더합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지 1분 데우거나 프라이팬에 채수 1큰술과 함께 살짝 굴려 데웁니다.",
    },
    sources: [],
  },

  {
    slug: "hairtail-radish-simmer",
    name: "순살갈치무순한조림",
    summary: "뼈와 가시를 완벽히 제거한 순살 갈치와 달큼한 무를 은은하게 조려낸 밥도둑 생선 반찬",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "hairtail",
        amount: 60,
        unit: "g",
        prepNote: "가시 완벽 확인 후 2cm 토막",
        substituteSlug: "flounder",
      },
      {
        ingredientSlug: "radish",
        amount: 50,
        unit: "g",
        prepNote: "1cm 두께 부드럽게 썰기",
      },
      {
        ingredientSlug: "onion",
        amount: 20,
        unit: "g",
        prepNote: "채썰기",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 4,
        unit: "ml",
      },
      {
        ingredientSlug: "apple",
        amount: 20,
        unit: "g",
        prepNote: "강판에 곱게 갈아 자연 단맛 내기",
      },
      {
        ingredientSlug: "water",
        amount: 150,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "순살 갈치는 잔가시가 없는지 확인하고 2cm 크기로 먹기 좋게 자릅니다.",
      },
      {
        order: 2,
        instruction:
          "냄비 바닥에 도톰하게 썬 무를 깔고 물 150ml를 부어 무가 푹 익도록 10분간 먼저 끓입니다.",
        timerSeconds: 600,
      },
      {
        order: 3,
        instruction:
          "무가 부드러워지면 갈치살과 양파를 얹고, 아기간장과 올리고당을 섞은 양념장을 끼얹습니다.",
      },
      {
        order: 4,
        instruction: "뚜껑을 덮고 약불에서 갈치 속까지 양념이 배도록 5분간 조려 완성합니다.",
        timerSeconds: 300,
      },
    ],
    babyTips: {
      textureTip: "갈치살이 부드러워 밥 위에 살짝 으깨어 비벼 먹이기 좋습니다.",
      cuttingSizeTip: "어린 아기에게 먹일 때는 포크로 살을 한 번 더 쪼개어 가시 유무를 확인하세요.",
      seasoningTip: "무와 양파에서 나오는 단맛으로 설탕 없이도 부드러운 감칠맛이 납니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 7,
      reheatTip: "전자레인지 1분 데운 뒤 밥과 함께 비벼 먹입니다.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "영유아 어류 가시 제거 안전 지침 및 저염 조림법",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },

  {
    slug: "perilla-mushroom-beef-rice",
    name: "들깨버섯소고기진밥",
    summary: "구수한 국산 들깨가루와 새송이버섯, 소고기로 끓여 속을 든든하게 채우는 무염 진밥",
    category: "MEAL",
    mealCategories: ["BREAKFAST", "LUNCH", "DINNER"],
    ageStages: [2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
      },
      {
        ingredientSlug: "beef-minced",
        amount: 40,
        unit: "g",
        prepNote: "핏물 제거",
      },
      {
        ingredientSlug: "king-oyster-mushroom",
        amount: 30,
        unit: "g",
        prepNote: "작게 깍둑썰기",
        substituteSlug: "shiitake-mushroom",
      },
      {
        ingredientSlug: "perilla-seed-powder",
        amount: 8,
        unit: "g",
        prepNote: "곱게 빻은 거피 들깨가루",
      },
      {
        ingredientSlug: "zucchini",
        amount: 30,
        unit: "g",
        prepNote: "5mm 다지기",
      },
      {
        ingredientSlug: "vegetable-broth",
        amount: 150,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "소고기는 핏물을 제거하고, 새송이버섯과 애호박은 5mm 크기로 작게 썹니다.",
      },
      {
        order: 2,
        instruction: "냄비에 채수 2큰술과 소고기를 넣고 고기가 뭉치지 않게 중불에서 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 3,
        instruction: "남은 채수와 버섯, 애호박, 밥을 넣고 약불에서 6분간 저어가며 무르게 끓입니다.",
        timerSeconds: 360,
      },
      {
        order: 4,
        instruction: "불을 끄기 직전에 들깨가루를 넣고 골고루 섞어 구수한 풍미를 살립니다.",
      },
    ],
    babyTips: {
      textureTip: "껍질을 벗긴(거피) 고운 들깨가루를 사용하여 목에 걸리지 않도록 합니다.",
      cuttingSizeTip: "버섯은 쫄깃한 식감이 있으므로 5mm 이하로 잘게 썰어주세요.",
      seasoningTip: "들깨가루 특유의 고소한 향미 덕분에 소금 없이도 아기가 잘 먹습니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지 1분 30초 데워 골고루 섞어줍니다.",
    },
    sources: [],
  },

  {
    slug: "shrimp-zucchini-fusilli",
    name: "새우애호박푸실리파스타",
    summary: "포크로 콕 찍거나 손으로 집어먹기 좋은 숏파스타 푸실리와 통통한 새우살 파스타",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["냄비", "프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "pasta-fusilli",
        amount: 50,
        unit: "g",
        prepNote: "부드럽게 10분 이상 푹 삶기",
      },
      {
        ingredientSlug: "shrimp",
        amount: 40,
        unit: "g",
        prepNote: "내장 제거 후 작게 썰기",
      },
      {
        ingredientSlug: "zucchini",
        amount: 30,
        unit: "g",
        prepNote: "얇게 부채꼴 썰기",
      },
      {
        ingredientSlug: "onion",
        amount: 20,
        unit: "g",
        prepNote: "채썰기",
      },
      {
        ingredientSlug: "olive-oil",
        amount: 4,
        unit: "ml",
      },
      {
        ingredientSlug: "baby-cheese",
        amount: 10,
        unit: "g",
        prepNote: "0.5장 잘게 찢기",
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "푸실리 파스타는 끓는 물에 소금 없이 10~12분간 푹 삶아 아주 부드러운 상태로 건집니다.",
        timerSeconds: 660,
      },
      {
        order: 2,
        instruction: "새우살은 내장을 제거하고 작게 썰며, 애호박과 양파도 먹기 좋은 크기로 썹니다.",
      },
      {
        order: 3,
        instruction:
          "팬에 올리브유를 두르고 양파, 애호박, 새우살을 넣어 새우가 붉게 익을 때까지 볶습니다.",
        timerSeconds: 180,
      },
      {
        order: 4,
        instruction:
          "삶은 푸실리와 면수 2큰술을 넣고 볶다가, 불을 끄고 아기치즈를 섞어 고소하게 녹입니다.",
      },
    ],
    babyTips: {
      textureTip: "어른 파스타와 달리 알덴테가 아닌 속까지 푹 익혀 부드러운 식감이어야 합니다.",
      cuttingSizeTip:
        "푸실리는 나선형 홈에 소스가 잘 배어 손으로 집어먹기에 가장 안전한 파스타입니다.",
      seasoningTip: "새우 자체의 감칠맛과 아기치즈 반 장으로 풍미를 냅니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "물 1큰술을 두르고 전자레인지에 40초간 데워 촉촉하게 만듭니다.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "어린이 성장기 파스타 조리 지침",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },

  {
    slug: "chicken-pumpkin-gratin",
    name: "닭안심단호박그라탕",
    summary: "달콤하게 찐 단호박 퓌레 위에 부드러운 닭안심과 아기치즈를 얹어 고소하게 구운 그라탕",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3],
    saltLevel: "NONE",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["오븐", "전자레인지"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "sweet-pumpkin",
        amount: 100,
        unit: "g",
        prepNote: "찐 후 부드럽게 으깨기",
      },
      {
        ingredientSlug: "chicken-tenderloin",
        amount: 40,
        unit: "g",
        prepNote: "삶아서 결대로 잘게 찢기",
      },
      {
        ingredientSlug: "broccoli",
        amount: 20,
        unit: "g",
        prepNote: "데쳐서 작게 썰기",
      },
      {
        ingredientSlug: "milk",
        amount: 30,
        unit: "ml",
      },
      {
        ingredientSlug: "baby-cheese",
        amount: 20,
        unit: "g",
        prepNote: "1장",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "단호박은 찜기에 10분간 쪄서 우유 30ml를 넣고 부드러운 퓌레 상태로 으깹니다.",
        timerSeconds: 600,
      },
      {
        order: 2,
        instruction:
          "닭안심은 삶아 기름기와 힘줄을 제거한 뒤 결대로 잘게 찢고, 브로콜리는 데쳐 잘게 다집니다.",
      },
      {
        order: 3,
        instruction:
          "내열 용기 바닥에 단호박 퓌레를 깔고, 그 위에 닭안심과 브로콜리를 골고루 얹습니다.",
      },
      {
        order: 4,
        instruction:
          "아기치즈를 잘게 찢어 맨 위에 덮은 뒤 전자레인지에 1분간 돌려 치즈를 녹여 완성합니다.",
        timerSeconds: 60,
      },
    ],
    babyTips: {
      textureTip: "크림소스 대신 단호박과 우유로 건강하고 달콤한 베이스를 완성합니다.",
      cuttingSizeTip: "닭안심은 손으로 가볍게 찢어 질기지 않게 해주세요.",
      seasoningTip: "단호박의 당도와 아기치즈의 부드러운 맛으로 무염 조리가 가능합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 10,
      reheatTip: "전자레인지 1분 데워 치즈가 부드러워지면 먹입니다.",
    },
    sources: [],
  },

  {
    slug: "beef-eggplant-rice-bowl",
    name: "소고기가지덮밥",
    summary: "가지를 푹 익혀 부드러운 식감을 살리고 소고기와 아기간장으로 풍미를 낸 영양 덮밥",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
      },
      {
        ingredientSlug: "beef-minced",
        amount: 40,
        unit: "g",
      },
      {
        ingredientSlug: "eggplant",
        amount: 50,
        unit: "g",
        prepNote: "껍질 일부 벗기고 5mm 썰기",
      },
      {
        ingredientSlug: "onion",
        amount: 25,
        unit: "g",
        prepNote: "다지기",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 3,
        unit: "ml",
      },
      {
        ingredientSlug: "sesame-oil",
        amount: 2,
        unit: "ml",
      },
      {
        ingredientSlug: "vegetable-broth",
        amount: 80,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "가지는 껍질을 군데군데 벗겨 질긴 식감을 줄이고 5mm 크기로 작게 깍둑썹니다.",
      },
      {
        order: 2,
        instruction:
          "팬에 참기름을 살짝 두르고 소고기와 양파를 볶다가 고기가 익으면 가지를 넣습니다.",
        timerSeconds: 150,
      },
      {
        order: 3,
        instruction:
          "채수 80ml와 아기간장을 붓고 뚜껑을 덮어 약불에서 가지가 나른해질 때까지 4분간 익힙니다.",
        timerSeconds: 240,
      },
      {
        order: 4,
        instruction: "따뜻한 밥 위에 가지 소고기 볶음을 듬뿍 얹어 비벼 먹입니다.",
      },
    ],
    babyTips: {
      textureTip: "가지는 푹 익히면 입안에서 살살 녹아 채소를 싫어하는 아이도 잘 먹습니다.",
      cuttingSizeTip: "가지 껍질이 질기다면 필러로 껍질을 전부 벗겨 조리하세요.",
      seasoningTip: "양파의 은은한 단맛과 아기간장의 조화로 밥 한 그릇을 뚝딱 비웁니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지 1분 데운 뒤 밥과 잘 섞어 먹입니다.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "편식 채소 가지 유아 조리법",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.93,
      },
    ],
  },

  {
    slug: "spanish-mackerel-teriyaki",
    name: "순살삼치사과간장구이",
    summary:
      "기름기 적고 살이 단단한 삼치살에 강판에 간 사과와 아기간장 소스를 곁들인 순한 생선구이",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "spanish-mackerel",
        amount: 70,
        unit: "g",
        prepNote: "순살 가시 완벽 확인",
        substituteSlug: "cod",
      },
      {
        ingredientSlug: "apple",
        amount: 30,
        unit: "g",
        prepNote: "강판에 곱게 갈기",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 4,
        unit: "ml",
      },
      {
        ingredientSlug: "canola-oil",
        amount: 2,
        unit: "ml",
      },
      {
        ingredientSlug: "water",
        amount: 30,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "순살 삼치는 키친타월로 물기를 닦고 잔가시 유무를 꼼꼼히 확인합니다.",
      },
      {
        order: 2,
        instruction: "볼에 간 사과, 아기간장, 물 30ml를 섞어 순한 사과간장 소스를 만듭니다.",
      },
      {
        order: 3,
        instruction: "팬에 식용유를 두르고 삼치를 올려 앞뒤로 노릇하게 3분간 굽습니다.",
        timerSeconds: 180,
      },
      {
        order: 4,
        instruction: "소스를 팬에 붓고 약불에서 생선살에 윤기가 돌도록 2분간 조려 완성합니다.",
        timerSeconds: 120,
      },
    ],
    babyTips: {
      textureTip: "삼치는 살이 단단하고 담백하여 생선 씹는 연습을 하는 3단계 아기에게 좋습니다.",
      cuttingSizeTip: "먹이기 전 포크로 살을 한입 크기로 떼어내어 가시를 한 번 더 체크하세요.",
      seasoningTip: "설탕 대신 강판에 간 사과의 자연 당분으로 은은한 단맛을 냅니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 10,
      reheatTip: "팬에 약불로 살짝 데우거나 전자레인지 40초 데워 먹입니다.",
    },
    sources: [
      {
        url: "https://www.foodsafetykorea.go.kr",
        title: "어린이 등푸른 생선 안전 조리 지침",
        channelOrSite: "식품의약품안전처 식품안전나라",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.94,
      },
    ],
  },

  {
    slug: "white-kimchi-perilla-fried-rice",
    name: "백김치들기름볶음밥",
    summary: "양념을 씻어내어 자극이 없는 배추와 소고기를 들기름에 달달 볶아낸 구수한 볶음밥",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "white-rice-cooked",
        amount: 160,
        unit: "g",
      },
      {
        ingredientSlug: "napa-cabbage",
        amount: 50,
        unit: "g",
        prepNote: "물에 씻어 짠기 뺀 후 5mm 다지기",
      },
      {
        ingredientSlug: "beef-minced",
        amount: 35,
        unit: "g",
      },
      {
        ingredientSlug: "perilla-oil",
        amount: 4,
        unit: "ml",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 2,
        unit: "ml",
      },
      {
        ingredientSlug: "sesame-powder",
        amount: 2,
        unit: "g",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "배추는 물에 가볍게 헹궈 짠기를 빼고 5mm 크기로 잘게 다집니다.",
      },
      {
        order: 2,
        instruction:
          "팬에 들기름을 두르고 다진 소고기와 배추를 넣어 소고기가 익을 때까지 중불에서 볶습니다.",
        timerSeconds: 150,
      },
      {
        order: 3,
        instruction: "따뜻한 밥과 아기간장을 넣고 주걱을 세워 밥알이 뭉치지 않게 골고루 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 4,
        instruction: "불을 끄고 깨가루를 솔솔 뿌려 구수한 향을 살립니다.",
      },
    ],
    babyTips: {
      textureTip: "배추의 아삭한 식감과 들기름의 고소함이 어우러져 씹는 즐거움을 줍니다.",
      cuttingSizeTip: "두 돌 이후 아기는 배추를 5~7mm 크기로 썰어 씹는 맛을 살려줍니다.",
      seasoningTip: "들기름의 고소한 향미 덕분에 최소한의 간장으로도 훌륭한 맛이 납니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "팬에 물 1큰술을 두르고 살짝 볶아 데우면 갓 지은 밥처럼 촉촉해집니다.",
    },
    sources: [],
  },

  {
    slug: "beef-tenderloin-chop-steak",
    name: "아기안심찹스테이크",
    summary: "입에서 살살 녹는 부드러운 소고기안심과 달콤한 파프리카를 저염케첩에 볶은 특식",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    difficulty: 2,
    tools: ["프라이팬"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "beef-tenderloin",
        amount: 70,
        unit: "g",
        prepNote: "1.5cm 깍둑썰기",
        substituteSlug: "pork-tenderloin",
      },
      {
        ingredientSlug: "paprika",
        amount: 30,
        unit: "g",
        prepNote: "1cm 깍둑썰기",
      },
      {
        ingredientSlug: "onion",
        amount: 25,
        unit: "g",
        prepNote: "1cm 썰기",
      },
      {
        ingredientSlug: "button-mushroom",
        amount: 20,
        unit: "g",
        prepNote: "납작하게 썰기",
        substituteSlug: "king-oyster-mushroom",
      },
      {
        ingredientSlug: "ketchup-reduced",
        amount: 15,
        unit: "g",
        prepNote: "저당저염케첩 1큰술",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 2.5,
        unit: "ml",
      },
      {
        ingredientSlug: "olive-oil",
        amount: 4,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "소고기 안심은 핏물을 제거하고 1.5cm 크기로 깍둑썰며, 채소들도 비슷한 크기로 썹니다.",
      },
      {
        order: 2,
        instruction:
          "팬에 올리브유를 두르고 소고기 안심을 올려 센불에서 겉면을 빠르게 구워 육즙을 가둡니다.",
        timerSeconds: 90,
      },
      {
        order: 3,
        instruction:
          "양파, 파프리카, 양송이버섯을 넣고 중불에서 채소가 부드러워질 때까지 2분간 볶습니다.",
        timerSeconds: 120,
      },
      {
        order: 4,
        instruction:
          "저염케첩과 아기간장을 넣고 골고루 섞으며 소스가 윤기나게 배어들면 완성합니다.",
        timerSeconds: 60,
      },
    ],
    babyTips: {
      textureTip: "안심 부위는 결이 곱고 부드러워 3단계 아기들이 질겨하지 않고 잘 씹어 삼킵니다.",
      cuttingSizeTip: "아기가 한입에 쏙 넣어 어금니로 씹을 수 있는 1.5cm 크기가 이상적입니다.",
      seasoningTip: "저당·저염 케첩과 채소 본연의 단맛을 활용해 자극 없는 경양식 특식을 만듭니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 7,
      reheatTip: "전자레인지 1분 데운 뒤 고기 속 온도를 확인하여 먹입니다.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "어린이 성장기 육류 조리 및 영양 가이드",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },

  {
    slug: "perilla-potato-rice-sujebi",
    name: "들깨감자쌀수제비",
    summary: "쌀가루와 감자전분으로 반죽하여 목넘김이 부드럽고 구수한 멸치들깨 수제비",
    category: "MEAL",
    mealCategories: ["LUNCH", "DINNER"],
    ageStages: [3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["냄비", "볼"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "rice-flour",
        amount: 50,
        unit: "g",
      },
      {
        ingredientSlug: "starch-potato",
        amount: 15,
        unit: "g",
      },
      {
        ingredientSlug: "potato",
        amount: 40,
        unit: "g",
        prepNote: "얇게 나박썰기",
      },
      {
        ingredientSlug: "zucchini",
        amount: 30,
        unit: "g",
        prepNote: "반달썰기",
      },
      {
        ingredientSlug: "perilla-seed-powder",
        amount: 8,
        unit: "g",
      },
      {
        ingredientSlug: "anchovy-broth",
        amount: 250,
        unit: "ml",
      },
      {
        ingredientSlug: "baby-soy-sauce",
        amount: 2.5,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "볼에 쌀가루, 감자전분, 따뜻한 물 4큰술을 넣고 손으로 치대어 말랑한 반죽을 만듭니다.",
      },
      {
        order: 2,
        instruction: "냄비에 멸치육수를 붓고 끓으면 얇게 썬 감자와 애호박을 넣고 끓입니다.",
        timerSeconds: 240,
      },
      {
        order: 3,
        instruction:
          "반죽을 아기 한입 크기로 아주 얇게 떼어 국물에 넣고 수제비가 동동 뜰 때까지 익힙니다.",
        timerSeconds: 180,
      },
      {
        order: 4,
        instruction:
          "아기간장 0.5작은술과 들깨가루를 넣고 한소끔 끓여 걸쭉하고 구수하게 완성합니다.",
        timerSeconds: 60,
      },
    ],
    babyTips: {
      textureTip: "밀가루 대신 쌀가루와 전분으로 빚어 쫄깃하기보다는 부드럽고 소화가 편합니다.",
      cuttingSizeTip: "질식 위험을 막기 위해 수제비는 반드시 종잇장처럼 얇게 떼어 넣어야 합니다.",
      seasoningTip: "진한 멸치육수와 들깨가루의 구수한 맛으로 최소한의 간만 합니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 0,
      reheatTip: "수제비는 붇기 쉬우므로 즉시 조리해 먹는 것을 추천합니다.",
    },
    sources: [],
  },

  {
    slug: "apple-banana-mash",
    name: "사과바나나매시",
    summary: "살짝 쪄서 소화가 편한 사과와 완숙 바나나를 포크로 으깬 천연 달콤 영양 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2],
    saltLevel: "NONE",
    cookMinutes: 10,
    difficulty: 1,
    tools: ["찜기", "볼"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "apple",
        amount: 60,
        unit: "g",
        prepNote: "껍질·씨 제거 후 얇게 썰기",
      },
      {
        ingredientSlug: "banana",
        amount: 60,
        unit: "g",
        prepNote: "완숙 바나나",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "사과는 껍질과 씨를 제거하고 얇게 썰어 찜기에 5분간 쪄서 부드럽게 익힙니다.",
        timerSeconds: 300,
      },
      {
        order: 2,
        instruction: "볼에 찐 사과와 완숙 바나나를 넣고 포크로 곱게 으깹니다.",
      },
      {
        order: 3,
        instruction: "아기의 삼킴 상태에 맞추어 농도를 조절한 뒤 그릇에 담아 완성합니다.",
      },
    ],
    babyTips: {
      textureTip: "사과를 살짝 찌면 산미가 날아가고 펙틴이 부드러워져 아기 위에 부담이 없습니다.",
      cuttingSizeTip: "완료기 아기에게는 덩어리 없이 부드러운 퓌레 형태로 먹입니다.",
      seasoningTip: "과일 본연의 과당만으로 충분히 달콤합니다.",
    },
    storageInfo: {
      fridgeDays: 1,
      freezerDays: 7,
      reheatTip: "냉장 보관한 것은 찬기를 살짝 빼고 상온 상태에서 먹입니다.",
    },
    sources: [
      {
        url: "https://www.childcare.go.kr",
        title: "영유아 과일 조리 및 소화 흡수 가이드",
        channelOrSite: "보건복지부 아이사랑",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.95,
      },
    ],
  },

  {
    slug: "sweet-potato-cheese-stick",
    name: "고구마아기치즈스틱",
    summary: "포슬포슬 삶은 고구마에 아기치즈를 섞어 손에 쥐고 먹기 좋게 구운 핑거푸드",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["에어프라이어", "오븐"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "sweet-potato",
        amount: 120,
        unit: "g",
        prepNote: "삶아서 따뜻할 때 으깨기",
      },
      {
        ingredientSlug: "baby-cheese",
        amount: 20,
        unit: "g",
        prepNote: "1장 잘게 찢기",
      },
      {
        ingredientSlug: "rice-flour",
        amount: 10,
        unit: "g",
        prepNote: "성형용",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "고구마는 푹 삶아 껍질을 벗긴 뒤 따뜻할 때 볼에 넣고 으깹니다.",
      },
      {
        order: 2,
        instruction: "으깬 고구마에 아기치즈와 쌀가루를 넣고 찰기가 생기도록 고루 섞어 반죽합니다.",
      },
      {
        order: 3,
        instruction: "반죽을 손가락 굵기(길이 5cm, 두께 1cm) 스틱 모양으로 길쭉하게 빚습니다.",
      },
      {
        order: 4,
        instruction: "에어프라이어 170도에서 10분간 구워 겉면을 살짝 단단하게 완성합니다.",
        timerSeconds: 600,
      },
    ],
    babyTips: {
      textureTip: "겉은 손에 묻지 않고 속은 부드러워 소근육 발달과 씹기 연습에 탁월합니다.",
      cuttingSizeTip: "손에 쥐기 편한 길이 5cm 스틱형태가 가장 좋습니다.",
      seasoningTip: "고구마의 단맛과 아기치즈의 짭조름한 풍미만으로 충분합니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "에어프라이어 160도에 2분간 살짝 돌리면 겉바속촉이 복원됩니다.",
    },
    sources: [
      {
        url: "https://www.seoulnutri.co.kr",
        title: "영유아 자기주도 핑거푸드 간식 레시피",
        channelOrSite: "서울시 식생활종합지원센터",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.92,
      },
    ],
  },

  {
    slug: "sweet-pumpkin-rice-cake",
    name: "단호박쌀찜케이크",
    summary: "밀가루 없이 쌀가루와 단호박, 우유로 전자레인지나 찜기에서 쪄낸 폭신폭신한 간식",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    difficulty: 1,
    tools: ["찜기", "전자레인지"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "rice-flour",
        amount: 60,
        unit: "g",
      },
      {
        ingredientSlug: "sweet-pumpkin",
        amount: 60,
        unit: "g",
        prepNote: "쪄서 곱게 으깬 것",
      },
      {
        ingredientSlug: "egg",
        amount: 50,
        unit: "g",
        prepNote: "신선한 달걀 1개",
      },
      {
        ingredientSlug: "milk",
        amount: 40,
        unit: "ml",
        substituteSlug: "soy-milk-unsweetened",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "볼에 달걀을 풀고 찐 단호박 퓌레와 우유 40ml를 넣어 거품기로 고루 섞습니다.",
      },
      {
        order: 2,
        instruction:
          "쌀가루를 체 쳐 넣고 가루가 보이지 않을 때까지 주걱으로 골고루 저어 반죽을 만듭니다.",
      },
      {
        order: 3,
        instruction: "전자레인지용 실리콘 머핀 틀에 반죽을 70% 정도 채웁니다.",
      },
      {
        order: 4,
        instruction:
          "전자레인지에 2분 30초간 돌려 꼬치로 찔렀을 때 반죽이 묻어나오지 않으면 완성합니다.",
        timerSeconds: 150,
      },
    ],
    babyTips: {
      textureTip: "오븐에 굽지 않고 찌듯이 익혀 빵 껍질 없이 전체가 보들보들합니다.",
      cuttingSizeTip: "한입 크기로 깍둑썰어 주면 아기가 포크로 콕콕 찍어먹기 좋습니다.",
      seasoningTip: "단호박의 당도로 설탕이나 베이킹파우더 없이 순하게 부풀립니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 14,
      reheatTip: "전자레인지에 30초 데워 따끈하게 먹입니다.",
    },
    sources: [
      {
        url: "https://koreanfood.rda.go.kr",
        title: "노밀가루 쌀가루 유아 베이킹 가이드",
        channelOrSite: "농촌진흥청 농식품올바로",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.93,
      },
    ],
  },

  {
    slug: "tofu-black-sesame-cookie",
    name: "두부검은깨쿠키",
    summary: "물기 뺀 두부와 고소한 검은깨가루, 쌀가루로 구워 기름기 없이 담백한 아기 쿠키",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    difficulty: 2,
    tools: ["오븐", "에어프라이어"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "tofu",
        amount: 80,
        unit: "g",
        prepNote: "면포로 물기 꽉 짜기",
      },
      {
        ingredientSlug: "rice-flour",
        amount: 50,
        unit: "g",
      },
      {
        ingredientSlug: "black-sesame-powder",
        amount: 8,
        unit: "g",
        prepNote: "곱게 간 검은깨가루",
        substituteSlug: "sesame-powder",
      },
      {
        ingredientSlug: "banana",
        amount: 25,
        unit: "g",
        prepNote: "완숙 바나나 으깨어 자연 단맛 내기",
      },
    ],
    steps: [
      {
        order: 1,
        instruction:
          "두부는 면포에 싸서 무거운 것을 올려두거나 손으로 꽉 짜서 물기를 최대한 제거합니다.",
      },
      {
        order: 2,
        instruction:
          "물기 뺀 두부를 손으로 곱게 으깬 뒤 쌀가루, 검은깨가루, 올리고당을 넣고 반죽합니다.",
      },
      {
        order: 3,
        instruction:
          "반죽을 5mm 두께로 얇게 밀고 아기 한입 크기 모양 틀로 찍거나 동글납작하게 빚습니다.",
      },
      {
        order: 4,
        instruction: "에어프라이어 160도에서 12분간 바삭하게 구워 식힌 뒤 완성합니다.",
        timerSeconds: 720,
      },
    ],
    babyTips: {
      textureTip: "버터나 기름이 전혀 들어가지 않아 담백하고 검은깨의 고소함이 풍부합니다.",
      cuttingSizeTip: "두께 5mm 정도로 얇게 구워 아기 앞니로 바사삭 베어 물기 좋습니다.",
      seasoningTip: "식물성 단백질과 불포화지방산을 채워주는 영양 만점 간식입니다.",
    },
    storageInfo: {
      fridgeDays: 3,
      freezerDays: 14,
      reheatTip: "밀폐용기에 실리카겔과 함께 보관하면 바삭함이 유지됩니다.",
    },
    sources: [],
  },

  {
    slug: "apple-carrot-jelly",
    name: "사과당근말랑젤리",
    summary: "사과와 당근의 착즙액에 감자전분을 풀어 말랑말랑하게 굳힌 무설탕 과채 젤리",
    category: "SNACK",
    mealCategories: ["SNACK"],
    ageStages: [3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    difficulty: 1,
    tools: ["냄비", "유리용기"],
    baseServings: 2,
    ingredients: [
      {
        ingredientSlug: "apple",
        amount: 80,
        unit: "g",
        prepNote: "강판에 갈아 면포로 맑은 즙 내기",
      },
      {
        ingredientSlug: "carrot",
        amount: 40,
        unit: "g",
        prepNote: "강판에 갈아 면포로 맑은 즙 내기",
      },
      {
        ingredientSlug: "starch-potato",
        amount: 12,
        unit: "g",
        prepNote: "말랑한 묵 형태 응고제",
      },
      {
        ingredientSlug: "water",
        amount: 60,
        unit: "ml",
      },
    ],
    steps: [
      {
        order: 1,
        instruction: "사과와 당근은 강판에 갈아 면포로 즙을 짜서 총 100ml의 과채즙을 만듭니다.",
      },
      {
        order: 2,
        instruction:
          "냄비에 과채즙, 물 60ml, 감자전분을 넣고 거품기로 가루가 뭉치지 않게 잘 풉니다.",
      },
      {
        order: 3,
        instruction:
          "약불에 올려 주걱으로 쉬지 않고 저어가며 투명하고 끈적한 풀 상태가 될 때까지 끓입니다.",
        timerSeconds: 180,
      },
      {
        order: 4,
        instruction: "유리 용기에 붓고 냉장고에서 30분간 굳힌 뒤 1cm 큐브 크기로 썰어 완성합니다.",
        timerSeconds: 1800,
      },
    ],
    babyTips: {
      textureTip:
        "시판 젤리처럼 질기거나 미끄러운 젤라틴 대신 전분으로 굳혀 목에 걸리지 않고 사르르 녹습니다.",
      cuttingSizeTip: "아기가 한입에 먹기 좋은 1cm 큐브 크기로 썰어주세요.",
      seasoningTip:
        "사과와 당근 자체의 달콤한 즙으로 설탕이나 색소 없이 곱고 화사한 주황빛 젤리가 완성됩니다.",
    },
    storageInfo: {
      fridgeDays: 2,
      freezerDays: 0,
      reheatTip: "냉동하면 식감이 파괴되므로 반드시 냉장 보관하여 시원하게 먹입니다.",
    },
    sources: [
      {
        url: "https://health.kdca.go.kr",
        title: "영유아 젤리류 질식 사고 예방 및 대체 조리법",
        channelOrSite: "질병관리청 국가건강정보포털",
        sourceType: "PUBLIC_INSTITUTION",
        trustScore: 0.96,
      },
    ],
  },
];

export const SEED_RECIPES: SeedRecipeItem[] = [...CORE_SEED_RECIPES, ...EXPANDED_RECIPES];
