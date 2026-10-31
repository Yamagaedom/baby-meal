/**
 * 웹·유튜브 출처 검색 및 신뢰도 점수 산정 (PRD 3.9 AI-01, AI-02, 7장 저작권)
 *
 * 원칙:
 * - 웹페이지 본문 크롤링 및 유튜브 영상/썸네일 다운로드 절대 금지
 * - 공식 API 응답에서 URL, 제목, 채널/사이트명만 수집
 * - 신뢰도 점수: 공공기관(.go.kr, 식약처, 식품안전나라 등) > 유아식·영양 전문 채널/사이트 > 일반 자료 + 조회수 보정
 */
import { getAgeStageInfo } from "@/lib/age";
import type { AgeStage, SaltLevel } from "@/lib/domain/types";
import type { AiSearchProvider, AiSearchQueryInput, CollectedSource, SourceTypeLiteral } from "./types";

const PUBLIC_INSTITUTION_PATTERNS = [
  /\.go\.kr/i,
  /foodsafetykorea/i,
  /식품안전나라/,
  /식품의약품안전처/,
  /식약처/,
  /질병관리청/,
  /보건소/,
  /육아종합지원센터/,
  /대한영양사협회/,
  /대한소아청소년과학회/,
  /농촌진흥청/,
];

const SPECIALIST_BABY_FOOD_PATTERNS = [
  /유아식/,
  /이유식/,
  /아기밥/,
  /아기반찬/,
  /아기간식/,
  /맘마/,
  /소아과/,
  /영양사/,
  /육아/,
];

export function classifySourceType(url: string, channelOrSite: string, title: string): SourceTypeLiteral {
  const combined = `${url} ${channelOrSite} ${title}`;
  if (/youtube\.com|youtu\.be/i.test(url)) {
    return "YOUTUBE";
  }
  if (PUBLIC_INSTITUTION_PATTERNS.some((re) => re.test(combined))) {
    return "PUBLIC_INSTITUTION";
  }
  return "WEB";
}

/**
 * AI-02: 출처 신뢰도 점수 계산 (0.0 ~ 1.0)
 * - 공공기관: 기본 0.92
 * - 유아식·영양 전문 채널/사이트: 기본 0.75
 * - 일반 채널/웹: 기본 0.50
 * - 조회수 보정: log10(viewCount) 비례 최대 +0.08 가산 (상한 1.0)
 */
export function computeSourceTrustScore(input: {
  url: string;
  title: string;
  channelOrSite: string;
  sourceType?: SourceTypeLiteral;
  viewCount?: number;
}): number {
  const combined = `${input.url} ${input.channelOrSite} ${input.title}`;
  const isPublic =
    input.sourceType === "PUBLIC_INSTITUTION" ||
    PUBLIC_INSTITUTION_PATTERNS.some((re) => re.test(combined));
  const isSpecialist = SPECIALIST_BABY_FOOD_PATTERNS.some((re) => re.test(combined));

  let score = 0.5;
  if (isPublic) {
    score = 0.92;
  } else if (isSpecialist) {
    score = 0.75;
  }

  if (input.viewCount && input.viewCount > 0) {
    // 1,000회 → +0.03, 100,000회 → +0.06, 1,000,000회+ → +0.08
    const bonus = Math.min(0.08, Math.max(0, (Math.log10(input.viewCount) - 2) * 0.02));
    score += bonus;
  }

  return Math.round(Math.min(1, score) * 100) / 100;
}

export function buildToddlerSearchQuery(
  topicOrIngredients: string,
  ageStage: AgeStage,
  saltLevel: SaltLevel,
): string {
  const stageLabel = getAgeStageInfo(ageStage).label.split("(")[0].trim();
  const saltKeyword = saltLevel === "NONE" ? "무염" : saltLevel === "LOW" ? "저염" : "아기";
  return `${topicOrIngredients} ${saltKeyword} 유아식 ${stageLabel}`.trim();
}

/**
 * 공식 YouTube Data API v3 검색 프로바이더 (AI-01)
 * - YOUTUBE_API_KEY가 없으면 빈 배열을 반환하고 Gemini Google 검색 그라운딩에 위임한다.
 * - 썸네일 이미지나 자막·영상 본문은 수집하지 않는다.
 */
export class YouTubeDataApiSearchProvider implements AiSearchProvider {
  constructor(private readonly apiKey: string | undefined = process.env.YOUTUBE_API_KEY) {}

