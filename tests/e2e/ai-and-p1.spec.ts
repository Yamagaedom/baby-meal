import { expect, type Page, test } from "@playwright/test";

async function clearAndSelectSingleIngredient(page: Page, ingredientName: string) {
  // 기존 선택된 재료 칩이 있으면 모두 해제
  const removeButtons = page.locator('button[aria-label$="선택 해제"]');
  while ((await removeButtons.count()) > 0) {
    await removeButtons.first().click();
  }

  const searchInput = page.locator("#pantry-search");
  await searchInput.fill(ingredientName);
  const suggestionBtn = page.locator("ul button", { hasText: ingredientName }).first();
  await expect(suggestionBtn).toBeVisible();
  await suggestionBtn.click();
}

test.describe("2-B 즉석 AI 레시피 생성 및 P1 기능 E2E (ING-06/07, AI-06~11, RCP-07, LOG-07)", () => {
  test("즉석 AI 생성 E2E (모킹): 검증 실패·전역 상한·캐시 적중 시 미차감, 3회 생성 성공 후 4번째 요청 차단 및 출처·고지·기본 일러스트 확인", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `aiuser${suffix}`;
    const password = "aimeal1234";

    // 1. 회원가입 및 복구 코드 확인
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(loginId);
    await page.getByLabel(/^비밀번호 \(/).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();
    await expect(page).toHaveURL(/\/onboarding$/);

    // 반복 실행 시에도 DB 캐시 키가 매 실행 고유하도록 무작위 주의 식재료 조합으로 아기 프로필 생성
    const allergyListRes = await page.request.get("/api/ingredients?mode=allergy&q=");
    expect(allergyListRes.ok()).toBe(true);
    const allergyCandidates: { id: string; name: string }[] = (await allergyListRes.json()).results;
    const reservedNames = new Set([
      "쌀밥",
      "감자",
      "물",
      "퀴노아",
      "아마란스",
      "기장",
      "차조",
      "소고기",
      "닭안심",
    ]);
    const pool = allergyCandidates.filter((c) => !reservedNames.has(c.name));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const randomExcludedIds = shuffled.slice(0, 4).map((c) => c.id);

    const createBabyRes = await page.request.post("/api/babies", {
      data: {
        nickname: "별하",
        ageMonth: 15,
        saltLevel: "NONE",
        ingredientIds: randomExcludedIds,
      },
    });
    expect(createBabyRes.status()).toBe(201);

    // 2. 재료로 찾기 화면 진입 및 초기 남은 횟수 3/3 확인
    await page.goto("/ingredients");
    await expect(page.getByTestId("ai-quota-badge")).toContainText("3/3");

    // 80% 이상 일치 레시피가 3개 미만인 희소 안전 곡류('퀴노아') 선택 → 즉석 AI 슬롯 노출 확인 (ING-06)
    await clearAndSelectSingleIngredient(page, "퀴노아");
    await expect(page.getByTestId("ai-generation-slot")).toBeVisible();
    await expect(page.getByTestId("ai-generate-btn")).toContainText("3/3");

    const quinoaLookupRes = await page.request.get(
      `/api/ingredients?q=${encodeURIComponent("퀴노아")}`,
    );
    const quinoaId: string = (await quinoaLookupRes.json()).results[0].id;

    // 3. 안전 검증 실패 시 횟수 미차감 확인 (AI-05, AI-10)
    const failSafetyRes = await page.request.post("/api/ai/generate-recipe", {
      headers: { "x-ai-mock-behavior": "FAIL_SAFETY" },
      data: { ingredientIds: [quinoaId], category: "MEAL" },
    });
    expect(failSafetyRes.status()).toBe(422);
    expect((await failSafetyRes.json()).error.code).toBe("AI_SAFETY_REJECTED");

    const quotaAfterFail = (await (await page.request.get("/api/ai/quota")).json()).quota;
    expect(quotaAfterFail.remainingToday).toBe(3);

    // 4. 전역 일일 상한 도달 시 차단 및 횟수 미차감 확인 (AI-11)
    const globalCapRes = await page.request.post("/api/ai/generate-recipe", {
      headers: { "x-ai-mock-global-limit": "0" },
      data: { ingredientIds: [quinoaId], category: "MEAL" },
    });
    expect(globalCapRes.status()).toBe(429);
    expect((await globalCapRes.json()).error.code).toBe("GLOBAL_QUOTA_EXCEEDED");

    // 5. 1회차 UI 생성 성공 ('퀴노아' → 남은 횟수 2/3)
    await page.getByTestId("ai-generate-btn").click();
    const resultCard = page.getByTestId("ai-generated-result-card");
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toContainText("새 AI 안전 검증 레시피 생성 완료");
    await expect(page.getByTestId("ai-quota-badge")).toContainText("2/3");

    // 6. 동일 재료('퀴노아') 재요청 시 캐시 적중 반환 및 횟수 미차감 확인 (AI-09, AI-10)
    await page.getByTestId("ai-generate-btn").click();
    await expect(resultCard).toContainText("기존 동일 조건 레시피 반환 (횟수 미차감)");
    await expect(page.getByTestId("ai-quota-badge")).toContainText("2/3");

    // AI·의료 고지와 참고 출처는 유지하며 개발용 placeholder는 노출하지 않습니다.
    await resultCard.getByRole("link", { name: /상세 조리법 보기/ }).click();
    await expect(page.getByTestId("ai-safety-disclaimer")).toBeVisible();
    await expect(page.getByTestId("default-category-illustration")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /식품안전나라/ })).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(0);

    // 7. 다시 재료 화면으로 돌아와 2회차('아마란스' → 1/3), 3회차('기장' → 0/3) 생성 후 소진 상태 확인
    await page.goto("/ingredients");
    await expect(page.getByTestId("ai-quota-badge")).toContainText("2/3");

    await clearAndSelectSingleIngredient(page, "아마란스");
    await expect(page.getByTestId("ai-generation-slot")).toBeVisible();
    await page.getByTestId("ai-generate-btn").click();
    await expect(page.getByTestId("ai-generated-result-card")).toContainText(
      "새 AI 안전 검증 레시피 생성 완료",
    );
    await expect(page.getByTestId("ai-quota-badge")).toContainText("1/3");

    await clearAndSelectSingleIngredient(page, "기장");
    await expect(page.getByTestId("ai-generation-slot")).toBeVisible();
    await page.getByTestId("ai-generate-btn").click();
    await expect(page.getByTestId("ai-generated-result-card")).toContainText(
      "새 AI 안전 검증 레시피 생성 완료",
    );
    await expect(page.getByTestId("ai-quota-badge")).toContainText("0/3");

    // 3회 소진 안내 노출 및 생성 버튼 비활성화 확인 (AI-10)
    await expect(page.getByTestId("ai-user-limit-notice")).toBeVisible();
    await expect(page.getByTestId("ai-generate-btn")).toBeDisabled();

    // 8. 4번째 신규 조합('차조') API 강제 요청 시 429 USER_QUOTA_EXCEEDED 차단 확인
    const foxtailRes = await page.request.get(`/api/ingredients?q=${encodeURIComponent("차조")}`);
    const foxtailId: string = (await foxtailRes.json()).results[0].id;

    const fourthAttemptRes = await page.request.post("/api/ai/generate-recipe", {
      data: { ingredientIds: [foxtailId], category: "MEAL" },
    });
    expect(fourthAttemptRes.status()).toBe(429);
    expect((await fourthAttemptRes.json()).error.code).toBe("USER_QUOTA_EXCEEDED");
  });

  test("P1 핵심 흐름: 내 냉장고 저장·재방문 로드·요리 완료 재료 차감, 조리 모드(Wake Lock/큰 글씨), 입맛 리포트 확인", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `p1user${suffix}`;
    const password = "p1meal1234";

    // 1. 회원가입 및 온보딩 프로필 생성
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(loginId);
    await page.getByLabel(/^비밀번호 \(/).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();

    await page.getByLabel(/아기 애칭/).fill("다온이");
    await page.getByLabel(/현재 월령/).selectOption("20");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 2. 내 냉장고 재료 저장 후 재방문 시 자동 로드 확인 (ING-07)
    await page.getByRole("link", { name: "레시피" }).first().click();
    await page.getByRole("link", { name: "재료로 찾기" }).click();
    await expect(page).toHaveURL(/\/ingredients$/);

    await page.getByRole("button", { name: "감자", exact: true }).click();
    await page.getByRole("button", { name: "당근", exact: true }).click();
    await page.getByTestId("save-pantry-btn").click();
    await expect(page.getByTestId("pantry-save-notice")).toContainText(
      "내 냉장고에 재료 2개가 저장되었습니다.",
    );

    await page.getByRole("link", { name: "홈" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("link", { name: "레시피" }).first().click();
    await page.getByRole("link", { name: "재료로 찾기" }).click();
    await expect(page.getByTestId("pantry-save-notice")).toContainText(
      "내 냉장고에 저장된 재료 2개를 불러왔습니다.",
    );
    await expect(page.getByRole("heading", { name: /매칭된 레시피/ })).toBeVisible();

    // 매칭된 첫 번째 레시피 상세 진입
    const firstMatchedLink = page.locator("article h3 a").first();
    const matchedRecipeName = (await firstMatchedLink.innerText()).trim();
    await firstMatchedLink.click();

    // 3. 조리 모드 모달 열기·단계 이동·닫기 확인 (RCP-07)
    await page.getByTestId("open-cooking-mode-btn").click();
    await expect(page.getByTestId("cooking-mode-dialog")).toBeVisible();
    await expect(page.getByTestId("wake-lock-status")).toBeVisible();
    await expect(page.getByTestId("cooking-step-indicator")).toContainText("단계 1 /");

    await page.getByTestId("cooking-next-step-btn").click();
    await expect(page.getByTestId("cooking-step-indicator")).toContainText("단계 2 /");
    await page.getByRole("button", { name: "조리 모드 닫기" }).click();
    await expect(page.getByTestId("cooking-mode-dialog")).toHaveCount(0);

    // 4. 요리 완료 후 내 냉장고 사용 재료 차감 확인 (ING-07)
    await expect(page.getByTestId("pantry-deduct-section")).toBeVisible();
    await page.getByTestId("deduct-pantry-btn").click();
    await expect(page.getByTestId("pantry-deduct-notice")).toContainText("차감했습니다.");

    // 5. 먹었어요 기록 저장 후 기록 탭 '입맛 리포트' 확인 (LOG-07)
    await page.locator("#meal-log-form > summary").press("Enter");
    await page.getByRole("button", { name: "먹었어요 저장" }).click();
    await expect(page.getByTestId("meal-log-success")).toBeVisible();

    await page.getByRole("link", { name: "기록" }).click();
    await expect(page).toHaveURL(/\/logs$/);
    await page.getByRole("tab", { name: "입맛 리포트" }).click();

    const reportSection = page.getByTestId("taste-report-section");
    await expect(reportSection).toBeVisible();
    await expect(reportSection).toContainText(matchedRecipeName);
    await expect(reportSection).toContainText("잘 먹은 TOP 식재료");
    await expect(reportSection).toContainText("아직 시도 안 한 추천 식재료");
  });
});
