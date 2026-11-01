import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("compact UI: more results, disclosures, mobile and desktop", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const password = "compact-ui-1234";
  const signup = await page.request.post("/api/auth/signup", {
    data: { loginId: `compact${Date.now()}`, password, agreeIrrecoverable: true },
  });
  expect(signup.status()).toBe(201);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    expect(
      (
        await page.request.post("/api/babies", {
          data: { nickname: "화면검증", ageMonth: 18, saltLevel: "NONE", allergens: [] },
        })
      ).status(),
    ).toBe(201);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recipes");
    const cards = page.locator('article[data-testid^="recipe-card-"]');
    const total = (await (await page.request.get("/api/recipes")).json()).items.length;
    await expect(cards).toHaveCount(Math.min(12, total));
    if (total > 12) {
      const more = page.getByRole("button", { name: /레시피 더보기/ });
      await more.click();
      await expect(cards).toHaveCount(Math.min(24, total));
    }
    const href = await cards.first().getByRole("link").first().getAttribute("href");
    await page.screenshot({ path: testInfo.outputPath("recipes-mobile.png"), fullPage: true });
    await page.goto(href!);
    const log = page.locator("#meal-log-form");
    await expect(log.getByRole("button", { name: "먹었어요 저장" })).toBeHidden();
    await log.locator("summary").click();
    await expect(log.getByRole("button", { name: "먹었어요 저장" })).toBeVisible();
    await log.locator("summary").press("Enter");
    await expect(log.getByRole("button", { name: "먹었어요 저장" })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("detail-mobile.png"), fullPage: true });
    for (const route of ["/", "/recipes", "/ingredients", "/meal-plan", "/logs", "/my"]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const audit = await new AxeBuilder({ page }).analyze();
      expect(
        audit.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${route.replaceAll("/", "") || "home"}-mobile.png`),
        fullPage: true,
      });
    }
    await page.getByText("비밀번호 변경", { exact: true }).first().click();
    await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /오늘 추천 메뉴/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("home-desktop.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    expect(
      (
        await page.request.delete("/api/auth/account", { data: { currentPassword: password } })
      ).status(),
    ).toBe(200);
  }
});