  async searchSources(input: AiSearchQueryInput): Promise<CollectedSource[]> {
    const key = this.apiKey?.trim();
    if (!key) {
      return [];
    }

    const searchQuery = buildToddlerSearchQuery(input.queryText, input.ageStage, input.saltLevel);
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("safeSearch", "strict");
    searchUrl.searchParams.set("relevanceLanguage", "ko");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("q", searchQuery);
    searchUrl.searchParams.set("key", key);

    const searchRes = await fetch(searchUrl.toString(), { signal: input.signal });
    if (!searchRes.ok) {
      return [];
    }

    const searchJson = (await searchRes.json()) as {
      items?: {
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string };
      }[];
    };

    const items = (searchJson.items ?? []).filter(
      (it) => Boolean(it.id?.videoId) && Boolean(it.snippet?.title),
    );
    if (items.length === 0) {
      return [];
    }

    const videoIds = items.map((it) => it.id!.videoId!);
    const viewCounts = new Map<string, number>();

    try {
      const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      statsUrl.searchParams.set("part", "statistics");
      statsUrl.searchParams.set("id", videoIds.join(","));
      statsUrl.searchParams.set("key", key);
      const statsRes = await fetch(statsUrl.toString(), { signal: input.signal });
      if (statsRes.ok) {
        const statsJson = (await statsRes.json()) as {
          items?: { id?: string; statistics?: { viewCount?: string } }[];
        };
        for (const st of statsJson.items ?? []) {
          if (st.id && st.statistics?.viewCount) {
            const parsed = Number(st.statistics.viewCount);
            if (Number.isFinite(parsed)) {
              viewCounts.set(st.id, parsed);
            }
          }
        }
      }
    } catch {
      // 조회수 부가 조회 실패는 무시하고 기본 신뢰도 점수 사용
    }

    const collected: CollectedSource[] = items.map((it) => {
      const videoId = it.id!.videoId!;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const title = it.snippet!.title!.trim();
      const channelOrSite = (it.snippet?.channelTitle ?? "YouTube").trim();
      const viewCount = viewCounts.get(videoId);
      const trustScore = computeSourceTrustScore({
        url,
        title,
        channelOrSite,
        sourceType: "YOUTUBE",
        viewCount,
      });

      return {
        url,
        title,
        channelOrSite,
        sourceType: "YOUTUBE",
        viewCount,
        trustScore,
      };
    });

    return collected.sort((a, b) => b.trustScore - a.trustScore);
  }
}

/** Gemini 응답의 groundingMetadata에서 공식 웹 출처 메타데이터만 추출 (원문/이미지 미수집) */
export function extractGeminiGroundingSources(groundingMetadata: unknown): CollectedSource[] {
  if (!groundingMetadata || typeof groundingMetadata !== "object") {
    return [];
  }

  const chunks = (
    groundingMetadata as {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    }
  ).groundingChunks;

  if (!Array.isArray(chunks)) {
    return [];
  }

  const seenUrls = new Set<string>();
  const out: CollectedSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri?.trim();
    const title = chunk?.web?.title?.trim();
    if (!uri || !title || !/^https?:\/\//i.test(uri) || seenUrls.has(uri)) {
      continue;
    }
    seenUrls.add(uri);

    let host = "웹 자료";
    try {
      host = new URL(uri).hostname.replace(/^www\./, "");
    } catch {
      host = "웹 자료";
    }

    const sourceType = classifySourceType(uri, host, title);
    const trustScore = computeSourceTrustScore({
      url: uri,
      title,
      channelOrSite: host,
      sourceType,
    });

    out.push({
      url: uri,
      title,
      channelOrSite: host,
      sourceType,
      trustScore,
    });
  }

  return out.sort((a, b) => b.trustScore - a.trustScore);
}

/** 중복 URL 제거 및 신뢰도 점수 순 상위 N개 선별 */
export function mergeAndRankSources(
  groups: readonly (readonly CollectedSource[])[],
  maxCount: number = 5,
): CollectedSource[] {
  const byUrl = new Map<string, CollectedSource>();
  for (const list of groups) {
    for (const src of list) {
      const trimmedUrl = src.url.trim();
      if (!/^https?:\/\//i.test(trimmedUrl) || !src.title.trim()) continue;
      const existing = byUrl.get(trimmedUrl);
      if (!existing || src.trustScore > existing.trustScore) {
        byUrl.set(trimmedUrl, {
          ...src,
          url: trimmedUrl,
          title: src.title.trim(),
          channelOrSite: src.channelOrSite.trim() || "참고 자료",
        });
      }
    }
  }

  return Array.from(byUrl.values())
    .sort((a, b) => b.trustScore - a.trustScore)
    .slice(0, maxCount);
}
