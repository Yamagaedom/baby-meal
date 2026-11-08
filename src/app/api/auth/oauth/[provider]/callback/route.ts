import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateWithSocialProfile,
  fetchOAuthUserProfile,
  getSessionUserFromCookies,
  linkSocialAccountToUser,
  setSessionCookie,
} from "@/features/auth";
import { socialProviderSchema } from "@/lib/validation";

const OAUTH_STATE_COOKIE = "bm_oauth_state";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  const parsed = socialProviderSchema.safeParse(rawProvider.toUpperCase());
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=unsupported_provider", request.url));
  }

  const provider = parsed.data;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_state_mismatch", request.url));
  }

  const isLinkMode = state.startsWith("link:");
  const redirectUri = new URL(
    `/api/auth/oauth/${provider.toLowerCase()}/callback`,
    request.url,
  ).toString();

  try {
    const profile = await fetchOAuthUserProfile(provider, code, redirectUri, state);

    if (isLinkMode) {
      const currentUser = await getSessionUserFromCookies();
      if (!currentUser) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      await linkSocialAccountToUser(currentUser.id, {
        provider,
        email: profile.email,
        providerUserId: profile.providerUserId,
        displayName: profile.displayName ?? undefined,
      });
      return NextResponse.redirect(new URL("/my?linked=" + provider.toLowerCase(), request.url));
    }

    const result = await authenticateWithSocialProfile({
      provider,
      email: profile.email,
      providerUserId: profile.providerUserId,
      displayName: profile.displayName ?? undefined,
      rememberMe: true,
    });
    await setSessionCookie(result.sessionToken, result.expiresAt, true);

    return NextResponse.redirect(new URL(result.hasBabyProfile ? "/" : "/onboarding", request.url));
  } catch {
    return NextResponse.redirect(
      new URL(
        isLinkMode ? "/my?error=social_link_failed" : "/login?error=oauth_failed",
        request.url,
      ),
    );
  }
}
