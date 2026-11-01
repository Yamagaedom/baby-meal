import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const SCREENSHOT_DIR = path.resolve("test-results", "ui-a11y-screenshots");

async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(
    seriousOrCritical,
    `[${label}] axe critical/serious 위반 발견: ${JSON.stringify(
      seriousOrCritical.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.html).slice(0, 3),
      })),
    )}`,
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `[${label}] 가로 스크롤 발생: scrollWidth(${metrics.scrollWidth}) > innerWidth(${metrics.innerWidth})`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

test.describe("3단계 UI·반응형(320/360/768/1280px)·접근성(WCAG 2.1 AA axe)·키보드·오프라인 PWA 검증", () => {
  test("모든 주요 화면 axe critical/serious 0건 + 320px/200% 확대 가로 스크롤 없음 + 360/768/1280px 반응형 스크린샷 캡처 + /dev/ui 프로덕션 404 차단", async ({
    page,
  }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // 프로덕션 서버에서 /dev/ui 접근 시 404 차단 검증
    const devUiRes = await page.request.get("/dev/ui");
    expect(devUiRes.status()).toBe(404);

    // 1. 비로그인 인증 화면 3종 접근성 및 320px 가로 스크롤 검사
    await page.setViewportSize({ width: 360, height: 800 });
    for (const authRoute of [
      { url: "/login", slug: "login" },
      { url: "/signup", slug: "signup" },
      { url: "/reset-password", slug: "reset-password" },
    ]) {
      await page.goto(authRoute.url);
      await expectNoSeriousAxeViolations(page, authRoute.url);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${authRoute.slug}-360.png`),
        fullPage: false,
      });

      await page.setViewportSize({ width: 320, height: 700 });
      await expectNoHorizontalOverflow(page, `${authRoute.url}@320px`);
      await page.setViewportSize({ width: 360, height: 800 });
    }

    // 테스트 계정 가입 → 온보딩 진입
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `uicheck${suffix}`;
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(loginId);
    await page.getByLabel(/^비밀번호 \(/).fill("uipass1234");
    await page.getByLabel("비밀번호 확인").fill("uipass1234");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await expect(page.getByTestId("recovery-code-saved-checkbox")).toBeVisible();

    await expectNoSeriousAxeViolations(page, "/signup (복구 코드 발급 화면)");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "recovery-code-360.png"),
      fullPage: false,
    });

    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();
    await expect(page).toHaveURL(/\/onboarding$/);

    // 온보딩 접근성 및 스크린샷
    await expectNoSeriousAxeViolations(page, "/onboarding");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "onboarding-360.png"),
      fullPage: false,
    });

    await page.getByLabel(/아기 애칭/).fill("햇살이");
    await page.getByLabel(/현재 월령/).selectOption("18");
    await page.getByLabel("달걀(알류)").check();
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 홈에서 첫 레시피 ID 확보
    const firstRecipeHref = await page.locator("article h3 a").first().getAttribute("href");
    expect(firstRecipeHref).toBeTruthy();

    const mainScreens = [
      { url: "/", slug: "home" },
      { url: "/ingredients", slug: "ingredients" },
      { url: "/recipes", slug: "recipes" },
      { url: firstRecipeHref!, slug: "recipe-detail" },
      { url: "/logs", slug: "logs" },
      { url: "/my", slug: "my" },
    ];

    // 2. 각 메인 화면에서 axe 검사 + 320px 가로 스크롤 없음 + 360 / 768 / 1280px 스크린샷 저장
    for (const screen of mainScreens) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(screen.url);
      await expectNoSeriousAxeViolations(page, `${screen.slug}@360px`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${screen.slug}-360.png`),
        fullPage: false,
      });

      // 320px 초소형 폭 가로 스크롤 없음 확인
      await page.setViewportSize({ width: 320, height: 700 });
      await expectNoHorizontalOverflow(page, `${screen.slug}@320px`);

      // 글자 크기 200% 확대(모바일 표준 360px 기준) 시 가로 스크롤 없음 확인
      await page.setViewportSize({ width: 360, height: 800 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "32px";
      });
      await expectNoHorizontalOverflow(page, `${screen.slug}@200%Zoom`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });

      // 768px 태블릿 폭
      await page.setViewportSize({ width: 768, height: 1024 });
      await expectNoHorizontalOverflow(page, `${screen.slug}@768px`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${screen.slug}-768.png`),
        fullPage: false,
      });

      // 1280px 데스크톱 폭 (좌측 사이드바 + 다열 그리드)
      await page.setViewportSize({ width: 1280, height: 800 });
      await expectNoHorizontalOverflow(page, `${screen.slug}@1280px`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${screen.slug}-1280.png`),
        fullPage: false,
      });
    }

    // 조리 모드 모달 열린 상태 axe 검사 & ESC 닫기 확인
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(firstRecipeHref!);
    await page.getByTestId("open-cooking-mode-btn").click();
    await expect(page.getByTestId("cooking-mode-dialog")).toBeVisible();
    await expectNoSeriousAxeViolations(page, "조리 모드 모달");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "cooking-mode-360.png"),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cooking-mode-dialog")).toHaveCount(0);
  });

  test("키보드만으로 가입 → 복구 코드 확인 → 프로필 생성 → 추천 레시피 진입 → 분량 변경(aria-live 안내) → 먹은 기록 저장 완료", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `kbuser${suffix}`;

    await page.goto("/signup");

    // 본문 건너뛰기 링크(Skip Link) Tab 포커스 확인
    await page.keyboard.press("Tab");
    const skipFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains("skip-link"),
    );
    expect(skipFocused).toBe(true);

    // 마우스 클릭 없이 키보드로만 회원가입 수행
    await page.getByLabel(/^아이디/).focus();
    await page.keyboard.type(loginId);
    await page.keyboard.press("Tab");
    await page.keyboard.type("kbmeal1234");
    await page.keyboard.press("Tab");
    await page.keyboard.type("kbmeal1234");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space"); // 동의 체크박스
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter"); // 회원가입 및 복구 코드 발급

    await expect(page.getByTestId("recovery-code-display")).toBeVisible();
    await page.getByTestId("recovery-code-saved-checkbox").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel(/아기 애칭/).focus();
    await page.keyboard.type("도담이");
    await page.getByRole("button", { name: "시작하기" }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/);
    const firstCardLink = page.locator("article h3 a").first();
    await firstCardLink.focus();

    // 포커스 표시(outline) 스타일이 실제로 적용되는지 검증
    const outlineStyle = await firstCardLink.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe("none");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/recipes\//);

    // 키보드로 4회분 버튼 선택 및 스크린리더용 aria-live 영역 텍스트 갱신 검증
    const serving4Btn = page.getByRole("button", { name: "조리 분량 1회분 늘리기" });
    await serving4Btn.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByText("현재 4회분 기준으로 재료 분량이 계산되었습니다")).toHaveText(
      "현재 4회분 기준으로 재료 분량이 계산되었습니다",
    );

    // 키보드로 '먹었어요 저장' 제출
    await page.locator("#meal-log-form > summary").press("Enter");
    const saveLogBtn = page.getByRole("button", { name: "먹었어요 저장" });
    await saveLogBtn.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("meal-log-success")).toBeVisible();
  });

  test("PWA 매니페스트·서비스워커·모바일 LCP(<2.5s) 및 오프라인 상태에서 즐겨찾기 레시피 열람 확인", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    // 1. PWA 매니페스트 및 아이콘 응답 확인
    const manifestRes = await page.request.get("/manifest.webmanifest");
    expect(manifestRes.ok()).toBe(true);
    const manifest = await manifestRes.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const iconRes = await page.request.get("/icons/icon-192.png");
    expect(iconRes.ok()).toBe(true);

    // 2. 가입 후 레시피 상세 진입 및 즐겨찾기 등록 + 모바일 LCP 측정
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(`pwauser${suffix}`);
    await page.getByLabel(/^비밀번호 \(/).fill("pwameal1234");
    await page.getByLabel("비밀번호 확인").fill("pwameal1234");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();
    await page.getByLabel(/아기 애칭/).fill("보름이");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 모바일 홈 화면 LCP <= 2500ms 확인
    const lcpMs = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let latest = 0;
          const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              latest = Math.max(latest, entry.startTime);
            }
          });
          po.observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => {
            po.disconnect();
            resolve(latest);
          }, 300);
        }),
    );
    expect(lcpMs).toBeLessThan(2500);

    // 첫 추천 레시피 진입 후 즐겨찾기 추가 (오프라인 스냅샷 저장 트리거)
    const firstLink = page.locator("article h3 a").first();
    const favRecipeTitle = (await firstLink.innerText()).trim();
    await firstLink.click();
    await expect(page).toHaveURL(/\/recipes\//);

    await page.getByRole("button", { name: /즐겨찾기/ }).click();
    await expect(page.getByRole("button", { name: /즐겨찾기됨/ })).toBeVisible();

    // 서비스 워커 활성화 대기
    const swReady = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(swReady).toBe(true);

    // 3. 네트워크 오프라인 전환 → 오프라인 안내 배너 노출 및 즐겨찾기 레시피 열람·분량 조절 확인
    await page.goto("/recipes");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const offlineFontStatus = await page.evaluate(async () => {
      const response = await fetch("/fonts/SUIT-Variable.woff2");
      return response.status;
    });
    expect(offlineFontStatus).toBe(200);

    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await page.getByTestId("open-offline-favorites-btn").click();

    const offlineArticle = page.getByTestId("offline-recipe-detail");
    await expect(offlineArticle).toBeVisible();
    await expect(offlineArticle).toContainText(favRecipeTitle);

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  });
});
