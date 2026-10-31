/**
 * 비로그인 접근 차단 및 교차 사이트 요청(CSRF) 방어 프록시 (ACC-01: 회원가입/로그인 필수, 비로그인 체험 없음)
 * - 공개 허용 경로(인증 화면, PWA 매니페스트·아이콘·서비스워커·오프라인 안내, 개발용 UI 쇼케이스) 외 모든 페이지는 /login 리다이렉트, 모든 API는 401 JSON 반환
 * - 상태 변경 API(POST/PUT/PATCH/DELETE)에 대해 Origin 및 Sec-Fetch-Site 기반 CSRF 차단 수행
 * - 유효성(DB 세션 만료·위조 여부)은 각 API의 requireApiUser() 및 레이아웃의 requirePageUser()에서 이중 검증한다.
 */
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/constants";

const PUBLIC_PAGE_PATHS = new Set([
  "/login",
  "/signup",
  "/reset-password",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
]);
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/reset-password",
]);
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isCrossSiteApiMutation(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith("/api/")) return false;
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const forwardedHost = request.headers
        .get("x-forwarded-host")
        ?.split(",")[0]
        ?.trim()
        .toLowerCase();
      const expectedHost =
        forwardedHost ||
        request.headers.get("host")?.toLowerCase() ||
        request.nextUrl.host.toLowerCase();
      if (expectedHost && originHost !== expectedHost) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/dev/ui" || pathname.startsWith("/dev/")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.next();
  }

  if (isCrossSiteApiMutation(request)) {
    return NextResponse.json(
      {
        error: {
          code: "CSRF_BLOCKED",
          message: "교차 사이트 요청이 차단되었습니다.",
        },
      },
      { status: 403 },
    );
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    PUBLIC_PAGE_PATHS.has(pathname) ||
    PUBLIC_API_PATHS.has(pathname) ||
    (request.method === "GET" && pathname.endsWith("/reviews"))
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
          },
        },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
