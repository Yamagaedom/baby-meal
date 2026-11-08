import { type NextRequest, NextResponse } from "next/server";
import {
  linkSocialAccountToUser,
  requireApiUser,
  unlinkSocialAccountFromUser,
} from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const socialAccounts = await linkSocialAccountToUser(user.id, body);

    return NextResponse.json({ socialAccounts });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/social/link");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const urlProvider = request.nextUrl.searchParams.get("provider");
    let provider = urlProvider ?? "";
    if (!provider) {
      const body = (await request.json().catch(() => ({}))) as { provider?: string };
      provider = body.provider ?? "";
    }
    const socialAccounts = await unlinkSocialAccountFromUser(user.id, provider);

    return NextResponse.json({ socialAccounts });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/auth/social/link");
  }
}
