import { type NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, resetPasswordWithRecoveryCode } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await resetPasswordWithRecoveryCode(body);
    await clearAuthCookies();

    return NextResponse.json({ newRecoveryCode: result.newRecoveryCode });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/reset-password");
  }
}
