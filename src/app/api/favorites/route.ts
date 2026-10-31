import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/features/auth";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toggleRecipeFavorite } from "@/features/recommend";
import { toErrorResponse } from "@/lib/http/errors";

const favoriteInputSchema = z.object({
  recipeId: z.string().uuid(),
  babyId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = favoriteInputSchema.parse(await request.json());
    const baby = await requireActiveBabyForApi(user.id, body.babyId ?? null);

    const result = await toggleRecipeFavorite(user.id, baby, body.recipeId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "POST /api/favorites");
  }
}
