import { describe, expect, it } from "vitest";
import {
  normalizeRecipeSummary,
  sourceDisplayLabel,
  uniqueMenuSuggestions,
  withParticle,
  withWaGwa,
} from "@/lib/presentation";

describe("UI 검토서의 메뉴 중복, 조사, 출처 표시 회귀", () => {
  it("받침에 맞춰 와/과 및 이/가를 선택한다", () => {
    expect(withWaGwa("두부")).toBe("두부와");
    expect(withWaGwa("단호박")).toBe("단호박과");
    expect(withParticle("도담", "이", "가")).toBe("도담이");
    expect(withParticle("호랑이", "이", "가")).toBe("호랑이가");
  });

  it("기존 요약의 알려진 재료 조사만 바꾸고 일반 단어와 원문을 보존한다", () => {
    expect(normalizeRecipeSummary("두부과 애호박, 단호박와 단감의 조화", ["두부", "단호박"])).toBe(
      "두부와 애호박, 단호박과 단감의 조화",
    );
    expect(normalizeRecipeSummary("효과 좋은 조리법", ["당근"])).toBe("효과 좋은 조리법");
    expect(normalizeRecipeSummary(null, ["두부"])).toBeNull();
  });

  it("ID가 다른 동일 메뉴는 최고 순위만 남기고 서로 다른 분류는 보존한다", () => {
    const items = [
      { id: "a", name: "기장 영양진밥", category: "MEAL" },
      { id: "b", name: "기장영양진밥", category: "MEAL" },
      { id: "c", name: "기장영양진밥", category: "SNACK" },
      { id: "d", name: "감자수프", category: "MEAL" },
    ];
    expect(uniqueMenuSuggestions(items).map((item) => item.id)).toEqual(["a", "c", "d"]);
    expect(items).toHaveLength(4);
  });

  it("예시 출처 문구를 정리하되 검증된 채널로 표시하지 않고 링크를 유지한다", () => {
    const source = {
      title: "[시드 샘플] 아기 무른밥",
      channelOrSite: "유아식샘플채널",
      url: "https://www.youtube.com/watch?v=example",
    };
    expect(sourceDisplayLabel(source)).toEqual({
      title: "아기 무른밥",
      publisher: "YouTube",
      isExample: true,
    });
    expect(source.title).toBe("[시드 샘플] 아기 무른밥");
    expect(
      sourceDisplayLabel({
        title: "식생활 안내",
        channelOrSite: "식품안전나라",
        url: "https://www.foodsafetykorea.go.kr",
      }),
    ).toEqual({ title: "식생활 안내", publisher: "식품안전나라", isExample: false });
  });
});
