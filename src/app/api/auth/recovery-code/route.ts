import { type NextRequest, NextResponse } from "next/server";
import { reissueRecoveryCode, requireApiUser } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const result = await reissueRecoveryCode(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/recovery-code");
  }
}
