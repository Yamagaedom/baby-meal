import { type NextRequest, NextResponse } from "next/server";
import { checkSignupRateLimit, setSessionCookie, signupUser } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "local";
    checkSignupRateLimit(ip);

    const body = await request.json();
    const result = await signupUser(body);

    await setSessionCookie(result.sessionToken, result.expiresAt, false);

    return NextResponse.json(
      {
        user: result.user,
        recoveryCode: result.recoveryCode,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/signup");
  }
}
