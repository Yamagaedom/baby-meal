import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { createMealLogForBaby, getMealLogsForBaby } from "@/features/meal-log";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const sp = request.nextUrl.searchParams;
    const baby = await requireActiveBabyForApi(user.id, sp.get("babyId"));
    const yearMonth = sp.get("yearMonth") ?? undefined;

    const data = await getMealLogsForBaby(baby, { yearMonth });
    return NextResponse.json({ baby, ...data });
  } catch (error) {
    return toErrorResponse(error, "GET /api/meal-logs");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body?.babyId ?? null);

    const result = await createMealLogForBaby(baby, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/meal-logs");
  }
}
