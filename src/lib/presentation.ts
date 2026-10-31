/** 한글 받침을 기준으로 조사 선택. 알 수 없는 표기는 모음형을 기본으로 둡니다. */
export function withParticle(word: string, consonant: string, vowel: string): string {
  const text = word.trimEnd();
  const last = text.codePointAt(text.length - 1) ?? 0;
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${text}${hasFinal ? consonant : vowel}`;
}

export function withWaGwa(word: string): string {
  return withParticle(word, "과", "와");
}

/** 알려진 식재료 바로 뒤의 조사만 교정해 '효과' 같은 일반 단어를 보존합니다. */
export function normalizeRecipeSummary(
  summary: string | null,
  ingredientNames: readonly string[],
): string | null {
  if (!summary) return summary;
  let result = summary;
  for (const name of [...ingredientNames].sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`${escaped}(?:와|과)(?=\\s)`, "g"), withWaGwa(name));
  }
  return result;
}

/** ID가 달라도 이름이 같은 메뉴가 홈 추천에 반복되지 않도록 순위를 유지하며 정리합니다. */
export function uniqueMenuSuggestions<T extends { name: string; category: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.name.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("ko")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 예시 출처를 검증된 채널로 포장하지 않고 실제 목적지와 참고 성격을 표시합니다. */
export function sourceDisplayLabel(source: { title: string; channelOrSite: string; url: string }) {
  const isExample = /시드|샘플/.test(`${source.title} ${source.channelOrSite}`);
  const title = source.title.replace(/\[(?:시드\s*)?샘플\]\s*/g, "").trim();
  if (!isExample) return { title, publisher: source.channelOrSite, isExample: false };
  let publisher = "참고 자료";
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, "");
    publisher = host === "youtube.com" ? "YouTube" : host;
  } catch {
    /* 원본 링크는 그대로 두고 표시만 정리합니다. */
  }
  return { title, publisher, isExample: true };
}
