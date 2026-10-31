import { type NextRequest, NextResponse } from "next/server";
import {
  getActiveBabyIdCookie,
  requireApiUser,
  setActiveBabyIdCookie,
} from "@/features/auth";
import {
  deleteBabyProfile,
  getOwnedBabyOrThrow,
  listBabyProfiles,
  updateBabyProfile,
} from "@/features/profile";
import { toErrorResponse } from "@/lib/http/errors";

interface RouteContext {
  params: Promise<{ babyId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { babyId } = await context.params;
    const baby = await getOwnedBabyOrThrow(user.id, babyId);
    return NextResponse.json({ baby });
  } catch (error) {
    return toErrorResponse(error, "GET /api/babies/[babyId]");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { babyId } = await context.params;
    const body = await request.json();
    const result = await updateBabyProfile(user.id, babyId, body);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/babies/[babyId]");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { babyId } = await context.params;
    await deleteBabyProfile(user.id, babyId);
    const activeCookieBabyId = await getActiveBabyIdCookie();
    if (activeCookieBabyId === babyId) {
      const remaining = await listBabyProfiles(user.id);
      if (remaining[0]) {
        await setActiveBabyIdCookie(remaining[0].id);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/babies/[babyId]");
  }
}
