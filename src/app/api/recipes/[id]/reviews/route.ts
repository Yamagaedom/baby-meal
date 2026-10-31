import { type NextRequest, NextResponse } from "next/server";
import { getActiveBabyIdCookie, getSessionUserFromCookies, requireApiUser } from "@/features/auth";
import { resolveActiveBabyProfile } from "@/features/profile";
import {
  deleteRecipeReview,
  formatAuthorName,
  getRecipeReviews,
  reviewInputSchema,
  upsertRecipeReview,
} from "@/features/reviews";
import { toErrorResponse } from "@/lib/http/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recipes/[id]/reviews
 * 레시피의 솔직 후기 목록 및 통계(평균 별점, 별점 분포) 조회 (공개 API)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: recipeId } = await params;
    const sessionUser = await getSessionUserFromCookies();
    const result = await getRecipeReviews(recipeId, sessionUser?.id ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "GET /api/recipes/[id]/reviews");
  }
}

/**
 * POST /api/recipes/[id]/reviews
 * 레시피 후기 및 별점 등록 (로그인 유저 전용, 1인 1후기 upsert)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: recipeId } = await params;
    const user = await requireApiUser();
    const body = await request.json();

    const cookieBabyId = await getActiveBabyIdCookie();
    const activeBaby = await resolveActiveBabyProfile(user.id, { cookieBabyId });

    const authorName = formatAuthorName(activeBaby?.nickname, user.loginId);
    const parsedInput = reviewInputSchema.parse({
      ...body,
      babyAgeMonth: body.babyAgeMonth ?? activeBaby?.currentAgeMonth ?? null,
    });

    const review = await upsertRecipeReview(recipeId, user.id, authorName, parsedInput);
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/recipes/[id]/reviews");
  }
}

/**
 * DELETE /api/recipes/[id]/reviews
 * 본인 작성 후기 삭제 (로그인 유저 전용)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: recipeId } = await params;
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");

    if (!reviewId) {
      return NextResponse.json({ message: "reviewId가 필요합니다." }, { status: 400 });
    }

    const result = await deleteRecipeReview(recipeId, reviewId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/recipes/[id]/reviews");
  }
}
