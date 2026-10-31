import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { getTodayRecommendations } from "@/features/recommend";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const babyId = request.nextUrl.searchParams.get("babyId");
    const seed = request.nextUrl.searchParams.get("seed") ?? undefined;
    const baby = await requireActiveBabyForApi(user.id, babyId);

    const data = await getTodayRecommendations(user.id, baby, { seed });
    return NextResponse.json({ baby, ...data });
  } catch (error) {
    return toErrorResponse(error, "GET /api/recommend/today");
  }
}
