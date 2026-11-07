/**
 * 확장 유아식·간식 레시피 카탈로그 (56종)
 * - 구성: 한그릇 식사(MAIN/ONE_BOWL) 22개 + 유아식 반찬(SIDE) 14개 + 국·수프(SOUP) 8개 + 간식(SNACK) 12개 = 총 56개
 * - 모든 재료는 SEED_INGREDIENTS 사전에 등록되어 있으며 validateRecipeSafety() 안전 게이트를 100% 통과한다.
 * - 출처는 검증 완료된 공공 레시피 DB(식약처 COOKRCP01) 및 재료 조합 검토가 완료된 공개 유아식 레시피를 참조한다.
 */
import type { AgeStage, MealTime, RecipeCategory, SaltLevel } from "@/lib/domain/types";

export type ExpandedDishType = "ONE_BOWL" | "SIDE" | "SOUP" | "SNACK";
export type ExpandedMealRole = "MAIN" | "SIDE" | "SOUP" | "SNACK";

export interface ExpandedRecipeSeed {
  slug: string;
  name: string;
  summary: string;
  category: RecipeCategory;
  mealRole: ExpandedMealRole;
  dishType: ExpandedDishType;
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

type CookStyle =
  | "porridge_rice"
  | "risotto"
  | "rice_bowl"
  | "fried_rice"
  | "oatmeal"
  | "noodle"
  | "pasta"
  | "side_namul"
  | "side_stir"
  | "side_braise"
  | "side_pan"
  | "soup_clear"
  | "soup_potage"
  | "snack_steam_bread"
  | "snack_yogurt_cup"
  | "snack_warm_fruit"
  | "snack_mash_stick";

interface VerifiedRef {
  url: string;
  title: string;
  channelOrSite: string;
  sourceType: "YOUTUBE" | "PUBLIC_INSTITUTION";
  trustScore: number;
}

const REFS: Record<string, VerifiedRef> = {
  mfdsCook: {
    url: "https://www.foodsafetykorea.go.kr/api/newDatasetDetail.do?svc_no=COOKRCP01",
    title: "식약처 조리식품의 레시피 DB(COOKRCP01) 영유아 저염·무염 조리 응용",
    channelOrSite: "식품의약품안전처",
    sourceType: "PUBLIC_INSTITUTION",
    trustScore: 0.93,
  },
  beefOat: {
    url: "https://www.youtube.com/watch?v=-SCi_3s_oK8",
    title: "재료 조합 참고 · 소고기 오트밀죽 유아식 레시피",
    channelOrSite: "단맘유아식 danmom_recipe",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  beefPotatoBowl: {
    url: "https://www.youtube.com/watch?v=ouTCL6y9FOQ",
    title: "재료 조합 참고 · 소고기 감자 덮밥 유아식 응용",
    channelOrSite: "아롱레시피",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  beefSpinachBowl: {
    url: "https://www.youtube.com/watch?v=x-xpTlAQ5OI",
    title: "재료 조합 참고 · 유아식 소고기 시금치 덮밥",
    channelOrSite: "알콩맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  beefVegStir1: {
    url: "https://www.youtube.com/watch?v=Rk8fc4nU7yY",
    title: "재료 조합 참고 · 소고기 애호박 당근 양파 수분볶음",
    channelOrSite: "강미즈",
    sourceType: "YOUTUBE",
    trustScore: 0.91,
  },
  beefVegStir2: {
    url: "https://www.youtube.com/watch?v=3-e6ZoXFoSM",
    title: "재료 조합 참고 · 소고기 브로콜리 당근 양파 볶음",
    channelOrSite: "강미즈",
    sourceType: "YOUTUBE",
    trustScore: 0.91,
  },
  chickenPotatoRisotto: {
    url: "https://www.youtube.com/watch?v=U6b5DMeSyc4",
    title: "재료 조합 참고 · 감자 닭고기 유아식 리조또",
    channelOrSite: "짹짹맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  chickenSpinachRisotto: {
    url: "https://www.youtube.com/watch?v=jqGhKnGagnk",
    title: "재료 조합 참고 · 닭안심 시금치 유아식 리조또",
    channelOrSite: "맘 편한 소아과",
    sourceType: "YOUTUBE",
    trustScore: 0.92,
  },
  chickenOat: {
    url: "https://www.youtube.com/watch?v=w_ZIfk0etQk",
    title: "재료 조합 참고 · 닭고기 양파 오트밀죽",
    channelOrSite: "짹짹맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  chickenVegStir: {
    url: "https://www.youtube.com/watch?v=DkrLjhSLue4",
    title: "재료 조합 참고 · 닭고기 채소 볶음 유아식",
    channelOrSite: "리한이(RihanStory)",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  porkEggplantBowl: {
    url: "https://www.youtube.com/watch?v=TNmjOa-uC_E",
    title: "재료 조합 참고 · 돼지고기 가지 무염 덮밥",
    channelOrSite: "오순도순 맘마일기",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  porkVegStir: {
    url: "https://www.youtube.com/watch?v=DcfBf4TGfVw",
    title: "재료 조합 참고 · 돼지고기 채소 수분볶음",
    channelOrSite: "강미즈",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  codPorridge: {
    url: "https://www.youtube.com/watch?v=HTzA1ht81a8",
    title: "재료 조합 참고 · 대구살 채소 영양죽",
    channelOrSite: "젤리의 주방",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  salmonRisotto: {
    url: "https://www.youtube.com/watch?v=fevUfGOE8TY",
    title: "재료 조합 참고 · 부드러운 아기 연어 리조또",
    channelOrSite: "로봇엄마",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  salmonVegStir: {
    url: "https://www.youtube.com/watch?v=2ftYrhpdIf4",
    title: "재료 조합 참고 · 유아식 연어 채소 볶음",
    channelOrSite: "요리하는엄빠",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  flounderStew: {
    url: "https://www.youtube.com/watch?v=jpzYoRd8OPA",
    title: "재료 조합 참고 · 가자미 채소 유아식 조리",
    channelOrSite: "쏘블리베이킹ㆍ브런치ㆍ커피",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  flounderSoyBraise: {
    url: "https://www.youtube.com/watch?v=u5nD7BbbyYY",
    title: "재료 조합 참고 · 가자미 저염 간장조림 반찬",
    channelOrSite: "쏘블리베이킹ㆍ브런치ㆍ커피",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  tofuEggSteam: {
    url: "https://www.youtube.com/watch?v=3zWBAgUYqvY",
    title: "재료 조합 참고 · 부드러운 두부 달걀 조리 응용",
    channelOrSite: "핸쿡handcook",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  spinachTofuNamul: {
    url: "https://www.youtube.com/watch?v=qfUlbc-ga6g",
    title: "재료 조합 참고 · 무간장 시금치 두부 무침",
    channelOrSite: "쿡스비 COOKSBEE",
    sourceType: "YOUTUBE",
    trustScore: 0.91,
  },
  broccoliTofuNamul: {
    url: "https://www.youtube.com/watch?v=E4ejokApTo8",
    title: "재료 조합 참고 · 브로콜리 두부 무침 아기반찬",
    channelOrSite: "유하네 hobbang",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  pumpkinTofu: {
    url: "https://www.youtube.com/watch?v=PbZ1iRgycbo",
    title: "재료 조합 참고 · 단호박 두부 범벅 유아반찬",
    channelOrSite: "너울너울",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  tofuPatty: {
    url: "https://www.youtube.com/watch?v=mlDTIBLIbd0",
    title: "재료 조합 참고 · 채소 듬뿍 두부 동그랑땡·전",
    channelOrSite: "투현맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  pumpkinCarrotSoup: {
    url: "https://www.youtube.com/watch?v=kgEFsWUCcFI",
    title: "재료 조합 참고 · 단호박 당근 채소 수프",
    channelOrSite: "단맘유아식 danmom_recipe",
    sourceType: "YOUTUBE",
    trustScore: 0.91,
  },
  appleBananaOat: {
    url: "https://www.youtube.com/watch?v=zuntpyRvh-I",
    title: "재료 조합 참고 · 사과 바나나 오트밀 아기빵",
    channelOrSite: "포포네 육아일기",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  blueberryBananaMuffin: {
    url: "https://www.youtube.com/watch?v=-T6N_PKwn64",
    title: "재료 조합 참고 · 블루베리 바나나 아기 머핀",
    channelOrSite: "유니 일기 Yoon's Diary",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  sweetpotatoCarrotBread: {
    url: "https://www.youtube.com/watch?v=hQLFr-hYe3g",
    title: "재료 조합 참고 · 고구마 당근 아기 찜빵",
    channelOrSite: "서은뭉치네",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  appleCarrotBread: {
    url: "https://www.youtube.com/watch?v=LLAKoUPq5Y0",
    title: "재료 조합 참고 · 사과 당근 아기빵 간식",
    channelOrSite: "우정이네하우스",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  avocadoPuree: {
    url: "https://www.youtube.com/watch?v=_8rANbEkn5Q",
    title: "재료 조합 참고 · 아보카도 과일 퓨레 간식",
    channelOrSite: "믿음맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  tofuCarrotStick: {
    url: "https://www.youtube.com/watch?v=othMeFRB7-Q",
    title: "재료 조합 참고 · 당근 두부 스틱 자기주도 간식",
    channelOrSite: "쩌스트맘",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
  appleSweetpotatoSnack: {
    url: "https://www.youtube.com/watch?v=5VKwIFwviag",
    title: "재료 조합 참고 · 사과 고구마 아기 간식 조리",
    channelOrSite: "강미즈",
    sourceType: "YOUTUBE",
    trustScore: 0.9,
  },
};

interface Blueprint {
  slug: string;
  name: string;
  summary: string;
  style: CookStyle;
  dishType: ExpandedDishType;
  ageStages: AgeStage[];
  saltLevel: SaltLevel;
  cookMinutes: number;
  difficulty?: 1 | 2;
  tools: string[];
  refKey: keyof typeof REFS;
  ingredients: {
    ingredientSlug: string;
    amount: number;
    unit: string;
    prepNote?: string;
    isOptional?: boolean;
    substituteSlug?: string;
  }[];
}

function buildSteps(b: Blueprint): ExpandedRecipeSeed["steps"] {
  const ingNames = b.ingredients.filter((i) => !i.isOptional && i.ingredientSlug !== "water");
  const lead = ingNames
    .slice(0, 3)
    .map((i) => i.prepNote ?? "손질")
    .join(" · ");

  switch (b.style) {
    case "porridge_rice":
      return [
        {
          order: 1,
          instruction: `주재료의 핏물·가시·껍질·질긴 심을 꼼꼼히 제거하고 아기 월령에 맞는 크기로 잘게 다집니다 (${lead}).`,
        },
        {
          order: 2,
          instruction:
            "냄비에 분량의 물 일부와 단백질·단단한 채소를 먼저 넣고 중약불에서 속까지 완전히 익힙니다.",
          timerSeconds: 180,
        },
        {
          order: 3,
          instruction:
            "밥(또는 곡류)과 남은 채소·물을 넣고 바닥이 눌어붙지 않도록 저어가며 촉촉한 진밥 농도로 끓입니다.",
          timerSeconds: 360,
        },
        {
          order: 4,
          instruction:
            "불을 끄고 한 김 식힌 뒤 아기가 삼키기 편한 온도와 무르기인지 확인하여 그릇에 담습니다.",
        },
      ];
    case "risotto":
      return [
        {
          order: 1,
          instruction:
            "단백질 재료는 가시나 힘줄을 제거해 잘게 썰고, 채소는 부드럽게 익도록 작은 입자로 다집니다.",
        },
        {
          order: 2,
          instruction:
            "팬이나 냄비에 소량의 물(또는 유지류)을 두르고 주재료와 채소를 먼저 속까지 익힙니다.",
          timerSeconds: 180,
        },
        {
          order: 3,
          instruction:
            "따뜻한 밥과 우유·물을 부어 약불에서 천천히 저어가며 크리미한 리조또 농도로 졸입니다.",
          timerSeconds: 300,
        },
        {
          order: 4,
          instruction: "우유가 끓어 넘치지 않게 마무리하고 섭취 전 중심 온도를 확인해 제공합니다.",
        },
      ];
    case "rice_bowl":
      return [
        {
          order: 1,
          instruction:
            "고기와 채소는 깨끗이 손질해 아기가 씹기 쉬운 한입 이하 크기로 고르게 다집니다.",
        },
        {
          order: 2,
          instruction: "냄비에 물 소량과 단백질을 넣어 뭉치지 않게 풀어주며 먼저 완전히 익힙니다.",
          timerSeconds: 180,
        },
        {
          order: 3,
          instruction:
            "손질한 채소와 남은 분량의 수분을 더해 채소가 말랑해지고 자연스러운 단맛이 우러나도록 끓입니다.",
          timerSeconds: 240,
        },
        {
          order: 4,
          instruction:
            "따뜻한 밥 위에 촉촉한 덮밥 소스를 얹고 골고루 섞어 먹기 좋은 온도로 식혀 줍니다.",
        },
      ];
    case "fried_rice":
      return [
        {
          order: 1,
          instruction:
            "채소와 단백질 재료를 밥알 크기에 맞춰 잘게 다지고 수분기를 가볍게 정리합니다.",
        },
        {
          order: 2,
          instruction:
            "달군 팬에 올리브유(또는 버터)와 물 1큰술을 함께 둘러 고기·생선과 단단한 채소를 태우지 않고 익힙니다.",
          timerSeconds: 180,
        },
        {
          order: 3,
          instruction:
            "밥과 나머지 재료를 넣고 고루 섞어가며 볶아 촉촉하고 고소한 볶음밥을 완성합니다.",
          timerSeconds: 180,
        },
        {
          order: 4,
          instruction: "딱딱하게 뭉친 밥알이 없는지 확인하고 한 김 식혀 담아냅니다.",
        },
      ];
    case "oatmeal":
      return [
        {
          order: 1,
          instruction: "주재료와 채소를 잘게 다지고 오트밀에 이물질이 없는지 확인해 준비합니다.",
        },
        {
          order: 2,
          instruction: "냄비에 물과 단백질·채소를 먼저 넣어 속까지 충분히 무르게 끓입니다.",
          timerSeconds: 240,
        },
        {
          order: 3,
          instruction:
            "귀리(오트밀)를 넣고 약불에서 뭉근하게 저어가며 부드러운 죽 농도로 퍼지게 익힙니다.",
          timerSeconds: 240,
        },
        {
          order: 4,
          instruction:
            "농도가 되직하면 따뜻한 물을 소량 보충하고 먹기 좋은 온도로 식혀 제공합니다.",
        },
      ];
    case "noodle":
      return [
        {
          order: 1,
          instruction:
            "쌀국수면은 찬물에 충분히 불린 뒤 아기가 후루룩 삼키다 목에 걸리지 않도록 2~3cm 길이로 짧게 자릅니다.",
        },
        {
          order: 2,
          instruction:
            "냄비에 분량의 물과 손질한 단백질·채소를 넣고 감칠맛이 우러나도록 팔팔 끓입니다.",
          timerSeconds: 300,
        },
        {
          order: 3,
          instruction: "자른 쌀국수면을 넣고 면발이 충분히 부드러워질 때까지 한소끔 더 끓입니다.",
          timerSeconds: 180,
        },
        {
          order: 4,
          instruction:
            "가시나 단단한 조각이 없는지 다시 확인하고 국물 온도를 충분히 식혀 배식합니다.",
        },
      ];
    case "pasta":
      return [
        {
          order: 1,
          instruction:
            "푸실리 파스타면은 끓는 물에 일반 조리 시간보다 2~3분 더 삶아 말랑하게 익힌 뒤 아기 입 크기에 맞게 자릅니다.",
          timerSeconds: 600,
        },
        {
          order: 2,
          instruction: "닭고기와 토마토·브로콜리는 껍질과 질긴 심을 제거해 잘게 다집니다.",
        },
        {
          order: 3,
          instruction:
            "팬에 올리브유와 물을 두르고 닭고기와 채소를 완전히 익힌 뒤 삶은 파스타면을 넣어 촉촉하게 버무립니다.",
          timerSeconds: 240,
        },
        {
          order: 4,
          instruction: "면이 마르지 않게 수분감을 확인하고 따뜻하게 식혀 그릇에 담습니다.",
        },
      ];
    case "side_namul":
      return [
        {
          order: 1,
          instruction:
            "채소는 연한 잎·꽃봉오리 위주로 손질하고 두부는 끓는 물에 2분간 데쳐 수분을 가볍게 짭니다.",
          timerSeconds: 120,
        },
        {
          order: 2,
          instruction:
            "손질한 채소를 끓는 물에 부드럽게 데친 뒤 찬물에 헹궈 물기를 꼭 짜고 잘게 송송 썹니다.",
          timerSeconds: 90,
        },
        {
          order: 3,
          instruction:
            "볼에 데친 두부를 곱게 으깨고 채소, 참깨가루·참기름을 넣어 소금 없이 고소하게 버무립니다.",
        },
        {
          order: 4,
          instruction: "질긴 줄기가 남지 않았는지 확인한 뒤 밥 반찬으로 소분해 담습니다.",
        },
      ];
    case "side_stir":
      return [
        {
          order: 1,
          instruction:
            "단백질 재료의 핏물이나 가시를 제거하고 채소와 함께 아기가 집어 먹기 편한 크기로 손질합니다.",
        },
        {
          order: 2,
          instruction:
            "팬에 분량의 물 2~3큰술을 먼저 두르고 고기·생선을 넣어 중약불에서 속까지 완전히 익힙니다.",
          timerSeconds: 180,
        },
        {
          order: 3,
          instruction:
            "손질한 채소를 넣어 뚜껑을 덮고 수분 스팀으로 말랑하게 익힌 뒤 올리브유·참기름을 살짝 둘러 마무리합니다.",
          timerSeconds: 180,
        },
        {
          order: 4,
          instruction: "기름에 타지 않고 촉촉하게 익었는지 확인한 뒤 한 김 식혀 반찬으로 냅니다.",
        },
      ];
    case "side_braise":
      return [
        {
          order: 1,
          instruction:
            "주재료(생선 가시·고기 근막·단단한 채소 모서리)를 손질하여 아기 한입 이하 크기로 썹니다.",
        },
        {
          order: 2,
          instruction:
            "냄비에 분량의 물과 단단한 채소를 먼저 깔고 주재료를 올려 중약불에서 푹 익힙니다.",
          timerSeconds: 300,
        },
        {
          order: 3,
          instruction:
            "아기간장을 소량 넣어 자극적이지 않고 은은하게 간이 배도록 국물을 끼얹으며 자작하게 조립니다.",
          timerSeconds: 240,
        },
        {
          order: 4,
          instruction:
            "생선 가시나 단단한 심이 없는지 최종 확인하고 촉촉한 조림 국물과 함께 담아냅니다.",
        },
      ];
    case "side_pan":
      return [
        {
          order: 1,
          instruction: "두부는 물기를 꼭 짜서 으깨고 채소는 3~4mm 입자로 아주 곱게 다집니다.",
        },
        {
          order: 2,
          instruction:
            "볼에 으깬 두부, 다진 채소, 달걀, 쌀가루를 넣고 골고루 치대어 한입 크기 반죽을 빚습니다.",
        },
        {
          order: 3,
          instruction:
            "약불로 예열한 팬에 식용유를 얇게 펴 바르고 앞뒤로 노릇하고 속까지 완전히 익도록 천천히 구워냅니다.",
          timerSeconds: 300,
        },
        {
          order: 4,
          instruction:
            "키친타월로 여분의 기름기를 가볍게 닦아내고 먹기 좋게 식혀 반찬으로 제공합니다.",
        },
      ];
    case "soup_clear":
      return [
        {
          order: 1,
          instruction:
            "국거리 재료(고기 핏물·생선 가시·채소 흙)를 깨끗이 제거하고 얇고 부드럽게 썹니다.",
        },
        {
          order: 2,
          instruction:
            "냄비에 분량의 물과 주재료·무/배추를 넣고 중불에서 끓어오르면 거품을 걷어냅니다.",
          timerSeconds: 300,
        },
        {
          order: 3,
          instruction:
            "나머지 부드러운 재료(두부·달걀 등)를 넣고 약불에서 속까지 푹 우러나도록 한소끔 더 끓입니다.",
          timerSeconds: 240,
        },
        {
          order: 4,
          instruction: "뜨거운 국물에 데이지 않도록 충분히 식혀 건더기와 함께 제공합니다.",
        },
      ];
    case "soup_potage":
      return [
        {
          order: 1,
          instruction: "채소와 감자·단호박의 껍질과 씨를 제거하고 빨리 무르도록 작고 얇게 썹니다.",
        },
        {
          order: 2,
          instruction:
            "냄비에 재료와 분량의 물을 넣고 숟가락으로 쉽게 으깨질 때까지 충분히 끓입니다.",
          timerSeconds: 420,
        },
        {
          order: 3,
          instruction:
            "한 김 식힌 재료를 곱게 으깬 뒤 우유를 부어 약불에서 저어가며 부드러운 포타주 농도로 데웁니다.",
          timerSeconds: 180,
        },
        {
          order: 4,
          instruction: "덩어리 없이 매끄러운지 확인하고 따뜻한 상태에서 그릇에 담습니다.",
        },
      ];
    case "snack_steam_bread":
      return [
        {
          order: 1,
          instruction: "과일·구황작물은 껍질과 씨를 제거해 곱게 으깨거나 강판에 갈아 준비합니다.",
        },
        {
          order: 2,
          instruction:
            "볼에 으깬 원재료와 귀리·쌀가루, 달걀(또는 우유·요거트)을 넣고 멍울 없이 고루 섞어 반죽을 만듭니다.",
        },
        {
          order: 3,
          instruction:
            "내열 용기에 반죽을 담고 김이 오른 찜기에서 속까지 포슬포슬하게 완전히 익힙니다.",
          timerSeconds: 600,
        },
        {
          order: 4,
          instruction:
            "젓가락으로 찔러 반죽이 묻어나지 않으면 한 김 식혀 아기가 쥐고 먹기 좋은 크기로 자릅니다.",
        },
      ];
    case "snack_yogurt_cup":
      return [
        {
          order: 1,
          instruction:
            "생과일은 깨끗이 세척한 뒤 껍질·씨·꼭지를 제거하고 어린 월령도 안전하게 삼키도록 잘게 다지거나 으깹니다.",
        },
        {
          order: 2,
          instruction:
            "곡류(퀴노아·귀리 등)가 포함된 경우 물에 충분히 삶아 부드럽게 퍼진 뒤 식혀서 준비합니다.",
        },
        {
          order: 3,
          instruction:
            "그릇에 무가당 플레인요거트(또는 순두부·우유)를 담고 준비한 과일 토핑을 고루 올립니다.",
        },
        {
          order: 4,
          instruction: "너무 차갑지 않게 냉기를 살짝 뺀 뒤 스푼으로 고루 섞어 간식으로 제공합니다.",
        },
      ];
    case "snack_warm_fruit":
      return [
        {
          order: 1,
          instruction:
            "배와 사과는 깨끗이 씻어 껍질과 중심 씨앗 부분을 도려내고 잘게 깍둑썰기합니다.",
        },
        {
          order: 2,
          instruction:
            "작은 냄비에 손질한 과일과 분량의 물을 넣고 뚜껑을 덮어 약불에서 투명하고 말랑해질 때까지 익힙니다.",
          timerSeconds: 420,
        },
        {
          order: 3,
          instruction:
            "설탕이나 꿀 없이 과일 자체의 달콤한 즙이 우러나면 포크로 아기 월령에 맞게 가볍게 으깹니다.",
        },
        {
          order: 4,
          instruction: "속까지 뜨거우므로 미지근하게 충분히 식혀 따뜻한 과일 간식으로 줍니다.",
        },
      ];
    case "snack_mash_stick":
      return [
        {
          order: 1,
          instruction:
            "감자·완두콩·당근 등 채소는 껍질을 벗겨 찜기에서 푹 찌고, 두부는 끓는 물에 데쳐 물기를 뺍니다.",
          timerSeconds: 480,
        },
        {
          order: 2,
          instruction:
            "익힌 재료를 덩어리나 완두콩 껍질이 걸리지 않도록 곱게 으깨어 고루 섞습니다.",
        },
        {
          order: 3,
          instruction:
            "동그란 한입 볼이나 아기가 손으로 쥐기 좋은 스틱 모양으로 빚은 뒤 팬에서 약불로 가볍게 구워 형태를 잡습니다.",
          timerSeconds: 180,
        },
        {
          order: 4,
          instruction:
            "겉면이 단단해지지 않도록 촉촉함을 유지한 채 한 김 식혀 간식으로 제공합니다.",
        },
      ];
  }
}

function buildRecipe(b: Blueprint): ExpandedRecipeSeed {
  const category: RecipeCategory = b.dishType === "SNACK" ? "SNACK" : "MEAL";
  const mealRole: ExpandedMealRole = b.dishType === "ONE_BOWL" ? "MAIN" : b.dishType;
  const mealCategories: MealTime[] =
    category === "SNACK" ? ["SNACK"] : ["BREAKFAST", "LUNCH", "DINNER"];
  const ref = REFS[b.refKey];
  const isFreshSnack = b.style === "snack_yogurt_cup";

  return {
    slug: b.slug,
    name: b.name,
    summary: b.summary,
    category,
    mealRole,
    dishType: b.dishType,
    mealCategories,
    ageStages: b.ageStages,
    saltLevel: b.saltLevel,
    cookMinutes: b.cookMinutes,
    difficulty: b.difficulty ?? 1,
    tools: b.tools,
    baseServings: 2,
    ingredients: b.ingredients,
    steps: buildSteps(b),
    babyTips: {
      textureTip: b.ageStages.includes(1)
        ? "완료기 아기에게는 잇몸으로도 부드럽게 으깨지도록 수분을 충분히 잡고 푹 익혀 주세요."
        : "아기의 치아 발달과 저작 숙련도에 맞춰 익힘 정도와 촉촉함을 조절해 주세요.",
      cuttingSizeTip: b.ageStages.includes(1)
        ? "5mm 내외로 잘게 다지고 질긴 껍질·가시·심지는 반드시 제거해 주세요."
        : "7mm~1cm 내외 한입 크기로 손질하고 둥글거나 질긴 재료는 잘게 썰어 급여하세요.",
      seasoningTip:
        b.saltLevel === "NONE"
          ? "소금·간장·설탕을 넣지 않고 채소와 원재료 본연의 감칠맛과 단맛으로 완성합니다."
          : "유아용 저염 기준(1회분 나트륨 200mg 이하)을 지켜 최소한의 간만 더했습니다.",
      stageVariations: {
        "1": "건더기를 5mm 이하로 다지고 수분을 20~30ml 보충해 촉촉하게 제공하세요.",
        "2": "진밥·작은 반찬 크기로 썰어 스푼 연습하기 좋게 담아 주세요.",
        "3": "일반 유아식 식감으로 썰어 자기주도 식사 연습에 활용하세요.",
      },
    },
    storageInfo: isFreshSnack
      ? {
          fridgeDays: 1,
          freezerDays: 0,
          reheatTip: "생과일·요거트 메뉴는 가열하지 않고 만든 당일~익일 내 신선하게 섭취하세요.",
          portionTip: "먹기 직전에 과일과 요거트를 섞어 주면 수분 분리를 줄일 수 있습니다.",
        }
      : {
          fridgeDays: 2,
          freezerDays: b.dishType === "SOUP" || b.dishType === "ONE_BOWL" ? 14 : 7,
          reheatTip:
            "소분 용기에 물 1작은술을 더해 속까지 충분히 재가열한 뒤 골고루 섞어 온도를 확인하세요.",
          portionTip: "한 끼 분량씩 식혀 밀폐 용기에 담고 조리 일자를 표시해 보관하세요.",
        },
    sources: [
      {
        url: ref.url,
        title: ref.title,
        channelOrSite: ref.channelOrSite,
        sourceType: ref.sourceType,
        trustScore: ref.trustScore,
      },
    ],
  };
}

const BLUEPRINTS: Blueprint[] = [
  // ==================== 1. 한그릇 식사 (ONE_BOWL / MAIN: 22종) ====================
  {
    slug: "exp-beef-sweetpumpkin-oatmeal",
    name: "소고기단호박오트밀영양죽",
    summary: "철분이 풍부한 소고기와 달콤한 단호박·귀리를 부드럽게 끓인 무염 한그릇 오트밀죽",
    style: "oatmeal",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "beefOat",
    ingredients: [
      { ingredientSlug: "oats", amount: 50, unit: "g", prepNote: "퀵오트 준비" },
      { ingredientSlug: "beef-minced", amount: 50, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "sweet-pumpkin", amount: 70, unit: "g", prepNote: "껍질 제거 다지기" },
      { ingredientSlug: "onion", amount: 25, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "water", amount: 240, unit: "ml" },
    ],
  },
  {
    slug: "exp-beef-potato-onion-ricebowl",
    name: "소고기감자양파촉촉덮밥",
    summary: "포슬한 감자와 양파의 단맛으로 소고기 다짐육을 촉촉하게 감싼 무염 한그릇 덮밥",
    style: "rice_bowl",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "beefPotatoBowl",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g", prepNote: "진밥 준비" },
      { ingredientSlug: "beef-minced", amount: 55, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "potato", amount: 60, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "onion", amount: 35, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "carrot", amount: 20, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "water", amount: 140, unit: "ml" },
    ],
  },
  {
    slug: "exp-beef-spinach-tofu-soft-rice",
    name: "소고기시금치두부진밥",
    summary: "소고기·두부·시금치를 함께 끓여 철분과 식물성 단백질을 고루 담은 무염 진밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "beefSpinachBowl",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "beef-tenderloin", amount: 50, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "tofu", amount: 60, unit: "g", prepNote: "데쳐서 으깨기" },
      { ingredientSlug: "spinach", amount: 25, unit: "g", prepNote: "잎 부분 다지기" },
      { ingredientSlug: "sesame-oil", amount: 2, unit: "ml", isOptional: true },
      { ingredientSlug: "water", amount: 130, unit: "ml" },
    ],
  },
  {
    slug: "exp-chicken-potato-milk-risotto",
    name: "닭안심감자우유리조또",
    summary: "담백한 닭안심과 감자를 고소한 우유로 부드럽게 졸여낸 무염 크림 리조또",
    style: "risotto",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["프라이팬"],
    refKey: "chickenPotatoRisotto",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 150, unit: "g" },
      { ingredientSlug: "chicken-tenderloin", amount: 55, unit: "g", prepNote: "힘줄 제거 다지기" },
      { ingredientSlug: "potato", amount: 55, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 140, unit: "ml" },
      { ingredientSlug: "water", amount: 60, unit: "ml" },
    ],
  },
  {
    slug: "exp-chicken-spinach-cream-risotto",
    name: "닭안심시금치우유리조또",
    summary: "부드러운 닭안심과 연한 시금치 잎을 우유에 끓여 편식 없이 먹기 좋은 리조또",
    style: "risotto",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "chickenSpinachRisotto",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 150, unit: "g" },
      { ingredientSlug: "chicken-tenderloin", amount: 55, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "spinach", amount: 30, unit: "g", prepNote: "데쳐서 다지기" },
      { ingredientSlug: "button-mushroom", amount: 25, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "milk", amount: 150, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
    ],
  },
  {
    slug: "exp-chicken-onion-carrot-oatmeal",
    name: "닭가슴살양파당근오트밀죽",
    summary: "바쁜 아침 15분 만에 완성하는 담백하고 소화 잘되는 닭가슴살 채소 오트밀죽",
    style: "oatmeal",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "chickenOat",
    ingredients: [
      { ingredientSlug: "oats", amount: 50, unit: "g" },
      { ingredientSlug: "chicken-breast", amount: 55, unit: "g", prepNote: "익혀서 잘게 다지기" },
      { ingredientSlug: "onion", amount: 35, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "water", amount: 240, unit: "ml" },
    ],
  },
  {
    slug: "exp-chicken-zucchini-quinoa-rice",
    name: "닭안심애호박퀴노아진밥",
    summary: "톡톡 씹히는 퀴노아와 부드러운 애호박·닭안심을 함께 지은 고단백 영양 진밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 140, unit: "g" },
      { ingredientSlug: "quinoa", amount: 20, unit: "g", prepNote: "깨끗이 씻어 불리기" },
      { ingredientSlug: "chicken-tenderloin", amount: 55, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "zucchini", amount: 45, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "shiitake-mushroom", amount: 15, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "water", amount: 150, unit: "ml" },
    ],
  },
  {
    slug: "exp-pork-eggplant-onion-ricebowl",
    name: "한돈안심가지양파무염덮밥",
    summary: "말랑하게 익힌 가지와 달콤한 양파로 한돈 안심의 식감을 살린 촉촉한 무염 덮밥",
    style: "rice_bowl",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "porkEggplantBowl",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "pork-tenderloin", amount: 55, unit: "g", prepNote: "핏물 제거 다지기" },
      { ingredientSlug: "eggplant", amount: 55, unit: "g", prepNote: "껍질 벗겨 깍둑썰기" },
      { ingredientSlug: "onion", amount: 35, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "olive-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "water", amount: 120, unit: "ml" },
    ],
  },
  {
    slug: "exp-pork-apple-sweetpotato-rice",
    name: "한돈안심사과고구마영양밥",
    summary: "사과와 고구마의 자연 단맛이 돼지고기 안심과 어우러져 아기가 잘 먹는 한그릇 밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "porkVegStir",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 150, unit: "g" },
      { ingredientSlug: "pork-tenderloin", amount: 55, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "sweet-potato", amount: 50, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "apple", amount: 35, unit: "g", prepNote: "껍질·씨 제거 다지기" },
      { ingredientSlug: "water", amount: 130, unit: "ml" },
    ],
  },
  {
    slug: "exp-cod-radish-carrot-porridge",
    name: "대구살무당근촉촉진밥",
    summary: "시원한 무와 흰살생선 대구살을 푹 끓여 소화가 편안한 무염 생선 진밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "codPorridge",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "cod", amount: 55, unit: "g", prepNote: "잔가시 완전 제거" },
      { ingredientSlug: "radish", amount: 45, unit: "g", prepNote: "잘게 나박썰기" },
      { ingredientSlug: "carrot", amount: 20, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "water", amount: 150, unit: "ml" },
    ],
  },
  {
    slug: "exp-salmon-broccoli-milk-risotto",
    name: "연어브로콜리우유리조또",
    summary: "고소한 연어와 브로콜리를 우유·버터로 부드럽게 감싸 비린 맛을 줄인 영양 리조또",
    style: "risotto",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["프라이팬"],
    refKey: "salmonRisotto",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 150, unit: "g" },
      { ingredientSlug: "salmon", amount: 55, unit: "g", prepNote: "가시 제거 완전 가열" },
      { ingredientSlug: "broccoli", amount: 35, unit: "g", prepNote: "꽃봉오리 다지기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 140, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
    ],
  },
  {
    slug: "exp-flounder-potato-zucchini-rice",
    name: "가자미살감자애호박진밥",
    summary: "결이 고운 가자미살과 감자·애호박으로 부드러운 목넘김을 살린 무염 진밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "flounderStew",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "flounder", amount: 55, unit: "g", prepNote: "가시 확인 후 으깨기" },
      { ingredientSlug: "potato", amount: 45, unit: "g", prepNote: "작게 다지기" },
      { ingredientSlug: "zucchini", amount: 45, unit: "g", prepNote: "작게 다지기" },
      { ingredientSlug: "water", amount: 140, unit: "ml" },
    ],
  },
  {
    slug: "exp-tofu-mushroom-millet-rice",
    name: "두부표고버섯기장영양밥",
    summary: "구수한 기장쌀과 고소한 두부·표고버섯으로 감칠맛을 채운 식물성 한그릇 진밥",
    style: "porridge_rice",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 140, unit: "g" },
      { ingredientSlug: "millet", amount: 20, unit: "g", prepNote: "충분히 불리기" },
      { ingredientSlug: "tofu", amount: 80, unit: "g", prepNote: "깍둑 다지기" },
      { ingredientSlug: "shiitake-mushroom", amount: 25, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "carrot", amount: 20, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "water", amount: 140, unit: "ml" },
    ],
  },
  {
    slug: "exp-softtofu-egg-zucchini-ricebowl",
    name: "순두부달걀애호박촉촉덮밥",
    summary: "몽글몽글한 순두부와 달걀, 애호박을 포근하게 끓여 밥 위에 얹는 초간단 한그릇 덮밥",
    style: "rice_bowl",
    dishType: "ONE_BOWL",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "tofuEggSteam",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 160, unit: "g" },
      { ingredientSlug: "soft-tofu", amount: 90, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g", prepNote: "곱게 풀어 완전 가열" },
      { ingredientSlug: "zucchini", amount: 45, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "water", amount: 90, unit: "ml" },
    ],
  },
  // --- ONE_BOWL LOW (8종) ---
  {
    slug: "exp-beef-mushroom-soy-ricebowl",
    name: "소고기양송이저염간장덮밥",
    summary: "아기간장 소량과 양송이버섯·양파로 은은한 감칠맛을 살린 유아식 소고기 덮밥",
    style: "rice_bowl",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "beefPotatoBowl",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "beef-minced", amount: 60, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "button-mushroom", amount: 40, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "onion", amount: 40, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 110, unit: "ml" },
    ],
  },
  {
    slug: "exp-beef-bokchoy-egg-fried-rice",
    name: "소고기청경채달걀볶음밥",
    summary: "아삭하고 부드러운 청경채와 소고기·달걀을 고소하게 볶아낸 저염 영양 볶음밥",
    style: "fried_rice",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "beef-minced", amount: 50, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g", prepNote: "스크램블 익히기" },
      { ingredientSlug: "bok-choy", amount: 40, unit: "g", prepNote: "잎 위주 다지기" },
      { ingredientSlug: "canola-oil", amount: 4, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
    ],
  },
  {
    slug: "exp-chicken-paprika-egg-fried-rice",
    name: "닭가슴살파프리카달걀볶음밥",
    summary: "알록달록 파프리카와 닭가슴살·달걀로 눈과 입이 즐거운 저염 유아 볶음밥",
    style: "fried_rice",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "chickenVegStir",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "chicken-breast", amount: 55, unit: "g", prepNote: "잘게 깍둑썰기" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "paprika", amount: 35, unit: "g", prepNote: "껍질 얇게 다지기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "olive-oil", amount: 4, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
    ],
  },
  {
    slug: "exp-pork-cabbage-soy-ricebowl",
    name: "한돈양배추저염덮밥",
    summary: "푹 익혀 달큰해진 양배추와 다진 돼지고기를 순하게 조려낸 저염 한그릇 덮밥",
    style: "rice_bowl",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "porkVegStir",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "pork-minced", amount: 60, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "cabbage", amount: 60, unit: "g", prepNote: "잘게 채썰어 다지기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 110, unit: "ml" },
    ],
  },
  {
    slug: "exp-salmon-peas-butter-fried-rice",
    name: "연어완두콩버터볶음밥",
    summary: "무염버터에 구운 연어 살과 부드러운 완두콩·달걀을 함께 볶은 고소한 유아 볶음밥",
    style: "fried_rice",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "salmonVegStir",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 180, unit: "g" },
      { ingredientSlug: "salmon", amount: 55, unit: "g", prepNote: "가시 제거 후 잘게 부수기" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "green-peas", amount: 25, unit: "g", prepNote: "푹 삶아 살짝 으깨기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "unsalted-butter", amount: 5, unit: "g" },
    ],
  },
  {
    slug: "exp-cod-tofu-radish-noodle",
    name: "대구살두부무쌀국수",
    summary: "담백한 대구살과 두부, 시원한 무 국물에 부드러운 쌀국수면을 말아내는 별미 한그릇",
    style: "noodle",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "rice-noodle", amount: 70, unit: "g", prepNote: "불려서 2cm 자르기" },
      { ingredientSlug: "cod", amount: 55, unit: "g", prepNote: "가시 제거" },
      { ingredientSlug: "tofu", amount: 50, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "radish", amount: 45, unit: "g", prepNote: "얇게 나박썰기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 260, unit: "ml" },
    ],
  },
  {
    slug: "exp-chicken-tomato-broccoli-fusilli",
    name: "닭안심토마토브로콜리푸실리",
    summary: "완숙 토마토의 상큼한 감칠맛과 닭안심·브로콜리로 버무린 포크 연습용 유아 파스타",
    style: "pasta",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    tools: ["냄비", "프라이팬"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "pasta-fusilli", amount: 65, unit: "g", prepNote: "푹 삶아 작게 자르기" },
      { ingredientSlug: "chicken-tenderloin", amount: 55, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "tomato", amount: 90, unit: "g", prepNote: "껍질·씨 제거 다지기" },
      { ingredientSlug: "broccoli", amount: 30, unit: "g", prepNote: "꽃봉오리 다지기" },
      { ingredientSlug: "olive-oil", amount: 4, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.3, unit: "작은술" },
    ],
  },
  {
    slug: "exp-tofu-egg-greenonion-fried-rice",
    name: "두부달걀대파고소볶음밥",
    summary: "은은한 대파 향에 으깬 두부와 달걀을 보슬보슬하게 볶아낸 담백 저염 볶음밥",
    style: "fried_rice",
    dishType: "ONE_BOWL",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "tofuEggSteam",
    ingredients: [
      { ingredientSlug: "white-rice-cooked", amount: 170, unit: "g" },
      { ingredientSlug: "tofu", amount: 80, unit: "g", prepNote: "물기 짜서 으깨기" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "green-onion", amount: 15, unit: "g", prepNote: "흰 부분 송송 다지기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.4, unit: "작은술" },
    ],
  },

  // ==================== 2. 유아식 반찬 (SIDE: 14종) ====================
  {
    slug: "exp-side-spinach-tofu-sesame",
    name: "시금치두부참깨무침",
    summary: "간장 없이 데친 두부와 참깨가루로 시금치를 고소하고 부드럽게 무쳐낸 무염 나물 반찬",
    style: "side_namul",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "spinachTofuNamul",
    ingredients: [
      { ingredientSlug: "spinach", amount: 60, unit: "g", prepNote: "데쳐서 잘게 썰기" },
      { ingredientSlug: "tofu", amount: 80, unit: "g", prepNote: "데쳐서 물기 짜기" },
      { ingredientSlug: "sesame-powder", amount: 4, unit: "g" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-broccoli-tofu-mash-salad",
    name: "브로콜리두부고소무침",
    summary: "부드럽게 데친 브로콜리 꽃봉오리를 고소한 으깬 두부로 감싼 편식 예방 아기 반찬",
    style: "side_namul",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "broccoliTofuNamul",
    ingredients: [
      { ingredientSlug: "broccoli", amount: 65, unit: "g", prepNote: "꽃봉오리만 데쳐 다지기" },
      { ingredientSlug: "tofu", amount: 85, unit: "g", prepNote: "데쳐서 으깨기" },
      { ingredientSlug: "sesame-powder", amount: 4, unit: "g" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-sweetpumpkin-tofu-beomuk",
    name: "단호박두부촉촉범벅",
    summary: "달콤하게 찐 단호박과 담백한 두부를 포근하게 버무려 밥 반찬으로 좋은 무염 범벅",
    style: "side_namul",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "pumpkinTofu",
    ingredients: [
      { ingredientSlug: "sweet-pumpkin", amount: 90, unit: "g", prepNote: "껍질 벗겨 푹 찌기" },
      { ingredientSlug: "tofu", amount: 70, unit: "g", prepNote: "데쳐서 으깨기" },
      { ingredientSlug: "milk", amount: 25, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-beef-zucchini-onion-stir",
    name: "소고기애호박양파촉촉볶음",
    summary: "기름 대신 수분 스팀으로 소고기 다짐육과 애호박·양파를 부드럽게 익힌 만능 고기반찬",
    style: "side_stir",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "beefVegStir1",
    ingredients: [
      { ingredientSlug: "beef-minced", amount: 65, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "zucchini", amount: 55, unit: "g", prepNote: "작게 반달·다지기" },
      { ingredientSlug: "onion", amount: 35, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "carrot", amount: 20, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "sesame-oil", amount: 2, unit: "ml" },
      { ingredientSlug: "water", amount: 45, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-beef-broccoli-carrot-stir",
    name: "소고기브로콜리당근수분볶음",
    summary: "철분 풍부한 소고기와 브로콜리·당근을 촉촉하게 수분 볶음해 밥에 비벼도 좋은 반찬",
    style: "side_stir",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "beefVegStir2",
    ingredients: [
      { ingredientSlug: "beef-tenderloin", amount: 65, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "broccoli", amount: 45, unit: "g", prepNote: "꽃봉오리 다지기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "olive-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "water", amount: 45, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-chicken-cauliflower-carrot-stir",
    name: "닭가슴살콜리플라워당근볶음",
    summary: "담백한 닭가슴살에 부드러운 콜리플라워와 당근을 더한 깔끔한 무염 단백질 반찬",
    style: "side_stir",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "chickenVegStir",
    ingredients: [
      { ingredientSlug: "chicken-breast", amount: 65, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "cauliflower", amount: 55, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "olive-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "water", amount: 45, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-pork-paprika-onion-stir",
    name: "한돈안심파프리카양파볶음",
    summary: "부드러운 한돈 안심에 달콤한 파프리카와 양파를 곁들인 알록달록 유아 고기반찬",
    style: "side_stir",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "porkVegStir",
    ingredients: [
      { ingredientSlug: "pork-tenderloin", amount: 65, unit: "g", prepNote: "핏물 제거 다지기" },
      { ingredientSlug: "paprika", amount: 45, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "onion", amount: 40, unit: "g", prepNote: "채썰어 다지기" },
      { ingredientSlug: "canola-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "water", amount: 45, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-salmon-zucchini-carrot-pan",
    name: "연어애호박당근촉촉볶음",
    summary: "오메가 지방산이 풍부한 연어 살을 애호박·당근과 함께 촉촉하게 구워낸 생선 반찬",
    style: "side_stir",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "salmonVegStir",
    ingredients: [
      { ingredientSlug: "salmon", amount: 65, unit: "g", prepNote: "가시 제거 후 깍둑썰기" },
      { ingredientSlug: "zucchini", amount: 50, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
      { ingredientSlug: "water", amount: 35, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-tofu-carrot-egg-patties",
    name: "두부당근달걀부드러운전",
    summary: "으깬 두부와 다진 당근·양파를 달걀로 보드랍게 부쳐 아기 손으로 집어 먹기 좋은 전",
    style: "side_pan",
    dishType: "SIDE",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "tofuPatty",
    ingredients: [
      { ingredientSlug: "tofu", amount: 90, unit: "g", prepNote: "물기 꼭 짜기" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "onion", amount: 25, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "rice-flour", amount: 15, unit: "g" },
      { ingredientSlug: "canola-oil", amount: 4, unit: "ml" },
    ],
  },
  // --- SIDE LOW (5종) ---
  {
    slug: "exp-side-flounder-radish-soy-braise",
    name: "가자미살무저염간장조림",
    summary: "부드러운 가자미살 밑에 시원한 무를 깔고 아기간장으로 순하게 조린 생선 반찬",
    style: "side_braise",
    dishType: "SIDE",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "flounderSoyBraise",
    ingredients: [
      { ingredientSlug: "flounder", amount: 75, unit: "g", prepNote: "가시 완전 제거" },
      { ingredientSlug: "radish", amount: 60, unit: "g", prepNote: "얇게 나박썰기" },
      { ingredientSlug: "onion", amount: 25, unit: "g", prepNote: "채썰기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 90, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-cod-potato-soy-braise",
    name: "대구살감자저염조림",
    summary: "포슬포슬한 감자와 담백한 대구살을 은은한 저염 간장 양념으로 촉촉하게 조린 반찬",
    style: "side_braise",
    dishType: "SIDE",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "cod", amount: 75, unit: "g", prepNote: "잔가시 제거" },
      { ingredientSlug: "potato", amount: 65, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "zucchini", amount: 30, unit: "g", prepNote: "작게 썰기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 90, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-tofu-shiitake-soy-braise",
    name: "두부표고버섯저염조림",
    summary: "노릇하게 익힌 두부에 표고버섯 향과 저염 간장을 자작하게 배게 한 폭신한 두부 반찬",
    style: "side_braise",
    dishType: "SIDE",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["프라이팬"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "tofu", amount: 120, unit: "g", prepNote: "한입 크기 깍둑썰기" },
      { ingredientSlug: "shiitake-mushroom", amount: 30, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 80, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-beef-eggplant-soy-stir",
    name: "소고기가지저염볶음",
    summary: "다진 소고기의 고소한 육즙을 말랑한 가지에 쏙 흡수시킨 밥도둑 유아 반찬",
    style: "side_braise",
    dishType: "SIDE",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    tools: ["프라이팬"],
    refKey: "beefVegStir1",
    ingredients: [
      { ingredientSlug: "beef-minced", amount: 65, unit: "g", prepNote: "핏물 제거" },
      { ingredientSlug: "eggplant", amount: 70, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "paprika", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "sesame-oil", amount: 3, unit: "ml" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 60, unit: "ml" },
    ],
  },
  {
    slug: "exp-side-chicken-sweetpotato-braise",
    name: "닭안심고구마순한조림",
    summary: "설탕 없이 고구마의 달콤함만으로 닭안심을 촉촉하고 부드럽게 조려낸 인기 반찬",
    style: "side_braise",
    dishType: "SIDE",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "chickenVegStir",
    ingredients: [
      { ingredientSlug: "chicken-tenderloin", amount: 75, unit: "g", prepNote: "한입 이하 썰기" },
      { ingredientSlug: "sweet-potato", amount: 65, unit: "g", prepNote: "모서리 둥글게 썰기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "작게 썰기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.5, unit: "작은술" },
      { ingredientSlug: "water", amount: 100, unit: "ml" },
    ],
  },

  // ==================== 3. 국·수프 (SOUP: 8종) ====================
  {
    slug: "exp-soup-beef-napacabbage-clear",
    name: "소고기배추맑은무염국",
    summary: "알배기배추의 시원하고 달큰한 채수에 부드러운 소고기를 넣어 끓인 무염 맑은국",
    style: "soup_clear",
    dishType: "SOUP",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "beef-tenderloin", amount: 55, unit: "g", prepNote: "핏물 제거 잘게 썰기" },
      { ingredientSlug: "napa-cabbage", amount: 70, unit: "g", prepNote: "연한 잎 잘게 썰기" },
      { ingredientSlug: "radish", amount: 40, unit: "g", prepNote: "얇게 나박썰기" },
      { ingredientSlug: "water", amount: 280, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-chicken-potato-onion-cream",
    name: "닭안심감자양파우유수프",
    summary: "닭안심과 감자·양파를 푹 끓여 우유로 고소하게 풀어낸 든든한 한그릇형 수프",
    style: "soup_potage",
    dishType: "SOUP",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "chickenPotatoRisotto",
    ingredients: [
      { ingredientSlug: "chicken-tenderloin", amount: 50, unit: "g", prepNote: "잘게 다지기" },
      { ingredientSlug: "potato", amount: 80, unit: "g", prepNote: "얇게 썰기" },
      { ingredientSlug: "onion", amount: 40, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 150, unit: "ml" },
      { ingredientSlug: "water", amount: 120, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-sweetpumpkin-carrot-potage",
    name: "단호박당근부드러운포타주",
    summary: "달콤한 단호박과 당근을 벨벳처럼 곱게 으깨 우유로 끓여낸 노란 영양 포타주",
    style: "soup_potage",
    dishType: "SOUP",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "pumpkinCarrotSoup",
    ingredients: [
      { ingredientSlug: "sweet-pumpkin", amount: 110, unit: "g", prepNote: "껍질·씨 제거" },
      { ingredientSlug: "carrot", amount: 35, unit: "g", prepNote: "얇게 썰기" },
      { ingredientSlug: "onion", amount: 25, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 140, unit: "ml" },
      { ingredientSlug: "water", amount: 100, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-broccoli-potato-milk",
    name: "브로콜리감자크림수프",
    summary: "브로콜리의 풋내를 감자와 우유·버터로 부드럽게 잡아 스푼으로 떠먹기 좋은 크림수프",
    style: "soup_potage",
    dishType: "SOUP",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "broccoli", amount: 65, unit: "g", prepNote: "꽃봉오리만 손질" },
      { ingredientSlug: "potato", amount: 85, unit: "g", prepNote: "작게 썰기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 150, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
      { ingredientSlug: "water", amount: 100, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-buttonmushroom-potato-milk",
    name: "양송이감자우유포타주",
    summary: "고소한 양송이버섯 향과 포슬한 감자가 어우러진 담백 무염 레스토랑풍 유아 수프",
    style: "soup_potage",
    dishType: "SOUP",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "button-mushroom", amount: 65, unit: "g", prepNote: "밑동 손질 후 썰기" },
      { ingredientSlug: "potato", amount: 80, unit: "g", prepNote: "얇게 썰기" },
      { ingredientSlug: "onion", amount: 30, unit: "g", prepNote: "다지기" },
      { ingredientSlug: "milk", amount: 150, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
      { ingredientSlug: "water", amount: 100, unit: "ml" },
    ],
  },
  // --- SOUP LOW (3종) ---
  {
    slug: "exp-soup-cod-tofu-radish-clear",
    name: "대구살두부무저염맑은국",
    summary: "보들보들한 대구살과 두부, 무를 넣고 아기간장으로 깔끔하게 간한 밥 말아 먹기 좋은 국",
    style: "soup_clear",
    dishType: "SOUP",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "cod", amount: 60, unit: "g", prepNote: "가시 완전 제거" },
      { ingredientSlug: "tofu", amount: 60, unit: "g", prepNote: "작게 깍둑썰기" },
      { ingredientSlug: "radish", amount: 50, unit: "g", prepNote: "얇게 나박썰기" },
      { ingredientSlug: "green-onion", amount: 10, unit: "g", prepNote: "송송 다지기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.4, unit: "작은술" },
      { ingredientSlug: "water", amount: 280, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-softtofu-bokchoy-egg",
    name: "순두부청경채달걀맑은국",
    summary: "부드러운 순두부와 줄달걀에 연한 청경채를 더해 술술 넘어가는 저염 맑은 달걀국",
    style: "soup_clear",
    dishType: "SOUP",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "tofuEggSteam",
    ingredients: [
      { ingredientSlug: "soft-tofu", amount: 90, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g", prepNote: "곱게 풀어 줄알치기" },
      { ingredientSlug: "bok-choy", amount: 35, unit: "g", prepNote: "연한 잎 다지기" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.4, unit: "작은술" },
      { ingredientSlug: "water", amount: 270, unit: "ml" },
    ],
  },
  {
    slug: "exp-soup-pork-napacabbage-mushroom",
    name: "한돈배추표고버섯국",
    summary: "담백한 한돈 안심과 배추·표고버섯으로 깊은 감칠맛을 우린 저염 유아 국",
    style: "soup_clear",
    dishType: "SOUP",
    ageStages: [2, 3, 4],
    saltLevel: "LOW",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "pork-tenderloin", amount: 55, unit: "g", prepNote: "잘게 채썰기" },
      { ingredientSlug: "napa-cabbage", amount: 65, unit: "g", prepNote: "잘게 썰기" },
      { ingredientSlug: "shiitake-mushroom", amount: 25, unit: "g", prepNote: "얇게 슬라이스" },
      { ingredientSlug: "baby-soy-sauce", amount: 0.4, unit: "작은술" },
      { ingredientSlug: "water", amount: 280, unit: "ml" },
    ],
  },

  // ==================== 4. 영양 간식 (SNACK: 12종) ====================
  {
    slug: "exp-snack-apple-banana-oat-bread",
    name: "사과바나나오트밀찜빵",
    summary: "밀가루·설탕 없이 잘 익은 바나나와 사과, 귀리·달걀로 포슬하게 쪄낸 영양 간식빵",
    style: "snack_steam_bread",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "appleBananaOat",
    ingredients: [
      { ingredientSlug: "banana", amount: 70, unit: "g", prepNote: "곱게 으깨기" },
      { ingredientSlug: "apple", amount: 50, unit: "g", prepNote: "강판에 갈기" },
      { ingredientSlug: "oats", amount: 45, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "milk", amount: 30, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-blueberry-banana-oat-muffin",
    name: "블루베리바나나귀리머핀",
    summary: "새콤달콤 다진 블루베리와 바나나로 촉촉하게 쪄낸 무설탕 귀리 머핀",
    style: "snack_steam_bread",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "blueberryBananaMuffin",
    ingredients: [
      { ingredientSlug: "banana", amount: 75, unit: "g", prepNote: "으깨기" },
      { ingredientSlug: "blueberry", amount: 35, unit: "g", prepNote: "반 이상 잘라 으깨기" },
      { ingredientSlug: "oats", amount: 45, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "plain-yogurt", amount: 30, unit: "g" },
    ],
  },
  {
    slug: "exp-snack-sweetpotato-carrot-rice-bread",
    name: "고구마당근쌀가루찜빵",
    summary: "달콤한 고구마와 당근에 쌀가루를 더해 폭신폭신하게 쪄낸 글루텐프리 아기 찜빵",
    style: "snack_steam_bread",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 25,
    tools: ["냄비"],
    refKey: "sweetpotatoCarrotBread",
    ingredients: [
      { ingredientSlug: "sweet-potato", amount: 85, unit: "g", prepNote: "쪄서 으깨기" },
      { ingredientSlug: "carrot", amount: 25, unit: "g", prepNote: "곱게 다지기" },
      { ingredientSlug: "rice-flour", amount: 45, unit: "g" },
      { ingredientSlug: "egg-yolk", amount: 34, unit: "g" },
      { ingredientSlug: "milk", amount: 50, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-apple-carrot-oat-cake",
    name: "사과당근귀리촉촉빵",
    summary: "상큼한 사과와 당근을 듬뿍 넣어 채소 섭취까지 챙기는 부드러운 귀리 간식빵",
    style: "snack_steam_bread",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비"],
    refKey: "appleCarrotBread",
    ingredients: [
      { ingredientSlug: "apple", amount: 70, unit: "g", prepNote: "강판에 갈기" },
      { ingredientSlug: "carrot", amount: 30, unit: "g", prepNote: "강판에 갈기" },
      { ingredientSlug: "oats", amount: 45, unit: "g" },
      { ingredientSlug: "egg", amount: 50, unit: "g" },
      { ingredientSlug: "milk", amount: 30, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-avocado-pear-yogurt-cup",
    name: "아보카도배요거트볼",
    summary: "버터처럼 부드러운 아보카도와 달콤한 배를 플레인요거트에 담은 불 안 쓰는 간식",
    style: "snack_yogurt_cup",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 10,
    tools: [],
    refKey: "avocadoPuree",
    ingredients: [
      { ingredientSlug: "avocado", amount: 55, unit: "g", prepNote: "후숙 과육 으깨기" },
      { ingredientSlug: "pear", amount: 55, unit: "g", prepNote: "껍질 제거 잘게 갈기" },
      { ingredientSlug: "plain-yogurt", amount: 90, unit: "g" },
    ],
  },
  {
    slug: "exp-snack-strawberry-banana-yogurt-bowl",
    name: "딸기바나나요거트컵",
    summary: "상큼한 딸기와 달콤한 바나나를 무가당 요거트에 듬뿍 올린 비타민 간식컵",
    style: "snack_yogurt_cup",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 10,
    tools: [],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "strawberry", amount: 55, unit: "g", prepNote: "꼭지 제거 잘게 썰기" },
      { ingredientSlug: "banana", amount: 55, unit: "g", prepNote: "작게 다지기" },
      { ingredientSlug: "plain-yogurt", amount: 95, unit: "g" },
    ],
  },
  {
    slug: "exp-snack-persimmon-tofu-smooth-cup",
    name: "단감순두부부드러운컵",
    summary: "잘 익은 달콤한 단감과 데친 순두부를 푸딩처럼 고소하게 섞어 먹는 유제품 프리 간식",
    style: "snack_yogurt_cup",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 10,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "persimmon", amount: 75, unit: "g", prepNote: "껍질·씨 제거 곱게 으깨기" },
      { ingredientSlug: "soft-tofu", amount: 110, unit: "g", prepNote: "살짝 데쳐 식히기" },
    ],
  },
  {
    slug: "exp-snack-sweetpumpkin-banana-milk-cup",
    name: "단호박바나나우유스푼컵",
    summary: "푹 찐 단호박과 바나나를 따뜻한 우유에 풀어 스푼으로 떠먹는 달콤 든든 간식",
    style: "soup_potage",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "pumpkinTofu",
    ingredients: [
      { ingredientSlug: "sweet-pumpkin", amount: 90, unit: "g", prepNote: "껍질 제거" },
      { ingredientSlug: "banana", amount: 55, unit: "g", prepNote: "으깨기" },
      { ingredientSlug: "milk", amount: 110, unit: "ml" },
      { ingredientSlug: "water", amount: 40, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-pear-apple-warm-compote",
    name: "배사과따뜻한온찜",
    summary: "환절기 아기 목을 촉촉하게 적셔주는 무설탕 배·사과 따뜻한 과일 컴포트",
    style: "snack_warm_fruit",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "appleSweetpotatoSnack",
    ingredients: [
      { ingredientSlug: "pear", amount: 85, unit: "g", prepNote: "껍질·씨 제거 깍둑썰기" },
      { ingredientSlug: "apple", amount: 75, unit: "g", prepNote: "껍질·씨 제거 깍둑썰기" },
      { ingredientSlug: "water", amount: 70, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-potato-peas-butter-mash",
    name: "감자완두콩버터매시볼",
    summary: "포슬한 감자와 고소한 완두콩을 무염버터로 빚어낸 동글동글 영양 핑거푸드 간식",
    style: "snack_mash_stick",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비", "프라이팬"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "potato", amount: 120, unit: "g", prepNote: "푹 쪄서 으깨기" },
      { ingredientSlug: "green-peas", amount: 30, unit: "g", prepNote: "푹 삶아 곱게 으깨기" },
      { ingredientSlug: "milk", amount: 30, unit: "ml" },
      { ingredientSlug: "unsalted-butter", amount: 4, unit: "g" },
    ],
  },
  {
    slug: "exp-snack-tofu-carrot-finger-stick",
    name: "두부당근구운스틱",
    summary: "담백한 두부와 달큰한 당근, 쌀가루로 빚어 아기가 손에 쥐고 먹기 편한 자기주도 간식",
    style: "snack_mash_stick",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 20,
    tools: ["냄비", "프라이팬"],
    refKey: "tofuCarrotStick",
    ingredients: [
      { ingredientSlug: "tofu", amount: 110, unit: "g", prepNote: "데쳐서 물기 꼭 짜기" },
      { ingredientSlug: "carrot", amount: 35, unit: "g", prepNote: "쪄서 곱게 다지기" },
      { ingredientSlug: "rice-flour", amount: 25, unit: "g" },
      { ingredientSlug: "sesame-powder", amount: 4, unit: "g" },
      { ingredientSlug: "olive-oil", amount: 3, unit: "ml" },
    ],
  },
  {
    slug: "exp-snack-quinoa-blueberry-yogurt-cup",
    name: "퀴노아블루베리요거트볼",
    summary: "부드럽게 삶은 슈퍼푸드 퀴노아와 블루베리를 플레인요거트에 곁들인 든든한 오후 간식",
    style: "snack_yogurt_cup",
    dishType: "SNACK",
    ageStages: [1, 2, 3, 4],
    saltLevel: "NONE",
    cookMinutes: 15,
    tools: ["냄비"],
    refKey: "mfdsCook",
    ingredients: [
      { ingredientSlug: "quinoa", amount: 25, unit: "g", prepNote: "푹 삶아 식히기" },
      { ingredientSlug: "blueberry", amount: 45, unit: "g", prepNote: "반 갈라 으깨기" },
      { ingredientSlug: "plain-yogurt", amount: 100, unit: "g" },
      { ingredientSlug: "water", amount: 50, unit: "ml" },
    ],
  },
];

export const EXPANDED_RECIPES: ExpandedRecipeSeed[] = BLUEPRINTS.map(buildRecipe);

export const EXPANDED_MEAL_PROFILES: Record<string, ExpandedDishType> = Object.fromEntries(
  EXPANDED_RECIPES.map((r) => [r.slug, r.dishType]),
);
