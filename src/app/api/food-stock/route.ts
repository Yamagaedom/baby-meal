import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { addStock, moveStock } from "@/features/meal-plan/service";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body.babyId);
    return NextResponse.json(await addStock(user.id, baby, body), { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/food-stock");
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await moveStock(user.id, await request.json()));
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/food-stock");
  }
}
