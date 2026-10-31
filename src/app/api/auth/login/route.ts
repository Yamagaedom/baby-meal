import { type NextRequest, NextResponse } from "next/server";
import { loginUser, setSessionCookie } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await loginUser(body);

    await setSessionCookie(result.sessionToken, result.expiresAt, result.rememberMe);

    return NextResponse.json({ user: result.user });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/login");
  }
}
