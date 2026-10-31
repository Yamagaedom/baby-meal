import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("weekly meal planning: questionnaire → confirm → cook → serve → inventory", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const password = "weekly-test-1234";
  const signup = await page.request.post("/api/auth/signup", {
    headers: { "x-forwarded-for": "198.51.100.87" },
    data: { loginId: `weekly${Date.now()}`, password, agreeIrrecoverable: true },
  });
  expect(signup.status()).toBe(201);
  try {
    const profile = await page.request.post("/api/babies", {
      data: { nickname: "주간테스트", ageMonth: 18, saltLevel: "NONE", allergens: [] },
    });
    expect(profile.status()).toBe(201);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/meal-plan");
    await page.getByRole("button", { name: "직접 선택", exact: true }).click();
    await page.getByRole("button", { name: "아침", exact: true }).click();
    await page.getByRole("button", { name: "점심", exact: true }).click();
    await page.getByRole("button", { name: "없음", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: "주 2회 모아서", exact: true }).click();
    await page.getByRole("button", { name: "식단 초안 만들기", exact: true }).click();
    await expect(page.getByRole("button", { name: "식단 확정", exact: true })).toBeVisible();
    await expect(page.getByText("영양 체크", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "식단 확정", exact: true }).click();
    await expect(page.getByRole("button", { name: "식단 수정", exact: true })).toBeVisible();
    const state = await (await page.request.get("/api/meal-plans")).json();
    const plan = state.plans[0];
    const dinner = plan.entries.find(
      (e: { date: string; mealTime: string; kind: string }) =>
        e.date === plan.startDate && e.mealTime === "DINNER" && e.kind === "HOME",
    );
    const task = plan.tasks.find(
      (t: { date: string; recipeId: string }) =>
        t.date === plan.startDate && t.recipeId === dinner.recipeId,
    );
    const cooked = await page.request.patch(`/api/meal-plans/${plan.id}`, {
      data: {
        action: "COOK",
        revision: plan.revision,
        taskId: task.id,
        servings: 4,
        location: "FREEZER",
        expiresDate: task.requiredThrough,
      },
    });
    expect(cooked.status()).toBe(200);
    await page.reload();
    const editor = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "먹은 기록 · 재고에서 꺼내기" }) });
    await editor.locator("summary").click();
    await editor.getByLabel("먹은 양").selectOption("HALF");
    await editor.getByRole("button", { name: /차감 · 기록/ }).click();
    await expect(page.getByText(/· 제공 완료/)).toBeVisible();
    await page.getByRole("button", { name: "만든 음식", exact: true }).click();
    await expect(page.getByText(/남은 3회분/)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
      [],
    );
    await page.screenshot({ path: testInfo.outputPath("weekly-stock-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "이번 주", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("weekly-plan-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("weekly-plan-desktop.png"), fullPage: true });
  } finally {
    const deleted = await page.request.delete("/api/auth/account", {
      data: { currentPassword: password },
    });
    expect(deleted.status()).toBe(200);
  }
});
