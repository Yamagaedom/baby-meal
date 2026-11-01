import { expect, test } from "@playwright/test";
import catalog from "../../src/data/recipe-catalog-repair.json";

test("catalog recovery: source, portions, visible candidates and allergy blocking", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const password = "catalog-check-1234";
  const signup = await page.request.post("/api/auth/signup", {
    data: { loginId: `catalog${Date.now()}`, password, agreeIrrecoverable: true },
  });
  expect(signup.status()).toBe(201);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const profile = await page.request.post("/api/babies", {
      data: { nickname: "목록검증", ageMonth: 15, saltLevel: "NONE", allergens: [] },
    });
    expect(profile.status()).toBe(201);
    const baby = (await profile.json()).baby;
    const list = await page.request.get("/api/recipes");
    expect(list.status()).toBe(200);
    const items = (await list.json()).items;
    expect(items.length).toBeGreaterThanOrEqual(55);
    const stageOneItems = (await (await page.request.get("/api/recipes?stage=1")).json()).items;
    expect(stageOneItems.length).toBeGreaterThanOrEqual(55);
    const restored = catalog.recipes.find(
      (r) => r.newRecipeId && r.ageStages.includes(1) && r.allergens.includes("BEEF"),
    )!;
    expect(items.some((r: { id: string }) => r.id === restored.newRecipeId)).toBe(true);
    const one = (
      await (await page.request.get(`/api/recipes/${restored.newRecipeId}?servings=1`)).json()
    ).recipe;
    const four = (
      await (await page.request.get(`/api/recipes/${restored.newRecipeId}?servings=4`)).json()
    ).recipe;
    expect(one.nutrition).toEqual(four.nutrition);
    expect(one.nutrition.estimate.sources[0].title).toContain("USDA");
    expect(
      one.sources.some(
        (s: { verificationStatus: string; url: string }) =>
          s.verificationStatus === "VERIFIED" &&
          /^https:\/\/www.youtube.com\/watch\?v=[\w-]{11}$/.test(s.url),
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/recipes/${restored.newRecipeId}`);
    await expect(page.getByRole("heading", { name: "영양 성분 추정", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /재료 조합 참고/ })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("catalog-detail-mobile.png"),
      fullPage: true,
    });
    await page.goto("/recipes");
    const restoredLink = page.getByRole("link", { name: new RegExp(restored.name) }).first();
    const more = page.getByRole("button", { name: /레시피 더보기/ });
    while (!(await restoredLink.isVisible()) && await more.isVisible()) {
      await more.click();
    }
    await expect(restoredLink).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("catalog-list-mobile.png"), fullPage: true });
    const allergic = await page.request.patch(`/api/babies/${baby.id}`, {
      data: { nickname: "목록검증", ageMonth: 15, saltLevel: "NONE", allergens: ["BEEF"] },
    });
    expect(allergic.status()).toBe(200);
    const blocked = await page.request.get(`/api/recipes/${restored.newRecipeId}`);
    expect(blocked.status()).toBe(403);
    const safeItems = (await (await page.request.get("/api/recipes")).json()).items;
    expect(
      safeItems.every((r: { allergens: { code: string }[] }) =>
        r.allergens.every((a) => a.code !== "BEEF"),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify({
        allStagesVisibleRecipes: items.length,
        stageOneVisibleRecipes: stageOneItems.length,
        allergyBlocking: true,
        servingsStable: true,
        sourceVisible: true,
      }),
    );
  } finally {
    const deleted = await page.request.delete("/api/auth/account", {
      data: { currentPassword: password },
    });
    expect(deleted.status()).toBe(200);
  }
});
