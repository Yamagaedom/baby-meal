const SHELL_CACHE = "baby-meal-shell-v4";
const FAVORITES_CACHE = "baby-meal-favorites-v2";

const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/fonts/SUIT-Variable.woff2",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== FAVORITES_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// 클라이언트에서 즐겨찾기 추가/해제, 활성 아기 전환, 로그아웃 시 캐시를 동기화하는 메시지 핸들러
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "CACHE_FAVORITE_URL" && typeof data.url === "string") {
    event.waitUntil(
      caches.open(FAVORITES_CACHE).then(async (cache) => {
        try {
          const response = await fetch(data.url, { credentials: "same-origin" });
          if (response.ok) {
            await cache.put(data.url, response.clone());
          }
        } catch {
          // 오프라인이면 무시
        }
      }),
    );
  } else if (data.type === "REMOVE_FAVORITE_URL" && typeof data.url === "string") {
    event.waitUntil(
      caches.open(FAVORITES_CACHE).then(async (cache) => {
        await cache.delete(data.url);
        const requests = await cache.keys();
        await Promise.all(
          requests
            .filter((req) => {
              try {
                return new URL(req.url).pathname === data.url;
              } catch {
                return false;
              }
            })
            .map((req) => cache.delete(req)),
        );
      }),
    );
  } else if (data.type === "SYNC_ALLOWED_FAVORITE_URLS" && Array.isArray(data.urls)) {
    const allowedSet = new Set(data.urls.filter((u) => typeof u === "string"));
    event.waitUntil(
      caches.open(FAVORITES_CACHE).then(async (cache) => {
        const requests = await cache.keys();
        await Promise.all(
          requests
            .filter((req) => {
              try {
                const pathname = new URL(req.url).pathname;
                return pathname.startsWith("/recipes/") && !allowedSet.has(pathname);
              } catch {
                return false;
              }
            })
            .map((req) => cache.delete(req)),
        );
      }),
    );
  } else if (data.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(caches.delete(FAVORITES_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 정적 빌드 번들 및 아이콘: Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 레시피 상세 및 네비게이션 요청: Network-First → 명시적 즐겨찾기 캐시 폴백 → /offline 폴백
  // (비즐겨찾기 /recipes/* 응답은 자동 캐싱하지 않으며, CACHE_FAVORITE_URL 메시지로만 저장)
  if (
    request.mode === "navigate" ||
    url.pathname.startsWith("/recipes") ||
    url.pathname.startsWith("/api/recipes/")
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname === "/offline") {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cachedExact = await caches.match(request);
          if (cachedExact) return cachedExact;

          const cachedByPath = await caches.match(url.pathname);
          if (cachedByPath) return cachedByPath;

          if (request.mode === "navigate") {
            const offlineFallback = await caches.match("/offline");
            if (offlineFallback) return offlineFallback;
          }
          return new Response(
            JSON.stringify({
              error: {
                code: "OFFLINE",
                message: "현재 오프라인 상태입니다. 저장된 즐겨찾기 레시피를 확인해 주세요.",
              },
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          );
        }),
    );
  }
});
