import { type NextRequest, NextResponse } from "next/server";
import { getActiveBabyIdCookie, requireApiUser } from "@/features/auth";
import { searchIngredientsForBaby } from "@/features/ingredient-search";
import { resolveActiveBabyProfile } from "@/features/profile";
import { getPrisma } from "@/lib/db";
import { normalizeIngredientName } from "@/lib/safety";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const babyId = request.nextUrl.searchParams.get("babyId");
    const mode = request.nextUrl.searchParams.get("mode");

    // 온보딩 중 알레르기 직접 입력 자동완성(mode=allergy)은 아직 아기 프로필이 없거나 전체 식재료를 검색해야 함
    if (mode === "allergy") {
      const prisma = getPrisma();
      const rows = await prisma.ingredient.findMany({
        where: { minAgeMonth: { lte: 48 } },
        orderBy: { name: "asc" },
      });
      const norm = normalizeIngredientName(q);
      const filtered = norm
        ? rows.filter(
            (r) =>
              normalizeIngredientName(r.name).includes(norm) ||
              r.synonyms.some((s) => normalizeIngredientName(s).includes(norm)),
          )
        : rows;

      return NextResponse.json({
        results: filtered.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          synonyms: r.synonyms,
          isPantryBasic: r.isPantryBasic,
        })),
        popularChips: [],
      });
    }

    const cookieBabyId = await getActiveBabyIdCookie();
    const baby = await resolveActiveBabyProfile(user.id, {
      explicitBabyId: babyId,
      cookieBabyId,
    });
    if (!baby) {
      return NextResponse.json({ results: [], popularChips: [] });
    }

    const data = await searchIngredientsForBaby(baby, q);
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error, "GET /api/ingredients");
  }
}
