import { expect, test } from "@playwright/test";

test.describe("알레르기 절대 차단 안전 정책 E2E (REC-02, PRF-03, ING-01~05)", () => {
  test("달걀 알레르기 프로필에서 달걀 포함 레시피가 추천·전체목록·재료검색·즐겨찾기·직접 URL/API 접근 어디에서도 노출되지 않는다", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `eggtest${suffix}`;
    const password = "safemeal1234";

    // 1. 가입 후 먼저 알레르기 없는 프로필로 달걀 포함 레시피 ID를 조회하고 즐겨찾기에 담아 둔다.
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(loginId);
    await page.getByLabel(/^비밀번호 \(/).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();

    await page.getByLabel(/아기 애칭/).fill("알콩이");
    await page.getByLabel(/현재 월령/).selectOption("24");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // API로 달걀(EGG) 알레르기 유발 성분이 포함된 실제 시드 레시피 1건 확보 + 즐겨찾기 추가
    const recipesRes = await page.request.get("/api/recipes");
    expect(recipesRes.ok()).toBe(true);
    const recipesJson = await recipesRes.json();
    const eggRecipes: { id: string; name: string; allergens: { code: string }[] }[] =
      recipesJson.items.filter((r: { allergens: { code: string }[] }) =>
        r.allergens.some((a) => a.code === "EGG"),
      );
    expect(eggRecipes.length).toBeGreaterThan(0);

    const targetEggRecipe = eggRecipes[0];
    const eggRecipeNames = new Set(eggRecipes.map((r) => r.name));

    const favBeforeRes = await page.request.post("/api/favorites", {
      data: { recipeId: targetEggRecipe.id },
    });
    expect(favBeforeRes.ok()).toBe(true);

    // 2. 마이페이지에서 아기 프로필에 '달걀(알류)' 알레르기 등록
    await page.getByRole("link", { name: "마이" }).click();
    await page.getByRole("button", { name: "수정" }).click();
    await page.getByLabel("달걀(알류)").check();
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("프로필이 수정되었습니다.")).toBeVisible();

    // 3. 홈 오늘의 추천에서 달걀 포함 레시피가 전혀 노출되지 않음 검증
    await page.getByRole("link", { name: "홈" }).click();
    await expect(page.getByTestId("active-allergy-bar")).toContainText("달걀(알류)");
    const homeCardTitles = await page.locator("article h3 a").allInnerTexts();
    for (const title of homeCardTitles) {
      expect(eggRecipeNames.has(title.trim())).toBe(false);
    }

    // 4. 전체 레시피 탐색 및 '즐겨찾기만 보기'에서도 이전에 즐겨찾기해 둔 달걀 레시피가 노출되지 않음 + 즐겨찾기 API 403 차단
    await page
      .getByRole("navigation", { name: "주 메뉴" })
      .getByRole("link", { name: "레시피", exact: true })
      .click();
    await expect(page).toHaveURL(/\/recipes$/);
    const allCardTitles = await page.locator("article h3 a").allInnerTexts();
    for (const title of allCardTitles) {
      expect(eggRecipeNames.has(title.trim())).toBe(false);
    }

    await page.getByRole("button", { name: "즐겨찾기", exact: true }).click();
    await expect(page.getByRole("link", { name: targetEggRecipe.name })).toHaveCount(0);

    const favBlockedRes = await page.request.post("/api/favorites", {
      data: { recipeId: targetEggRecipe.id },
    });
    expect(favBlockedRes.status()).toBe(403);

    // 5. 재료로 찾기에서 인기 칩에 '달걀'이 제외되고, 두부 등 다른 재료 검색 결과에도 달걀 포함 레시피가 전혀 나오지 않음
    await page.getByRole("link", { name: "재료로 찾기", exact: true }).first().click();
    await expect(page).toHaveURL(/\/ingredients$/);
    await expect(page.getByRole("button", { name: "달걀", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "두부", exact: true }).click();
    await expect(page.getByRole("heading", { name: /매칭된 레시피/ })).toBeVisible();
    const ingMatchedTitles = await page.locator("article h3 a").allInnerTexts();
    for (const title of ingMatchedTitles) {
      expect(eggRecipeNames.has(title.trim())).toBe(false);
    }

    // 6. 직접 URL 접근(/recipes/[id]) 및 단건 API 호출 시 레시피명·재료·조리법이 숨겨지고 403 안전 차단됨 검증
    const directApiRes = await page.request.get(`/api/recipes/${targetEggRecipe.id}`);
    expect(directApiRes.status()).toBe(403);

    await page.goto(`/recipes/${targetEggRecipe.id}`);
    await expect(page.getByTestId("allergy-blocked-notice")).toBeVisible();
    await expect(page.getByRole("heading", { name: targetEggRecipe.name })).toHaveCount(0);
  });
});
