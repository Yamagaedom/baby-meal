import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { recommendRecipesByIngredients } from "@/features/ingredient-search";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body?.babyId ?? null);

    const data = await recommendRecipesByIngredients(user.id, baby, body);
    return NextResponse.json({ baby, ...data });
  } catch (error) {
    return toErrorResponse(error, "POST /api/recommend/by-ingredients");
  }
}
