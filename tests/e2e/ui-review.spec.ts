import { expect, test } from "@playwright/test";

test("UI 검토서 회귀: 카드·필터·냉장고 피드백·상세 고지·캘린더·모바일 메뉴", async ({
  page,
}, testInfo) => {
  const loginId = `uireview${Date.now().toString().slice(-8)}`;
  const signup = await page.request.post("/api/auth/signup", {
    headers: { "x-forwarded-for": "198.51.100.42" },
    data: { loginId, password: "review1234", agreeIrrecoverable: true },
  });
  expect(signup.status()).toBe(201);
  const profileResponse = await page.request.post("/api/babies", {
    data: { nickname: "도담", ageMonth: 18, saltLevel: "NONE", allergens: ["EGG"] },
  });
  expect(profileResponse.status()).toBe(201);
  const { baby } = await profileResponse.json();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeVisible();
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts).some(
        (font) => font.family === "SUIT Variable" && font.status === "loaded",
      );
    }),
  ).toBe(true);
  expect(
    await page.locator('section[aria-labelledby="today-meals-heading"] article').count(),
  ).toBeLessThanOrEqual(3);
  const cards = page.locator('article[data-testid^="recipe-card-"]');
  await expect(cards.first()).toBeVisible();
  const names = await cards.locator("h3").allTextContents();
  expect(new Set(names).size).toBe(names.length);
  expect(await page.locator("main").innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
  for (const card of await cards.all()) {
    expect(
      await card.getByTestId("recipe-card-badges").locator(":scope > span").count(),
    ).toBeLessThanOrEqual(2);
  }
  expect(await cards.first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe("12px");
  const favorite = cards.first().getByRole("button", { name: /즐겨찾기 추가/ });
  const recipeHref = await cards.first().locator("h3 a").getAttribute("href");
  const recipeName = await cards.first().locator("h3").innerText();
  await favorite.click();
  await expect(cards.first().getByRole("button", { name: /즐겨찾기 해제/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await cards
    .first()
    .getByRole("button", { name: /즐겨찾기 해제/ })
    .click();
  await expect(cards.first().getByRole("button", { name: /즐겨찾기 추가/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.screenshot({ path: testInfo.outputPath("home-desktop.png") });

  await page.goto("/recipes");
  await expect(page.getByLabel("연령 단계", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "필터 더보기", exact: true }).click();
  await page.getByLabel("연령 단계", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: /추가 필터 접기/ }).click();
  await expect(page.getByRole("button", { name: "필터 더보기 (1개 적용)" })).toBeVisible();
  await page.getByLabel("레시피 이름 검색").fill("주먹밥");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(cards.first()).toBeVisible();
  for (const name of await cards.locator("h3").allTextContents()) expect(name).toContain("주먹밥");

  await page.goto("/ingredients");
  await page.getByRole("button", { name: "감자", exact: true }).click();
  await expect(page.getByRole("heading", { name: /매칭된 레시피/ })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
  await page.route("**/api/pantry", (route) =>
    route.fulfill({ status: 500, json: { error: { message: "테스트 저장 실패 안내" } } }),
  );
  await page.getByTestId("save-pantry-btn").click();
  await expect(page.locator("main").getByRole("alert")).toContainText("테스트 저장 실패 안내");
  await page.unroute("**/api/pantry");
  await page.getByTestId("save-pantry-btn").click();
  await expect(page.getByTestId("pantry-save-notice")).toContainText("1개가 저장되었습니다");

  await page.goto(recipeHref!);
  await expect(page.getByRole("heading", { level: 1, name: recipeName })).toBeVisible();
  await expect(page.getByTestId("ai-safety-disclaimer")).toContainText("사람 미검수");
  const disclaimerBox = await page.getByTestId("ai-safety-disclaimer").boundingBox();
  const allergenBox = await page.getByText("알레르기 유발 표시", { exact: true }).boundingBox();
  expect(disclaimerBox!.y).toBeLessThan(allergenBox!.y);
  await expect(page.getByTestId("default-category-illustration")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/시드 샘플|유아식샘플채널/);
  await page.getByRole("button", { name: "조리 분량 1회분 늘리기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "현재 3회분" })).toBeVisible();
  await page.getByTestId("open-cooking-mode-btn").click();
  await expect(page.getByTestId("cooking-mode-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cooking-mode-dialog")).toHaveCount(0);

  const log = await page.request.post("/api/meal-logs", {
    data: {
      babyId: baby.id,
      recipeId: recipeHref!.split("/").pop(),
      rating: "GOOD",
      amountEaten: "ALL",
      mealTime: "LUNCH",
      reactions: [],
    },
  });
  expect(log.status()).toBe(201);
  await page.goto("/logs");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  await expect(page.getByTestId(`calendar-day-${day}`)).toContainText("1건");
  expect(
    await page
      .getByTestId(`calendar-day-${day}`)
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe("0px");

  await page.goto("/my");
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const allergyInputs = page
    .locator("fieldset")
    .filter({ hasText: "주요 알레르기 유발 식품 체크" })
    .getByRole("checkbox");
  await expect(allergyInputs).toHaveCount(19);
  await expect(page.getByLabel("달걀(알류)", { exact: true })).toBeChecked();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "도담의 오늘 추천 메뉴" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "하단 주 메뉴" });
  await expect(nav.getByRole("link", { name: "재료로 찾기" })).toHaveText("재료");
  for (const link of await nav.getByRole("link").all()) {
    expect(await link.locator("svg").count()).toBe(1);
    expect(await link.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
      44,
    );
  }
  await page.screenshot({ path: testInfo.outputPath("home-mobile.png") });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `홈 ${width}px 가로 넘침`,
    ).toBeLessThanOrEqual(width);
  }
});
