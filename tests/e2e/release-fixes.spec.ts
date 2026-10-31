import { expect, test } from "@playwright/test";

/**
 * 출시 전 이슈 E2E 회귀 검증 (ISSUE-02 오프라인 캐시 정화, ISSUE-04 잘못된 UUID 404, ISSUE-08 CSRF 차단)
 */
test.describe("출시 전 이슈 회귀 — 오프라인 정화·잘못된 ID·CSRF", () => {
  test("잘못된 UUID 404, 교차 사이트 변경 요청 403, 직접 등록 식재료 충돌 즐겨찾기 오프라인 스냅샷 즉시 정화", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(`relfix${suffix}`);
    await page.getByLabel(/^비밀번호 \(/).fill("relfix1234");
    await page.getByLabel("비밀번호 확인").fill("relfix1234");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel(/아기 애칭/).fill("정화이");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // ISSUE-04: 잘못된 UUID 형식은 500 크래시가 아닌 404 not-found 화면 및 404 API 응답
    await page.goto("/recipes/not-a-uuid");
    await expect(page.getByText("찾으시는 페이지나 레시피가 없어요")).toBeVisible();
    const badApi = await page.request.get("/api/recipes/not-a-uuid");
    expect(badApi.status()).toBe(404);

    // ISSUE-08: 교차 사이트 상태 변경 요청 차단
    const csrfRes = await page.request.post("/api/favorites", {
      headers: { Origin: "https://evil.example.com", "Sec-Fetch-Site": "cross-site" },
      data: { recipeId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(csrfRes.status()).toBe(403);
    expect((await csrfRes.json()).error.code).toBe("CSRF_BLOCKED");

    // ISSUE-02: 즐겨찾기 → 오프라인 스냅샷 저장 확인
    await page.goto("/");
    await page.locator("article h3 a").first().click();
    await expect(page).toHaveURL(/\/recipes\//);
    const recipeId = page.url().split("/recipes/")[1].split(/[?#]/)[0];
    await page.getByRole("button", { name: /즐겨찾기/ }).click();
    await expect(page.getByRole("button", { name: /즐겨찾기됨/ })).toBeVisible();

    const snapshot = await page.evaluate((rid) => {
      const raw = window.localStorage.getItem("baby_meal_offline_favorites_v1");
      const entries = raw ? JSON.parse(raw) : [];
      const hit = entries.find((e: { recipe: { id: string } }) => e.recipe.id === rid);
      return {
        babyId: window.localStorage.getItem("baby_meal_active_baby_id_v1"),
        ingredientId: hit?.recipe?.ingredients?.[0]?.ingredientId ?? null,
      };
    }, recipeId);
    expect(snapshot.babyId).toBeTruthy();
    expect(snapshot.ingredientId).toBeTruthy();

    // 해당 레시피의 재료를 '직접 식재료 알레르기'로 등록 (알레르기 코드가 아닌 ingredientId 기반)
    const patchRes = await page.request.patch(`/api/babies/${snapshot.babyId}`, {
      data: { ingredientIds: [snapshot.ingredientId] },
    });
    expect(patchRes.ok()).toBe(true);

    // 화면 재진입 시 오프라인 저장소에서 충돌 레시피가 즉시 제거되어야 함
    await page.goto("/my");
    await expect
      .poll(async () =>
        page.evaluate((rid) => {
          const raw = window.localStorage.getItem("baby_meal_offline_favorites_v1");
          const entries = raw ? JSON.parse(raw) : [];
          return entries.some((e: { recipe: { id: string } }) => e.recipe.id === rid);
        }, recipeId),
      )
      .toBe(false);
  });
});
