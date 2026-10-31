import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { deductUserPantryItems } from "@/features/pantry";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const result = await deductUserPantryItems(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "POST /api/pantry/deduct");
  }
}
