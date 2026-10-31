import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { createPlan, getPlannerData } from "@/features/meal-plan/service";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const baby = await requireActiveBabyForApi(user.id, request.nextUrl.searchParams.get("babyId"));
    return NextResponse.json(await getPlannerData(user.id, baby), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/meal-plans");
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body.babyId);
    return NextResponse.json(await createPlan(user.id, baby, body.preferences), { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/meal-plans");
  }
}
