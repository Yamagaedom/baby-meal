import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { searchRecipesForBaby } from "@/features/recommend";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const sp = request.nextUrl.searchParams;
    const baby = await requireActiveBabyForApi(user.id, sp.get("babyId"));

    const stageParam = sp.get("stage");
    const items = await searchRecipesForBaby(user.id, baby, {
      category: sp.get("category") || undefined,
      maxCookMinutes: sp.get("maxCookMinutes") || undefined,
      tool: sp.get("tool") || undefined,
      ingredientGroup: sp.get("ingredientGroup") || undefined,
      stage: stageParam ? Number(stageParam) : undefined,
      saltLevel: sp.get("saltLevel") || undefined,
      favoritesOnly: sp.get("favoritesOnly") === "true",
      query: sp.get("q") || undefined,
    });

    return NextResponse.json({ baby, items });
  } catch (error) {
    return toErrorResponse(error, "GET /api/recipes");
  }
}
