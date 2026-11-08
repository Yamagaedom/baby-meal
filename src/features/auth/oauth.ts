/**
 * 카카오 · 구글 · 네이버 OAuth 2.0 헬퍼 및 SNS 프로바이더 메타데이터
 */
import type { SocialProviderType } from "@/lib/validation";

export interface SocialProviderMeta {
  provider: SocialProviderType;
  label: string;
  shortLabel: string;
  domainHint: string;
  sampleEmail: string;
}

export const SOCIAL_PROVIDER_META: Record<SocialProviderType, SocialProviderMeta> = {
  KAKAO: {
    provider: "KAKAO",
    label: "카카오",
    shortLabel: "Kakao",
    domainHint: "kakao.com",
    sampleEmail: "mom@kakao.com",
  },
  GOOGLE: {
    provider: "GOOGLE",
    label: "구글",
    shortLabel: "Google",
    domainHint: "gmail.com",
    sampleEmail: "mom@gmail.com",
  },
  NAVER: {
    provider: "NAVER",
    label: "네이버",
    shortLabel: "Naver",
    domainHint: "naver.com",
    sampleEmail: "mom@naver.com",
  },
};

export function isProviderOAuthConfigured(provider: SocialProviderType): boolean {
  switch (provider) {
    case "KAKAO":
      return Boolean(process.env.KAKAO_CLIENT_ID?.trim());
    case "GOOGLE":
      return Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
      );
    case "NAVER":
      return Boolean(
        process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim(),
      );
  }
}

export function buildOAuthAuthorizeUrl(
  provider: SocialProviderType,
  redirectUri: string,
  state: string,
): string | null {
  if (!isProviderOAuthConfigured(provider)) return null;

  switch (provider) {
    case "KAKAO": {
      const params = new URLSearchParams({
        client_id: process.env.KAKAO_CLIENT_ID!.trim(),
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });
      return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
    }
    case "GOOGLE": {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    case "NAVER": {
      const params = new URLSearchParams({
        client_id: process.env.NAVER_CLIENT_ID!.trim(),
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });
      return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
    }
  }
}

export async function fetchOAuthUserProfile(
  provider: SocialProviderType,
  code: string,
  redirectUri: string,
  state: string,
): Promise<{
  providerUserId: string;
  email: string;
  displayName: string | null;
}> {
  switch (provider) {
    case "KAKAO": {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID!.trim(),
        redirect_uri: redirectUri,
        code,
        ...(process.env.KAKAO_CLIENT_SECRET?.trim()
          ? { client_secret: process.env.KAKAO_CLIENT_SECRET.trim() }
          : {}),
      });
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body,
      });
      if (!tokenRes.ok) throw new Error("카카오 토큰 발급에 실패했습니다.");
      const tokenData = (await tokenRes.json()) as { access_token: string };

      const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) throw new Error("카카오 프로필 조회에 실패했습니다.");
      const profile = (await profileRes.json()) as {
        id: number | string;
        kakao_account?: { email?: string; profile?: { nickname?: string } };
      };
      const id = String(profile.id);
      const email = (profile.kakao_account?.email || `kakao_${id}@kakao.user`).toLowerCase();
      return {
        providerUserId: id,
        email,
        displayName: profile.kakao_account?.profile?.nickname ?? "카카오 회원",
      };
    }
    case "GOOGLE": {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri,
        code,
      });
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) throw new Error("구글 토큰 발급에 실패했습니다.");
      const tokenData = (await tokenRes.json()) as { access_token: string };

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) throw new Error("구글 프로필 조회에 실패했습니다.");
      const profile = (await profileRes.json()) as {
        sub: string;
        email?: string;
        name?: string;
      };
      const email = (profile.email || `google_${profile.sub}@google.user`).toLowerCase();
      return {
        providerUserId: profile.sub,
        email,
        displayName: profile.name ?? "구글 회원",
      };
    }
    case "NAVER": {
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NAVER_CLIENT_ID!.trim(),
        client_secret: process.env.NAVER_CLIENT_SECRET!.trim(),
        code,
        state,
      });
      const tokenRes = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`);
      if (!tokenRes.ok) throw new Error("네이버 토큰 발급에 실패했습니다.");
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (!tokenData.access_token) throw new Error("네이버 액세스 토큰이 없습니다.");

      const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) throw new Error("네이버 프로필 조회에 실패했습니다.");
      const profile = (await profileRes.json()) as {
        response?: { id: string; email?: string; nickname?: string; name?: string };
      };
      const id = profile.response?.id || "unknown";
      const email = (profile.response?.email || `naver_${id}@naver.user`).toLowerCase();
      return {
        providerUserId: id,
        email,
        displayName: profile.response?.nickname ?? profile.response?.name ?? "네이버 회원",
      };
    }
  }
}
