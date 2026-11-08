import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateWithSocialProfile,
  getSessionUserFromCookies,
  isProviderOAuthConfigured,
  listUserSocialAccounts,
  setSessionCookie,
} from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET() {
  try {
    const user = await getSessionUserFromCookies();
    const socialAccounts = user ? await listUserSocialAccounts(user.id) : [];

    return NextResponse.json({
      socialAccounts,
      oauthConfigured: {
        KAKAO: isProviderOAuthConfigured("KAKAO"),
        GOOGLE: isProviderOAuthConfigured("GOOGLE"),
        NAVER: isProviderOAuthConfigured("NAVER"),
      },
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/auth/social");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await authenticateWithSocialProfile(body);

    await setSessionCookie(result.sessionToken, result.expiresAt, result.rememberMe);

    return NextResponse.json({
      user: result.user,
      isNewUser: result.isNewUser,
      autoLinkedByEmail: result.autoLinkedByEmail,
      hasBabyProfile: result.hasBabyProfile,
      redirectTo: result.hasBabyProfile ? "/" : "/onboarding",
    });
  } catch (error) {
    return toErrorResponse(error, "POST /api/auth/social");
  }
}
