import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { isValidUuid } from "@/lib/validation";
import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1, "별점은 최소 1점 이상이어야 합니다.").max(5, "별점은 최대 5점까지 가능합니다."),
  content: z
    .string()
    .trim()
    .min(5, "후기 내용은 최소 5자 이상 작성해 주세요.")
    .max(500, "후기 내용은 최대 500자까지 작성할 수 있습니다."),
  babyAgeMonth: z.number().int().min(12).max(48).nullable().optional(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export interface RecipeReviewView {
  id: string;
  recipeId: string;
  authorName: string;
  rating: number;
  content: string;
  babyAgeMonth: number | null;
  createdAt: string;
  isMyReview: boolean;
}

export interface RecipeReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingCounts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface RecipeReviewsResult {
  stats: RecipeReviewStats;
  reviews: RecipeReviewView[];
}

export function formatAuthorName(babyNickname?: string | null, loginId?: string | null): string {
  if (babyNickname && babyNickname.trim().length > 0) {
    const trimmed = babyNickname.trim();
    return `${trimmed} 부모님`;
  }
  if (loginId && loginId.trim().length > 0) {
    const trimmed = loginId.trim();
    if (trimmed.length <= 3) return `${trimmed}***`;
    return `${trimmed.slice(0, 3)}***`;
  }
  return "튼튼이 부모님";
}

export async function getRecipeReviews(
  recipeId: string,
  currentUserId?: string | null,
  prisma: PrismaClient = getPrisma(),
): Promise<RecipeReviewsResult> {
  if (!isValidUuid(recipeId)) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const [reviews, statsAgg, countRows] = await Promise.all([
    prisma.recipeReview.findMany({
      where: { recipeId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        recipeId: true,
        userId: true,
        authorName: true,
        rating: true,
        content: true,
        babyAgeMonth: true,
        createdAt: true,
      },
    }),
    prisma.recipeReview.aggregate({
      where: { recipeId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.recipeReview.groupBy({
      by: ["rating"],
      where: { recipeId },
      _count: { rating: true },
    }),
  ]);

  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of countRows) {
    const r = row.rating as 1 | 2 | 3 | 4 | 5;
    if (r >= 1 && r <= 5) {
      ratingCounts[r] = row._count.rating;
    }
  }

  const rawAvg = statsAgg._avg.rating ?? 0;
  const averageRating = rawAvg > 0 ? Math.round(rawAvg * 10) / 10 : 0;
  const totalReviews = statsAgg._count.rating ?? 0;

  const mappedReviews: RecipeReviewView[] = reviews.map((r) => ({
    id: r.id,
    recipeId: r.recipeId,
    authorName: r.authorName,
    rating: r.rating,
    content: r.content,
    babyAgeMonth: r.babyAgeMonth,
    createdAt: r.createdAt.toISOString(),
    isMyReview: currentUserId ? r.userId === currentUserId : false,
  }));

  return {
    stats: {
      averageRating,
      totalReviews,
      ratingCounts,
    },
    reviews: mappedReviews,
  };
}

export async function upsertRecipeReview(
  recipeId: string,
  userId: string,
  authorName: string,
  input: ReviewInput,
  prisma: PrismaClient = getPrisma(),
): Promise<RecipeReviewView> {
  if (!isValidUuid(recipeId)) {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, status: true },
  });

  if (!recipe || recipe.status !== "ACTIVE") {
    throw new AppError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
  }

  const valid = reviewInputSchema.parse(input);

  const saved = await prisma.recipeReview.upsert({
    where: {
      recipeId_userId: { recipeId, userId },
    },
    update: {
      authorName,
      rating: valid.rating,
      content: valid.content,
      babyAgeMonth: valid.babyAgeMonth ?? null,
    },
    create: {
      recipeId,
      userId,
      authorName,
      rating: valid.rating,
      content: valid.content,
      babyAgeMonth: valid.babyAgeMonth ?? null,
    },
  });

  // 레시피 통계 갱신
  const stats = await prisma.recipeReview.aggregate({
    where: { recipeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const averageRating = stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0;
  const reviewCount = stats._count.rating ?? 0;

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { averageRating, reviewCount },
  });

  return {
    id: saved.id,
    recipeId: saved.recipeId,
    authorName: saved.authorName,
    rating: saved.rating,
    content: saved.content,
    babyAgeMonth: saved.babyAgeMonth,
    createdAt: saved.createdAt.toISOString(),
    isMyReview: true,
  };
}

export async function deleteRecipeReview(
  recipeId: string,
  reviewId: string,
  userId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<{ success: boolean }> {
  if (!isValidUuid(recipeId) || !isValidUuid(reviewId)) {
    throw new AppError(404, "REVIEW_NOT_FOUND", "후기를 찾을 수 없습니다.");
  }

  const review = await prisma.recipeReview.findUnique({
    where: { id: reviewId },
    select: { id: true, recipeId: true, userId: true },
  });

  if (!review || review.recipeId !== recipeId) {
    throw new AppError(404, "REVIEW_NOT_FOUND", "후기를 찾을 수 없습니다.");
  }

  if (review.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "본인이 작성한 후기만 삭제할 수 있습니다.");
  }

  await prisma.recipeReview.delete({
    where: { id: reviewId },
  });

  // 레시피 통계 갱신
  const stats = await prisma.recipeReview.aggregate({
    where: { recipeId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const averageRating = stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0;
  const reviewCount = stats._count.rating ?? 0;

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { averageRating, reviewCount },
  });

  return { success: true };
}
