import { expect, test } from "@playwright/test";

test.describe("2-A 핵심 사용자 여정 E2E (ACC, PRF, REC, RCP, SRV, LOG)", () => {
  test("비로그인 상태에서 보호 페이지 접근 시 /login 리다이렉트 및 보호 API 401 반환 (ACC-01)", async ({
    page,
    request,
  }) => {
    const apiRes = await request.get("/api/babies");
    expect(apiRes.status()).toBe(401);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("가입 → 복구 코드 저장 → 프로필 생성 → 추천 확인 → 레시피 3회분 조절 → 먹은 기록 → 로그아웃 → 복구 코드로 비밀번호 재설정 → 재로그인", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const loginId = `p0user${suffix}`;
    const initialPw = "babymeal1234";
    const nextPw = "newpass5678";

    // 1. 회원가입 (ACC-01~05)
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(loginId);
    await page.getByLabel(/^비밀번호 \(/).fill(initialPw);
    await page.getByLabel("비밀번호 확인").fill(initialPw);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();

    // 2. 복구 코드 1회 노출 및 저장 확인 체크 전 다음 진행 불가 검증 (ACC-04)
    const codeDisplay = page.getByTestId("recovery-code-display");
    await expect(codeDisplay).toBeVisible();
    const recoveryCode = (await codeDisplay.innerText()).trim();
    expect(recoveryCode).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);

    const confirmBtn = page.getByTestId("recovery-code-confirm-btn");
    await expect(confirmBtn).toBeDisabled();
    await page.getByTestId("recovery-code-saved-checkbox").check();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 3. 온보딩 아기 프로필 생성 (PRF-01~03)
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel(/아기 애칭/).fill("튼튼이");
    await page.getByLabel(/현재 월령/).selectOption("15");
    await expect(page.getByTestId("auto-stage-preview")).toContainText("완료기");
    await page.getByRole("button", { name: "시작하기" }).click();

    // 4. 홈 오늘의 추천 확인 (REC-01, REC-04)
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /튼튼이의 오늘 추천 메뉴/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘의 식사 추천" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘의 간식 추천" })).toBeVisible();

    // 첫 번째 추천 레시피 상세 진입
    const firstRecipeLink = page.locator("article h3 a").first();
    const chosenRecipeName = (await firstRecipeLink.innerText()).trim();
    await firstRecipeLink.click();

    // 5. 레시피 상세 + 1회분 대비 3회분 조절 및 소분 팁 확인 (RCP-01~06, SRV-01~05, AI-08)
    await expect(page.getByRole("heading", { name: chosenRecipeName })).toBeVisible();
    await expect(page.getByTestId("ai-safety-disclaimer")).toBeVisible();

    await page.getByTestId("serving-btn-1").click();
    await expect(page.getByTestId("portion-storage-tip")).toHaveCount(0);
    const firstAmountLocator = page.locator('[data-testid^="ingredient-amount-"]').first();
    const oneServingText = (await firstAmountLocator.innerText()).trim();

    await page.getByTestId("serving-btn-3").click();
    await expect(page.getByTestId("portion-storage-tip")).toContainText("3회분 조리");
    const threeServingText = (await firstAmountLocator.innerText()).trim();
    if (oneServingText !== "약간") {
      expect(threeServingText).not.toBe(oneServingText);
    }

    // 6. 먹었어요 기록 저장 및 기록 탭 확인 (LOG-01~06)
    await page.locator("#meal-log-form > summary").press("Enter");
    await page.getByRole("radio", { name: "잘 먹었어요", exact: true }).check();
    await page.getByLabel(/메모/).fill("완밥 성공!");
    await page.getByRole("button", { name: "먹었어요 저장" }).click();
    await expect(page.getByTestId("meal-log-success")).toBeVisible();

    await page.getByRole("link", { name: "기록" }).click();
    await expect(page).toHaveURL(/\/logs$/);
    await expect(page.getByRole("link", { name: chosenRecipeName })).toBeVisible();
    await page.getByRole("tab", { name: "메뉴별 누적 보기" }).click();
    await expect(page.getByText(/잘 먹음 1회/)).toBeVisible();

    // 7. 로그아웃 (ACC-06)
    await page.getByRole("link", { name: "마이" }).click();
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 8. 복구 코드로 비밀번호 재설정 → 새 코드 발급 확인 → 재로그인 (ACC-04)
    await page.getByRole("link", { name: "복구 코드로 비밀번호 재설정" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel("아이디").fill(loginId);
    await page.getByLabel("복구 코드").fill(recoveryCode);
    await page.getByLabel(/새 비밀번호 \(/).fill(nextPw);
    await page.getByLabel("새 비밀번호 확인").fill(nextPw);
    await page.getByRole("button", { name: "비밀번호 재설정" }).click();

    const newCodeDisplay = page.getByTestId("recovery-code-display");
    await expect(newCodeDisplay).toBeVisible();
    const rotatedCode = (await newCodeDisplay.innerText()).trim();
    expect(rotatedCode).not.toBe(recoveryCode);

    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();
    await expect(page).toHaveURL(/\/login$/);

    // 새 비밀번호로 로그인 성공 확인
    await page.getByLabel("아이디").fill(loginId);
    await page.getByLabel("비밀번호").fill(nextPw);
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /튼튼이의 오늘 추천 메뉴/ })).toBeVisible();
  });
});
