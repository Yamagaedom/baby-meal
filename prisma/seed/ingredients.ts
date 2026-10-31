/**
 * 유아식·간식 기준 식재료 사전 시드 데이터 (210종+) — PRD 8장 콘텐츠 요구사항, AI-05 안전 검증 기준
 *
 * [데이터 출처 및 산정 기준]
 * 1. 100g당 나트륨(sodiumMgPer100g):
 *    - 식품의약품안전처 「식품영양성분 데이터베이스」(variousfoodsafetykorea.go.kr) 및
 *      농촌진흥청 국립농업과학원 「국가표준식품성분표(제10개정판)」 생원료/조리원료 가식부 100g 기준 대표값.
 *    - 브랜드 편차가 큰 가공식품(아기치즈, 식빵, 어묵 등)은 시판 유아용·일반 제품 평균 대표값을 사용.
 * 2. 알레르기 분류(allergens / allergenType):
 *    - 식품의약품안전처 고시 「식품 등의 표시기준」 알레르기 유발물질 표시 대상(알류, 우유, 메밀, 땅콩,
 *      대두, 밀, 고등어, 게, 새우, 돼지고기, 복숭아, 토마토, 아황산류, 호두, 닭고기, 쇠고기, 오징어,
 *      조개류, 잣) 기준.
 *    - 식빵·국수·어묵·마요네즈 등 복합 가공식품은 일반적인 제조 배합 기준 하위 알레르기 성분을 모두 태깅.
 * 3. 최소 섭취 월령(minAgeMonth) 및 주의사항(cautionNote):
 *    - 본 서비스 지원 범위(12~48개월) 기준.
 *    - 통견과류·통포도(미손질)·떡류(질식 고위험), 날생선·날달걀(식중독 위험), 카페인·초콜릿·자극성 장류 등
 *      48개월 이하 유아식에 부적합한 식품은 minAgeMonth = 49로 설정해 AI-05 ③에서 자동 차단한다.
 */
import type { Allergen, IngredientGroup } from "@/lib/domain/types";

export interface SeedIngredient {
  slug: string;
  name: string;
  synonyms: string[];
  group: IngredientGroup;
  allergens: Allergen[];
  isPantryBasic?: boolean;
  isSaltySeasoning?: boolean;
  minAgeMonth: number;
  sodiumMgPer100g: number;
  gramsPerPiece?: number | null;
  densityGPerMl?: number;
  cautionNote?: string | null;
}

/** 튜플 헬퍼로 210종 이상 식재료 사전을 간결하고 누락 없이 정의 */
type Row = [
  slug: string,
  name: string,
  synonyms: string[],
  group: IngredientGroup,
  allergens: Allergen[],
  minAgeMonth: number,
  sodiumMgPer100g: number,
  gramsPerPiece?: number | null,
  opts?: {
    pantry?: boolean;
    salty?: boolean;
    density?: number;
    caution?: string;
  },
];

