import { type NextRequest, NextResponse } from "next/server";
import { getActiveBabyIdCookie, requireApiUser } from "@/features/auth";
import { listPantryItemsForUser, saveUserPantryItems } from "@/features/pantry";
import { resolveActiveBabyProfile } from "@/features/profile";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const babyId = request.nextUrl.searchParams.get("babyId");
    const cookieBabyId = await getActiveBabyIdCookie();
    const baby = await resolveActiveBabyProfile(user.id, {
      explicitBabyId: babyId,
      cookieBabyId,
    });

    const items = await listPantryItemsForUser(user.id, baby);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error, "GET /api/pantry");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const result = await saveUserPantryItems(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "PUT /api/pantry");
  }
}
