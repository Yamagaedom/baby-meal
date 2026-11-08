import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { buildOAuthAuthorizeUrl, generateSessionToken } from "@/features/auth";
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
  const mode = request.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";
  const nonce = generateSessionToken().slice(0, 24);
  const state = `${mode}:${nonce}`;
  const redirectUri = new URL(
    `/api/auth/oauth/${provider.toLowerCase()}/callback`,
    request.url,
  ).toString();

  const authorizeUrl = buildOAuthAuthorizeUrl(provider, redirectUri, state);
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL(`/login?social=${provider.toLowerCase()}`, request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl);
}
