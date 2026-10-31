import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { removeBabyAllergyItem } from "@/features/profile";
import { toErrorResponse } from "@/lib/http/errors";

interface RouteContext {
  params: Promise<{ babyId: string; allergyId: string }>;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { babyId, allergyId } = await context.params;
    await removeBabyAllergyItem(user.id, babyId, allergyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/babies/[babyId]/allergies/[allergyId]");
  }
}
