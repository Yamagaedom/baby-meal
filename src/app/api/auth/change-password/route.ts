import { type NextRequest, NextResponse } from "next/server";
import {
  changePassword,
  getRawSessionTokenFromCookies,
  requireApiUser,
} from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const currentSessionToken = await getRawSessionTokenFromCookies();
    const body = await request.json();
    await changePassword(user.id, body, undefined, currentSessionToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/change-password");
  }
}
