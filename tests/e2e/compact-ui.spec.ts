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
    const items = (await (await page.request.get("/api/recipes")).json()).items;
    const total = items.length;
    await expect(cards).toHaveCount(Math.min(12, total));
    if (total > 12) {
      const more = page.getByRole("button", { name: /레시피 더보기/ });
      await more.click();
      await expect(cards).toHaveCount(Math.min(24, total));
    }
    const first = cards.first();
    await expect(first.getByText("주요 재료:", { exact: false })).toBeVisible();
    await expect(first.getByText(/현재 아기 월령보다 높은/)).toHaveCount(0);
    const allergenCandidate = cards
      .filter({ has: page.getByRole("button", { name: "알레르기 보기" }) })
      .first();
    if (await allergenCandidate.count()) {
      const allergenCard = page.getByTestId((await allergenCandidate.getAttribute("data-testid"))!);
      await expect(allergenCard.getByText(/알레르기 유발 성분:/)).toHaveCount(0);
      await allergenCard.getByRole("button", { name: "알레르기 보기" }).click();
      await expect(allergenCard.getByText(/알레르기 유발 성분:/)).toBeVisible();
      await allergenCard.getByRole("button", { name: "알레르기 접기" }).click();
      await expect(allergenCard.getByText(/알레르기 유발 성분:/)).toHaveCount(0);
    }
    expect(
      items.some(
        (item: { primaryIngredients?: string[] }) => (item.primaryIngredients?.length ?? 0) > 0,
      ),
    ).toBe(true);
    const href = await cards.first().getByRole("link").first().getAttribute("href");
    await page.screenshot({ path: testInfo.outputPath("recipes-mobile.png"), fullPage: true });
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "재료", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "조리 순서", exact: true })).toBeVisible();
    const portions=page.getByRole("group",{name:"조리 분량 선택"});
    const previous=Number((await portions.innerText()).match(/(\d+)회분/)![1]);
    await page.getByRole("button", { name: "조리 분량 1회분 늘리기" }).click();
    await expect(portions).toContainText(`${previous+1}회분`);
    await page.getByTestId("open-cooking-mode-btn").click();
    await expect(page.getByTestId("cooking-mode-dialog")).toBeVisible();
    await page.getByRole("button", { name: "조리 모드 닫기" }).click();
    const nutrition = page.getByTestId("recipe-nutrition-section");
    await expect(nutrition).not.toHaveAttribute("open", "");
    await nutrition.locator("summary").press("Enter");
    await expect(nutrition.getByRole("heading", { name: "영양 성분 추정" })).toBeVisible();
    const reviews = page.getByTestId("recipe-community-section");
    await expect(reviews).not.toHaveAttribute("open", "");
    await page
      .getByRole("link", { name: /평점 없음|후기/ })
      .first()
      .click();
    await expect(reviews).toHaveAttribute("open", "");
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
