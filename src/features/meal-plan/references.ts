/** 2025 KDRI summary, PDF pages 13, 19, 20 (printed xiv/xix/xx).
 * Protein/calcium/iron are RNI; sodium is AI, not an upper limit.
 * Reference numbers describe a full day, not one recipe or a diagnosis.
 */
export const NUTRITION_REFERENCE_SOURCE =
  "https://health.seoulmc.or.kr/uploadFiles/2025_%ED%95%9C%EA%B5%AD%EC%9D%B8%EC%98%81%EC%96%91%EC%86%8C%EC%84%AD%EC%B7%A8%EA%B8%B0%EC%A4%80_%ED%99%9C%EC%9A%A9.pdf";
export function nutritionReference(ageMonth: number) {
  if (ageMonth < 12 || ageMonth > 71) return null;
  return {
    version: "2025 KDRI",
    ageLabel: ageMonth < 36 ? "1~2세" : "3~5세",
    protein: ageMonth < 36 ? 20 : 25,
    calcium: ageMonth < 36 ? 450 : 550,
    iron: 6,
    sodium: ageMonth < 36 ? 630 : 1000,
  };
}
