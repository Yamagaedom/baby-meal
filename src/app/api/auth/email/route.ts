import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser, updateUserEmail } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const updated = await updateUserEmail(user.id, body);

    return NextResponse.json({ user: updated });
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/auth/email");
  }
}
