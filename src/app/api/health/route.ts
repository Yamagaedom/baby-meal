import { NextResponse, connection } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  await connection();

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    const [ingredientCount, recipeCount] = await Promise.all([
      prisma.ingredient.count(),
      prisma.recipe.count(),
    ]);

    return NextResponse.json({
      status: "ok",
      db: "connected",
      counts: {
        ingredients: ingredientCount,
        recipes: recipeCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[/api/health] DB 연결 확인 실패:", error);
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        message: "데이터베이스에 연결할 수 없습니다.",
      },
      { status: 503 },
    );
  }
}