const ROWS: Row[] = [
  // ================= 1. 곡류·서류·면류 (GRAIN: 30종) =================
  ["white-rice-cooked", "쌀밥", ["밥", "백미밥", "진밥", "무른밥"], "GRAIN", [], 12, 2, 200],
  ["white-rice-raw", "백미", ["쌀", "멥쌀", "불린쌀"], "GRAIN", [], 12, 2, null, { pantry: true }],
  ["glutinous-rice", "찹쌀", ["불린찹쌀"], "GRAIN", [], 12, 2, null],
  ["brown-rice", "현미", ["현미쌀"], "GRAIN", [], 16, 3, null, { caution: "소화를 위해 충분히 불려 조리" }],
  ["black-rice", "흑미", ["검은쌀"], "GRAIN", [], 16, 3, null],
  ["barley", "보리쌀", ["찰보리", "압맥"], "GRAIN", [], 16, 3, null],
  ["oats", "귀리", ["오트밀", "롤드오트", "퀵오트"], "GRAIN", [], 12, 4, null],
  ["millet", "기장", ["기장쌀"], "GRAIN", [], 12, 3, null],
  ["foxtail-millet", "차조", ["조"], "GRAIN", [], 12, 3, null],
  ["sorghum", "수수", ["찰수수"], "GRAIN", [], 12, 2, null],
  ["quinoa", "퀴노아", [], "GRAIN", [], 12, 5, null],
  ["amaranth", "아마란스", [], "GRAIN", [], 12, 4, null],
  ["rice-flour", "쌀가루", ["습식쌀가루", "건식쌀가루", "박력쌀가루"], "GRAIN", [], 12, 2, null],
  ["glutinous-rice-flour", "찹쌀가루", [], "GRAIN", [], 12, 3, null],
  ["wheat-flour", "밀가루", ["박력분", "중력분", "강력분", "우리밀가루"], "GRAIN", ["WHEAT"], 12, 2, null],
  ["pancake-mix", "부침가루", [], "GRAIN", ["WHEAT", "SOYBEAN", "MILK"], 25, 620, null, { salty: true, caution: "조미 성분 및 대두·우유 혼입 가능 — 원재료명 확인" }],
  ["starch-potato", "감자전분", ["전분", "전분가루", "녹말가루"], "GRAIN", [], 12, 8, null, { pantry: true }],
  ["corn-starch", "옥수수전분", [], "GRAIN", [], 12, 9, null],
  ["potato", "감자", ["수미감자"], "GRAIN", [], 12, 6, 130],
  ["sweet-potato", "고구마", ["밤고구마", "호박고구마", "꿀고구마"], "GRAIN", [], 12, 15, 150],
  ["sweet-corn", "옥수수", ["찰옥수수", "초당옥수수알"], "GRAIN", [], 16, 3, 120, { caution: "알갱이 껍질 질식 주의, 다져서 사용" }],
  ["chestnut-peeled", "깐밤", ["밤"], "GRAIN", [], 12, 2, 12, { caution: "으깨거나 잘게 다져 급여" }],
  ["somyeon-low-sodium", "무염소면", ["아기소면", "아기국수"], "GRAIN", ["WHEAT"], 12, 15, null],
  ["somyeon-regular", "소면", ["국수소면"], "GRAIN", ["WHEAT"], 25, 1600, null, { caution: "삶은 뒤 찬물에 여러 번 헹궈 염분 제거" }],
  ["rice-noodle", "쌀국수면", ["포면"], "GRAIN", [], 12, 18, null],
  ["buckwheat-noodle", "메밀면", ["메밀국수"], "GRAIN", ["BUCKWHEAT", "WHEAT"], 16, 120, null],
  ["pasta-fusilli", "파스타면", ["푸실리", "펜네", "스파게티면", "마카로니"], "GRAIN", ["WHEAT"], 12, 6, null],
  ["couscous", "쿠스쿠스", [], "GRAIN", ["WHEAT"], 16, 10, null],
  ["tteokguk-tteok", "떡국떡", [], "GRAIN", [], 37, 260, null, { caution: "질식 위험 — 36개월 이하 주의, 작게 잘라 급여" }],
  ["injeolmi-whole", "인절미떡", ["통떡", "꿀떡"], "GRAIN", ["SOYBEAN"], 49, 280, 30, { caution: "점성이 강해 유아 질식 고위험 식품 — 48개월 이하 금지" }],

  // ================= 2. 채소·버섯·해조류 (VEGETABLE: 55종) =================
  ["carrot", "당근", ["흙당근"], "VEGETABLE", [], 12, 69, 120],
  ["zucchini", "애호박", ["호박", "조선호박"], "VEGETABLE", [], 12, 3, 250],
  ["sweet-pumpkin", "단호박", ["미니단호박", "밤호박"], "VEGETABLE", [], 12, 2, 400],
  ["aged-pumpkin", "늙은호박", [], "VEGETABLE", [], 12, 4, null],
  ["onion", "양파", [], "VEGETABLE", [], 12, 4, 180],
  ["green-onion", "대파", ["파"], "VEGETABLE", [], 12, 16, 40, { pantry: true }],
  ["chives", "쪽파", ["실파"], "VEGETABLE", [], 12, 18, 10],
  ["garlic-chives", "부추", [], "VEGETABLE", [], 12, 11, null],
  ["garlic", "마늘", ["다진마늘", "간마늘"], "VEGETABLE", [], 12, 17, 5, { pantry: true }],
  ["radish", "무", ["조선무", "무우"], "VEGETABLE", [], 12, 29, null],
  ["young-radish", "열무", [], "VEGETABLE", [], 16, 35, null],
  ["napa-cabbage", "배추", ["알배기배추", "알배추", "봄동"], "VEGETABLE", [], 12, 14, null],
  ["cabbage", "양배추", ["푸른양배추"], "VEGETABLE", [], 12, 18, null],
  ["red-cabbage", "적양배추", [], "VEGETABLE", [], 16, 20, null],
  ["broccoli", "브로콜리", [], "VEGETABLE", [], 12, 33, 250],
  ["cauliflower", "콜리플라워", ["꽃양배추"], "VEGETABLE", [], 12, 30, 300],
  ["spinach", "시금치", ["포항초", "섬초"], "VEGETABLE", [], 12, 79, null],
  ["bok-choy", "청경채", [], "VEGETABLE", [], 12, 65, 80],
  ["chard", "근대", [], "VEGETABLE", [], 12, 130, null],
  ["mallow", "아욱", [], "VEGETABLE", [], 12, 25, null],
  ["crown-daisy", "쑥갓", [], "VEGETABLE", [], 16, 52, null],
  ["kale", "케일", [], "VEGETABLE", [], 16, 38, 15],
  ["lettuce", "상추", ["청상추", "적상추"], "VEGETABLE", [], 16, 20, 10],
  ["iceberg-lettuce", "양상추", [], "VEGETABLE", [], 16, 9, null],
  ["cucumber", "오이", ["백오이", "취청오이"], "VEGETABLE", [], 12, 3, 200],
  ["eggplant", "가지", [], "VEGETABLE", [], 12, 2, 150],
  ["paprika", "파프리카", ["빨강파프리카", "노랑파프리카", "피망"], "VEGETABLE", [], 12, 3, 160],
  ["tomato", "토마토", ["완숙토마토"], "VEGETABLE", ["TOMATO"], 12, 5, 180],
  ["cherry-tomato-cut", "방울토마토(4등분)", ["방울토마토", "대추방울토마토"], "VEGETABLE", ["TOMATO"], 12, 5, 15, { caution: "반드시 4등분 이상 잘라 급여(통째 급여 시 질식 위험)" }],
  ["bean-sprouts", "콩나물", [], "VEGETABLE", ["SOYBEAN"], 12, 6, null],
  ["mung-bean-sprouts", "숙주나물", ["숙주"], "VEGETABLE", [], 12, 5, null],
  ["green-peas", "완두콩", ["완두"], "VEGETABLE", [], 12, 4, null, { caution: "어린 월령은 으깨어 급여" }],
  ["green-beans", "그린빈", ["껍질콩", "강낭콩줄기"], "VEGETABLE", [], 12, 6, null],
  ["lotus-root", "연근", [], "VEGETABLE", [], 16, 40, null],
  ["burdock", "우엉", [], "VEGETABLE", [], 16, 18, null],
  ["doraji", "도라지", [], "VEGETABLE", [], 16, 12, null],
  ["asparagus", "아스파라거스", [], "VEGETABLE", [], 12, 2, 20],
  ["celery", "셀러리", ["양미나리"], "VEGETABLE", [], 16, 80, 40],
  ["kohlrabi", "콜라비", [], "VEGETABLE", [], 12, 20, null],
  ["beet", "비트", ["레드비트"], "VEGETABLE", [], 16, 78, 150],
  ["perilla-leaf", "깻잎", [], "VEGETABLE", [], 16, 7, 2],
  ["sweet-potato-stem", "고구마줄기", ["고구마순"], "VEGETABLE", [], 16, 8, null],
  ["gosari", "고사리", ["삶은고사리"], "VEGETABLE", [], 25, 3, null],
  ["chwinamul", "취나물", ["참취"], "VEGETABLE", [], 16, 9, null],
  ["minari", "미나리", ["돌미나리"], "VEGETABLE", [], 16, 45, null],
  ["shiitake-mushroom", "표고버섯", ["생표고"], "VEGETABLE", [], 12, 4, 20],
  ["king-oyster-mushroom", "새송이버섯", ["새송이"], "VEGETABLE", [], 12, 5, 80],
  ["enoki-mushroom", "팽이버섯", ["팽이"], "VEGETABLE", [], 12, 3, 150, { caution: "질기므로 5mm 이하로 잘게 썰어 조리" }],
  ["oyster-mushroom", "느타리버섯", ["애느타리"], "VEGETABLE", [], 12, 4, null],
  ["button-mushroom", "양송이버섯", ["양송이"], "VEGETABLE", [], 12, 5, 18],
  ["wood-ear-mushroom", "목이버섯", ["불린목이버섯"], "VEGETABLE", [], 16, 10, null],
  ["miyeok-soaked", "불린미역", ["미역"], "VEGETABLE", [], 12, 190, null, { caution: "충분히 불리고 여러 번 헹궈 염분 제거" }],
  ["laver-plain", "무염김", ["곱창김", "구운김(무염)", "재래김"], "VEGETABLE", [], 12, 220, 2.5],
  ["dashima", "다시마", ["건다시마"], "VEGETABLE", [], 12, 550, 5, { caution: "주로 육수 우려내기용으로 사용 후 건져냄" }],
  ["maesaengi", "매생이", [], "VEGETABLE", [], 16, 180, null],

  // ================= 3. 과일류 (FRUIT: 22종) =================
  ["apple", "사과", ["부사", "홍로"], "FRUIT", [], 12, 1, 220],
  ["pear", "배", ["신고배"], "FRUIT", [], 12, 2, 400],
  ["banana", "바나나", [], "FRUIT", [], 12, 1, 110],
  ["strawberry", "딸기", [], "FRUIT", [], 12, 1, 18],
  ["blueberry", "블루베리", [], "FRUIT", [], 12, 1, 2, { caution: "어린 월령은 반으로 자르거나 살짝 으깨 급여" }],
  ["mandarin", "귤", ["감귤", "한라봉", "천혜향"], "FRUIT", [], 12, 2, 80, { caution: "속껍질 제거 후 급여" }],
  ["orange", "오렌지", [], "FRUIT", [], 12, 1, 180],
  ["watermelon", "수박", [], "FRUIT", [], 12, 1, null, { caution: "씨를 반드시 제거" }],
  ["oriental-melon", "참외", [], "FRUIT", [], 12, 2, 220],
  ["melon", "멜론", ["머스크멜론"], "FRUIT", [], 12, 12, null],
  ["peach", "복숭아", ["백도", "황도"], "FRUIT", ["PEACH"], 12, 1, 200],
  ["plum", "자두", [], "FRUIT", [], 12, 1, 65],
  ["persimmon", "단감", ["감", "홍시"], "FRUIT", [], 12, 2, 160],
  ["kiwi", "키위", ["골드키위", "참다래"], "FRUIT", [], 12, 3, 90],
  ["mango", "망고", ["애플망고"], "FRUIT", [], 12, 2, 200],
  ["avocado", "아보카도", [], "FRUIT", [], 12, 7, 140],
  ["pineapple", "파인애플", [], "FRUIT", [], 16, 1, null],
  ["grape-quartered", "포도(씨제거·4등분)", ["청포도손질", "샤인머스캣손질"], "FRUIT", [], 12, 2, 8, { caution: "세로로 4등분하고 씨 제거 필수" }],
  ["whole-grape", "통포도", ["통샤인머스캣"], "FRUIT", [], 49, 2, 8, { caution: "통포도는 기도 폐쇄 위험 — 48개월 이하 통째 급여 금지" }],
  ["cherry-pitted", "체리(씨제거)", [], "FRUIT", [], 16, 1, 8, { caution: "씨 제거 후 4등분" }],
  ["fig", "무화과", [], "FRUIT", [], 16, 2, 60],
  ["raisin-chopped", "건포도(다진것)", ["건포도"], "FRUIT", ["SULFITE"], 25, 12, null, { caution: "미지근한 물에 불려 다져서 사용" }],

  // ================= 4. 육류 (MEAT: 18종) =================
  ["beef-lean", "소고기", ["쇠고기", "한우", "소고기우둔살", "소고기홍두깨살", "소고기설도"], "MEAT", ["BEEF"], 12, 55, null],
  ["beef-tenderloin", "소고기안심", ["한우안심"], "MEAT", ["BEEF"], 12, 50, null],
  ["beef-minced", "소고기다짐육", ["다진소고기", "한우다짐육"], "MEAT", ["BEEF"], 12, 55, null],
  ["beef-brisket-soup", "소고기양지", ["국거리소고기", "사태"], "MEAT", ["BEEF"], 12, 58, null],
  ["chicken-breast", "닭가슴살", ["닭고기", "생닭가슴살"], "MEAT", ["CHICKEN"], 12, 45, 120],
  ["chicken-tenderloin", "닭안심", ["닭안심살"], "MEAT", ["CHICKEN"], 12, 43, 45],
  ["chicken-thigh", "닭다리살", ["정육닭다리살"], "MEAT", ["CHICKEN"], 12, 62, 100],
  ["chicken-minced", "닭고기다짐육", ["다진닭고기"], "MEAT", ["CHICKEN"], 12, 50, null],
  ["pork-tenderloin", "돼지고기안심", ["돼지안심", "한돈안심"], "MEAT", ["PORK"], 12, 52, null],
  ["pork-loin", "돼지고기등심", ["돼지등심"], "MEAT", ["PORK"], 12, 54, null],
  ["pork-hind-leg", "돼지고기앞다리살", ["돼지고기", "한돈", "돼지뒷다리살"], "MEAT", ["PORK"], 12, 58, null],
  ["pork-minced", "돼지고기다짐육", ["다진돼지고기"], "MEAT", ["PORK"], 12, 58, null],
  ["duck-breast", "오리고기", ["오리가슴살", "생오리"], "MEAT", [], 16, 65, null, { caution: "기름기를 충분히 제거해 조리(훈제오리 아님)" }],
  ["smoked-duck", "훈제오리", [], "MEAT", [], 37, 680, null, { caution: "나트륨·첨가물 함량이 높아 끓는 물에 데쳐 소량만" }],
  ["lamb-lean", "양고기", ["양어깨살"], "MEAT", [], 25, 65, null],
  ["beef-bone-broth-unsalted", "무염사골육수", ["아기사골곰탕", "사골육수"], "MEAT", ["BEEF"], 12, 22, null],
  ["chicken-broth-unsalted", "무염닭육수", ["닭육수"], "MEAT", ["CHICKEN"], 12, 18, null],
  ["vegetable-broth", "채수", ["야채육수", "채소육수"], "VEGETABLE", [], 12, 6, null, { pantry: true }],

  // ================= 5. 수산물·어패류 (SEAFOOD: 24종) =================
  ["cod", "대구살", ["대구", "동태살", "명태살"], "SEAFOOD", [], 12, 75, 100, { caution: "가시를 손으로 꼼꼼히 확인 후 제거" }],
  ["pollock-dried", "황태채", ["북어채", "무염황태가루"], "SEAFOOD", [], 12, 290, null, { caution: "물에 충분히 불려 염분 제거 후 사용" }],
  ["flounder", "가자미살", ["가자미", "광어살"], "SEAFOOD", [], 12, 85, 100],
  ["sea-bream", "도미살", ["참돔살"], "SEAFOOD", [], 12, 78, 100],
  ["croaker", "조기살", ["참조기", "부세조기"], "SEAFOOD", [], 12, 95, 70, { caution: "소금간 되지 않은 생물 조기 사용" }],
  ["hairtail", "갈치살", ["생갈치", "무염갈치"], "SEAFOOD", [], 12, 90, 80, { caution: "잔가시 제거 필수, 무염 갈치만 사용" }],
  ["salmon", "연어", ["생연어(가열조리용)"], "SEAFOOD", [], 12, 59, 100, { caution: "반드시 중심부까지 완전히 익혀 급여" }],
  ["spanish-mackerel", "삼치살", ["무염삼치"], "SEAFOOD", [], 16, 82, 100],
  ["mackerel-unsalted", "무염고등어", ["생고등어살"], "SEAFOOD", ["MACKEREL"], 16, 95, 100],
  ["anchovy-broth", "멸치다시마육수", ["멸치육수"], "SEAFOOD", [], 12, 28, null],
  ["anchovy-low-sodium", "저염잔멸치", ["아기멸치", "지리멸치"], "SEAFOOD", [], 12, 420, null, { caution: "끓는 물에 데쳐 염분을 뺀 뒤 사용 권장" }],
  ["shrimp", "새우살", ["흰다리새우", "새우", "칵테일새우"], "SEAFOOD", ["SHRIMP"], 12, 140, 12],
  ["crab-meat", "게살", ["꽃게살", "대게살"], "SEAFOOD", ["CRAB"], 16, 210, null, { caution: "맛살이 아닌 순수 게살" }],
  ["squid", "오징어", ["물오징어"], "SEAFOOD", ["SQUID"], 25, 150, null, { caution: "질기므로 잘게 다져 어묵/완자 형태로 조리" }],
  ["abalone", "전복살", ["전복"], "SEAFOOD", ["SHELLFISH"], 12, 220, 35, { caution: "이빨·내장 제거 후 잘게 다져 푹 익힘" }],
  ["scallop", "가리비관자", ["관자"], "SEAFOOD", ["SHELLFISH"], 16, 160, 15],
  ["clam-broth", "바지락육수", ["조개육수"], "SEAFOOD", ["SHELLFISH"], 16, 65, null],
  ["clam-meat", "바지락살", ["모시조개살"], "SEAFOOD", ["SHELLFISH"], 16, 190, null],
  ["oyster-cooked", "굴(가열조리)", ["생굴익힌것"], "SEAFOOD", ["SHELLFISH"], 25, 180, 12, { caution: "노로바이러스 예방을 위해 85℃ 이상 1분 이상 완전 가열" }],
  ["mussel", "홍합살", [], "SEAFOOD", ["SHELLFISH"], 16, 200, 8],
  ["tuna-canned-water", "물담금참치캔", ["무염참치"], "SEAFOOD", [], 25, 220, null, { caution: "기름·국물 제거 후 뜨거운 물에 데쳐 사용" }],
  ["raw-fish-sashimi", "생선회", ["횟감", "육회", "날해산물"], "SEAFOOD", [], 49, 80, null, { caution: "식중독·기생충 위험 — 48개월 이하 날음식 금지" }],
  ["salted-pollock-roe", "명란젓", ["젓갈"], "SEAFOOD", [], 49, 2200, null, { salty: true, caution: "고염 젓갈류 — 유아식 금지" }],
  ["dried-kelp-powder", "무염천연조미료가루", ["표고버섯가루", "멸치가루(무염)"], "SEAFOOD", [], 12, 180, null],

  // ================= 6. 알류·유제품 (EGG & DAIRY: 14종) =================
  ["egg", "달걀", ["계란", "유정란", "전란"], "EGG", ["EGG"], 12, 142, 50, { density: 1.03 }],
  ["egg-yolk", "달걀노른자", ["계란노른자", "난황"], "EGG", ["EGG"], 12, 48, 17],
  ["egg-white", "달걀흰자", ["계란흰자", "난백"], "EGG", ["EGG"], 12, 166, 33],
  ["quail-egg", "메추리알", [], "EGG", ["EGG"], 16, 140, 10, { caution: "반드시 반 이상 잘라 급여(통째 급여 시 질식 위험)" }],
  ["raw-egg", "날달걀", ["생달걀"], "EGG", ["EGG"], 49, 142, 50, { caution: "살모넬라균 위험 — 유아에게 날달걀 급여 금지" }],
  ["milk", "우유", ["흰우유", "멸균우유"], "DAIRY", ["MILK"], 12, 45, null, { density: 1.03 }],
  ["soy-milk-unsweetened", "무가당두유", ["순수두유"], "LEGUME_TOFU", ["SOYBEAN"], 12, 25, null, { density: 1.02 }],
  ["plain-yogurt", "플레인요거트", ["무가당요거트", "그릭요거트(무가당)"], "DAIRY", ["MILK"], 12, 46, null],
  ["baby-cheese", "아기치즈", ["유아용저염치즈", "1단계아기치즈"], "DAIRY", ["MILK"], 12, 320, 18, { caution: "1장(18g)당 나트륨 약 55~60mg 기준" }],
  ["mozzarella-fresh", "생모짜렐라치즈", ["신선모짜렐라"], "DAIRY", ["MILK"], 16, 180, 30],
  ["ricotta-cheese", "리코타치즈", [], "DAIRY", ["MILK"], 12, 85, null],
  ["cream-cheese", "크림치즈", [], "DAIRY", ["MILK"], 25, 310, null],
  ["unsalted-butter", "무염버터", ["천연무염버터"], "DAIRY", ["MILK"], 12, 11, null, { density: 0.91 }],
  ["salted-butter", "가염버터", ["일반버터"], "DAIRY", ["MILK"], 25, 640, null, { salty: true, density: 0.91 }],

  // ================= 7. 두류·두부류 (LEGUME_TOFU: 12종) =================
  ["tofu", "두부", ["찌개두부", "부침두부"], "LEGUME_TOFU", ["SOYBEAN"], 12, 7, 300],
  ["soft-tofu", "순두부", ["연두부"], "LEGUME_TOFU", ["SOYBEAN"], 12, 9, 350],
  ["dried-tofu-noodle", "포두부", ["두부면"], "LEGUME_TOFU", ["SOYBEAN"], 16, 120, null],
  ["yuba", "푸주", ["건두부"], "LEGUME_TOFU", ["SOYBEAN"], 16, 35, null],
  ["soybean", "백태", ["메주콩", "노란콩", "불린콩"], "LEGUME_TOFU", ["SOYBEAN"], 12, 2, null],
  ["black-bean", "서리태", ["검은콩", "흑태"], "LEGUME_TOFU", ["SOYBEAN"], 12, 3, null, { caution: "푹 삶아 으깨거나 다져 사용" }],
  ["kidney-bean", "강낭콩", [], "LEGUME_TOFU", [], 12, 4, null],
  ["red-bean", "팥", ["삶은팥(무가당)"], "LEGUME_TOFU", [], 16, 3, null],
  ["chickpea", "병아리콩", ["이집트콩"], "LEGUME_TOFU", [], 12, 7, null, { caution: "푹 삶아 껍질 제거 또는 으깨 사용" }],
  ["lentil", "렌틸콩", ["녹두렌틸콩"], "LEGUME_TOFU", [], 12, 6, null],
  ["mung-bean", "녹두", ["깐녹두"], "LEGUME_TOFU", [], 12, 4, null],
  ["kongbiji", "콩비지", ["비지"], "LEGUME_TOFU", ["SOYBEAN"], 16, 8, null],

  // ================= 8. 견과·종실류 (NUT_SEED: 12종) =================
  ["sesame-powder", "참깨가루", ["깨소금(무염)", "볶은참깨", "통깨"], "NUT_SEED", [], 12, 4, null, { pantry: true }],
  ["black-sesame-powder", "검은깨가루", ["흑임자가루", "흑임자"], "NUT_SEED", [], 12, 4, null],
  ["perilla-seed-powder", "들깨가루", ["기피들깨가루"], "NUT_SEED", [], 12, 3, null],
  ["walnut-powder", "호두가루", ["다진호두"], "NUT_SEED", ["WALNUT"], 16, 2, null, { caution: "덩어리 없는 고운 가루 형태로만 사용" }],
  ["almond-powder", "아몬드가루", [], "NUT_SEED", [], 16, 1, null],
  ["pine-nut-powder", "잣가루", [], "NUT_SEED", ["PINE_NUT"], 16, 2, null],
  ["peanut-butter-100", "무가당땅콩버터", ["100%땅콩버터"], "NUT_SEED", ["PEANUT"], 16, 5, null, { caution: "목 막힘 방지를 위해 묽게 풀어 소량만 급여" }],
  ["sunflower-seed-powder", "해바라기씨가루", [], "NUT_SEED", [], 16, 3, null],
  ["pumpkin-seed-powder", "호박씨가루", [], "NUT_SEED", [], 16, 7, null],
  ["whole-peanut", "통땅콩", ["볶은땅콩"], "NUT_SEED", ["PEANUT"], 49, 6, 1, { caution: "기관지 흡인·질식 위험 1순위 — 48개월 이하 통견과류 금지" }],
  ["whole-walnut", "통호두", ["호두알"], "NUT_SEED", ["WALNUT"], 49, 2, 5, { caution: "통견과류 질식 위험 — 48개월 이하 금지" }],
  ["whole-almond", "통아몬드", [], "NUT_SEED", [], 49, 1, 1.2, { caution: "통견과류 질식 위험 — 48개월 이하 금지" }],

  // ================= 9. 기본 유지·양념·육수 (SEASONING: 21종) =================
  ["water", "물", ["정수물", "생수"], "SEASONING", [], 12, 0, null, { pantry: true, density: 1.0 }],
  ["sesame-oil", "참기름", [], "SEASONING", [], 12, 1, null, { pantry: true, density: 0.92 }],
  ["perilla-oil", "들기름", [], "SEASONING", [], 12, 1, null, { pantry: true, density: 0.93 }],
  ["olive-oil", "올리브유", ["올리브오일", "엑스트라버진올리브유"], "SEASONING", [], 12, 0, null, { pantry: true, density: 0.91 }],
  ["canola-oil", "식용유", ["카놀라유", "해바라기씨유", "포도씨유", "현미유"], "SEASONING", [], 12, 0, null, { pantry: true, density: 0.92 }],
  ["avocado-oil", "아보카도오일", [], "SEASONING", [], 12, 0, null, { density: 0.91 }],
  ["baby-soy-sauce", "아기간장", ["유아용저염간장"], "SEASONING", ["SOYBEAN", "WHEAT"], 16, 2600, null, { salty: true, density: 1.12 }],
  ["soup-soy-sauce", "국간장", ["집간장", "한식간장"], "SEASONING", ["SOYBEAN", "WHEAT"], 16, 5800, null, { salty: true, density: 1.18 }],
  ["brewed-soy-sauce", "양조간장", ["진간장"], "SEASONING", ["SOYBEAN", "WHEAT"], 16, 5400, null, { salty: true, density: 1.16 }],
  ["baby-doenjang", "아기된장", ["저염된장"], "SEASONING", ["SOYBEAN"], 16, 2100, null, { salty: true, density: 1.15 }],
  ["doenjang", "된장", ["재래된장"], "SEASONING", ["SOYBEAN"], 25, 4200, null, { salty: true, density: 1.18 }],
  ["salt", "소금", ["천일염", "꽃소금", "구운소금"], "SEASONING", [], 16, 38758, null, { salty: true, density: 1.2 }],
  ["sugar", "설탕", ["원당", "비정제원당"], "SEASONING", [], 25, 1, null, { density: 0.85, caution: "첨가당 최소화 권장" }],
  ["oligosaccharide", "올리고당", ["쌀조청", "조청"], "SEASONING", [], 25, 5, null, { density: 1.35 }],
  ["honey", "꿀", ["벌꿀", "아카시아꿀"], "SEASONING", [], 13, 4, null, { density: 1.42, caution: "12개월 미만 영아 보툴리누스증 위험 절대 금지(만 1세 이후에도 소량만)" }],
  ["rice-vinegar", "현미식초", ["식초", "사과식초"], "SEASONING", [], 16, 5, null, { density: 1.01 }],
  ["lemon-juice", "레몬즙", [], "SEASONING", [], 12, 1, null, { density: 1.02 }],
  ["ginger-juice", "생강즙", ["생강약간"], "SEASONING", [], 16, 6, null, { density: 1.0 }],
  ["curry-powder-mild", "유아용순한카레가루", ["아기카레가루"], "SEASONING", ["WHEAT", "MILK", "SOYBEAN", "TOMATO", "BEEF"], 16, 1800, null, { salty: true, caution: "복합 향신·조미 분말 — 제품별 알레르기 유발 원재료명 확인 필수" }],
  ["gochujang", "고추장", [], "SEASONING", ["SOYBEAN", "WHEAT"], 49, 2400, null, { salty: true, caution: "자극성·고염 장류 — 48개월 이하 유아식 기본 레시피 금지" }],
  ["chili-powder-spicy", "매운고춧가루", ["청양고춧가루"], "SEASONING", [], 49, 15, null, { caution: "강한 매운맛 위장 자극 — 유아식 금지" }],

  // ================= 10. 가공식품·기타 (PROCESSED: 12종) =================
  ["white-bread", "식빵", ["우유식빵", "통밀식빵"], "PROCESSED", ["WHEAT", "MILK", "EGG"], 12, 420, 35, { caution: "밀·우유·달걀 하위 성분 포함, 테두리 제거 권장" }],
  ["morning-roll", "모닝빵", [], "PROCESSED", ["WHEAT", "MILK", "EGG"], 16, 380, 32],
  ["rice-puff-unsalted", "무염떡뻥", ["쌀과자(무염)"], "PROCESSED", [], 12, 5, 3],
  ["fish-cake-white", "흰살생선어묵", ["유아용어묵", "어묵"], "PROCESSED", ["WHEAT", "EGG", "SOYBEAN", "SHRIMP", "CRAB"], 25, 650, 35, { salty: true, caution: "끓는 물에 데쳐 염분·첨가물을 빼고 갑각류(새우·게) 혼입 여부 확인" }],
  ["mayonnaise", "마요네즈", [], "PROCESSED", ["EGG", "SOYBEAN"], 25, 580, null, { salty: true, density: 0.92 }],
  ["tomato-paste-unsalted", "무염토마토페이스트", ["홀토마토으깬것", "토마토퓨레"], "PROCESSED", ["TOMATO"], 12, 25, null, { density: 1.05 }],
  ["ketchup-reduced", "저당저염케첩", ["토마토케첩"], "PROCESSED", ["TOMATO"], 25, 680, null, { salty: true, density: 1.12 }],
  ["breadcrumbs", "빵가루", ["습식빵가루"], "PROCESSED", ["WHEAT", "MILK", "EGG", "SOYBEAN"], 16, 390, null],
  ["fried-tofu-pouch", "유부", ["조미유부데친것"], "PROCESSED", ["SOYBEAN", "WHEAT"], 25, 420, 10, { salty: true, caution: "끓는 물에 데쳐 물기를 꼭 짜서 사용" }],
  ["dumpling-wrapper", "만두피", [], "PROCESSED", ["WHEAT"], 16, 410, 8],
  ["chocolate", "초콜릿", ["코코아가루(가당)"], "PROCESSED", ["MILK", "SOYBEAN"], 49, 80, null, { caution: "카페인·고당류 — 유아식 간식 금지" }],
  ["caffeinated-drink", "커피·홍차류", ["녹차가루(고카페인)", "홍차"], "PROCESSED", [], 49, 5, null, { caution: "카페인 함유 — 영유아 섭취 금지" }],
];

export const SEED_INGREDIENTS: SeedIngredient[] = ROWS.map(
  ([slug, name, synonyms, group, allergens, minAgeMonth, sodiumMgPer100g, gramsPerPiece, opts]) => ({
    slug,
    name,
    synonyms,
    group,
    allergens,
    isPantryBasic: opts?.pantry ?? false,
    isSaltySeasoning: opts?.salty ?? false,
    minAgeMonth,
    sodiumMgPer100g,
    gramsPerPiece: gramsPerPiece ?? null,
    densityGPerMl: opts?.density ?? 1.0,
    cautionNote: opts?.caution ?? null,
  }),
);
