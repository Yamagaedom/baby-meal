import { type NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, deleteAccount, requireApiUser } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    await deleteAccount(user.id, body);
    await clearAuthCookies();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/auth/account");
  }
}
