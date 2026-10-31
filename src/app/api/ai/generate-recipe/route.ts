import { type NextRequest, NextResponse } from "next/server";
import { generateOnDemandRecipeForBaby } from "@/features/ai-generation";
import { requireApiUser } from "@/features/auth";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

function isLoopbackRequest(request: NextRequest): boolean {
  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.hostname;
  const normalized = rawHost.toLowerCase().replace(/:\d+$/, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

// Vercel Serverless Function 실행 시간 상한 (AI 생성 20초 타임아웃 보장)
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body?.babyId ?? null);

    // 프로덕션 외부 도메인에서는 AI_E2E_MOCK_MODE가 실수로 설정되어 있어도 모킹 및 한도 오버라이드를 절대 허용하지 않음
    const allowE2eMock =
      (process.env.AI_E2E_MOCK_MODE === "1" &&
        (process.env.NODE_ENV !== "production" || isLoopbackRequest(request))) ||
      (process.env.NODE_ENV !== "production" && process.env.AI_MOCK_MODE === "1");

    const mockBehavior = allowE2eMock ? request.headers.get("x-ai-mock-behavior") : null;

    const globalLimitHeader = allowE2eMock ? request.headers.get("x-ai-mock-global-limit") : null;
    const globalLimitOverride =
      globalLimitHeader !== null && globalLimitHeader !== ""
        ? Number(globalLimitHeader)
        : undefined;

    const result = await generateOnDemandRecipeForBaby(user.id, baby, body, {
      allowE2eMock,
      mockBehavior,
      globalLimitOverride,
    });

    return NextResponse.json(result, { status: result.cached ? 200 : 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/ai/generate-recipe");
  }
}
