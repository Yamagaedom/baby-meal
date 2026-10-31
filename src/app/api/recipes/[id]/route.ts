import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { getRecipeDetailForBaby } from "@/features/recipe";
import { toErrorResponse } from "@/lib/http/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const sp = request.nextUrl.searchParams;
    const baby = await requireActiveBabyForApi(user.id, sp.get("babyId"));

    const servingsParam = sp.get("servings");
    const requestedServings = servingsParam ? Number(servingsParam) : undefined;

    const recipe = await getRecipeDetailForBaby(user.id, baby, id, requestedServings);
    return NextResponse.json({ baby, recipe });
  } catch (error) {
    return toErrorResponse(error, "GET /api/recipes/[id]");
  }
}
