import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("review flow: full ingredient browse, precise match, 3-day meals with sides and stock", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const password = "review-check-1234";
  const signup = await page.request.post("/api/auth/signup", {
    data: { loginId: `review${Date.now()}`, password, agreeIrrecoverable: true },
  });
  expect(signup.status()).toBe(201);
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER", e.message);
  });
  try {
    expect(
      (
        await page.request.post("/api/babies", {
          data: { nickname: "생활식단", ageMonth: 24, saltLevel: "NONE", allergens: [] },
        })
      ).status(),
    ).toBe(201);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ingredients");
    await page.getByRole("button", { name: "전체 재료 찾아보기", exact: true }).click();
    const ingredients = (await (await page.request.get("/api/ingredients")).json()).results;
    expect(ingredients.length).toBeGreaterThan(40);
    await expect(page.getByRole("button", { name: /재료 더보기/ })).toBeVisible();
    await page.getByRole("button", { name: /재료 더보기/ }).click();
    const tofu = ingredients.find((i: { name: string }) => i.name === "두부");
    const soft = ingredients.find((i: { name: string }) => i.name === "순두부");
    expect(tofu).toBeTruthy();
    expect(soft).toBeTruthy();
    expect((await page.request.post('/api/ingredient-requests',{data:{name:'검증용 재료 요청'}})).status()).toBe(200);
    const strict = await page.request.post("/api/recommend/by-ingredients", {
      data: { ingredientIds: [tofu.id], scope: "ON_HAND", assumeBasicPantry: true, maxMissing: 0 },
    });
    expect(strict.status()).toBe(200);
    const broad = await (
      await page.request.post("/api/recommend/by-ingredients", {
        data: { ingredientIds: [], scope: "EXPLORE" },
      })
    ).json();
    expect(broad.items.length).toBeGreaterThan((await strict.json()).items.length);
    expect(broad.diagnostics.safe).toBeGreaterThan(0);
    await page.goto("/meal-plan");
    await page.getByLabel("아침 식단 유형").selectOption("SOUP");
    await page.getByLabel("점심 식단 유형").selectOption("ONE_BOWL");
    await page.getByLabel("저녁 식단 유형").selectOption("RICE_SIDES");
    await page.getByLabel("반찬 수", { exact: true }).selectOption("4");
    await page.getByRole("button", { name: "없음", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: /재료 더보기/ }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: "3일마다", exact: true }).click();
    await page.getByLabel("같은 메뉴를 조리 구간 안에서 나눠 먹어도 좋아요").check();
    await page.getByRole("button", { name: "식단 초안 만들기", exact: true }).click();
    await expect(page.getByRole("button", { name: "식단 확정", exact: true })).toBeVisible();
    let state = await (await page.request.get("/api/meal-plans")).json();
    let plan = state.plans[0];
    const dinner = plan.entries.filter(
      (e: { date: string; mealTime: string }) =>
        e.date === plan.startDate && e.mealTime === "DINNER",
    );
    expect(dinner).toHaveLength(5);
    expect(dinner.every((e: { recipeId: string }) => !!e.recipeId)).toBe(true);
    expect(dinner.slice(1).every((e: { servings: number }) => e.servings === 0.5)).toBe(true);
    expect(plan.preferences.cookingInterval).toBe(3);
    const snapshot = dinner[1].snapshot;
    expect(snapshot.groups).toContain("MEAT");
    const meal = page
      .locator("details")
      .filter({ has: page.locator(":scope > summary", { hasText: "저녁 · 밥 + 반찬 4" }) })
      .first();
    await expect(meal).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("review-week-mobile.png"), fullPage: true });
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual(
      [],
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "식단 확정", exact: true }).click();
    await expect(page.getByRole("button", { name: "식단 수정", exact: true })).toBeVisible();
    state = await (await page.request.get("/api/meal-plans")).json();
    plan = state.plans[0];
    for (const e of dinner) {
      const task = plan.tasks.find(
        (t: { recipeId: string; date: string }) =>
          t.recipeId === e.recipeId && t.date === plan.startDate,
      );
      expect(task).toBeTruthy();
      const res = await page.request.patch(`/api/meal-plans/${plan.id}`, {
        data: {
          action: "COOK",
          revision: plan.revision,
          taskId: task.id,
          servings: task.servings,
          location: "FREEZER",
          expiresDate: task.requiredThrough,
        },
      });
      expect(res.status()).toBe(200);
      state = await (await page.request.get("/api/meal-plans")).json();
      plan = state.plans[0];
    }
    const before = state.stock.reduce(
      (sum: number, s: { remaining: number }) => sum + s.remaining,
      0,
    );
    const res = await page.request.patch(`/api/meal-plans/${plan.id}`, {
      data: {
        action: "SERVE_MEAL",
        revision: plan.revision,
        mealTime: "DINNER",
        amounts: dinner.map((e: { id: string }) => ({
          entryId: e.id,
          rating: "GOOD",
          amountEaten: "HALF",
        })),
      },
    });
    expect(res.status()).toBe(200);
    state = await (await page.request.get("/api/meal-plans")).json();
    expect(
      before - state.stock.reduce((sum: number, s: { remaining: number }) => sum + s.remaining, 0),
    ).toBeCloseTo(3);
    expect(
      state.plans[0].entries
        .filter(
          (e: { date: string; mealTime: string; served: boolean }) =>
            e.date === plan.startDate && e.mealTime === "DINNER",
        )
        .every((e: { served: boolean }) => e.served),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "새 식단 짜기", exact: true }).click();
    await expect(page.getByLabel("저녁 식단 유형")).toHaveValue("RICE_SIDES");
    expect(errors).toEqual([]);
  } finally {
    expect(
      (
        await page.request.delete("/api/auth/account", { data: { currentPassword: password } })
      ).status(),
    ).toBe(200);
  }
});
