import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, clearAuthCookies, logoutSession } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await logoutSession(rawToken);
    await clearAuthCookies();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/logout");
  }
}
