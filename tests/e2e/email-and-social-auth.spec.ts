import { expect, test } from "@playwright/test";

test.describe("이메일 회원가입·로그인 및 카카오·구글·네이버 SNS 연동 E2E", () => {
  test("이메일 가입 → 온보딩 → 로그아웃 → 동일 이메일 카카오 SNS 자동 통합 로그인 → 마이페이지 구글·네이버 연동 및 해제", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const email = `mom${suffix}@example.com`;
    const password = "emailpass1234";

    // 1. 이메일 주소로 회원가입
    await page.goto("/signup");
    await page.getByLabel(/^아이디/).fill(email);
    await page.getByLabel(/^비밀번호 \(/).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입 및 복구 코드 발급" }).click();

    await page.getByTestId("recovery-code-saved-checkbox").check();
    await page.getByTestId("recovery-code-confirm-btn").click();

    // 2. 온보딩 아기 프로필 등록
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel(/아기 애칭/).fill("다온이");
    await page.getByLabel(/현재 월령/).selectOption("18");
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /다온이의 오늘 추천 메뉴/ })).toBeVisible();

    // 3. 마이페이지에서 로그아웃
    await page.getByRole("link", { name: "마이" }).click();
    await expect(page).toHaveURL(/\/my$/);
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 4. 로그인 화면에서 '카카오로 로그인' 선택 → 동일 이메일 입력 시 기존 계정(다온이 프로필)으로 자동 통합 로그인
    await page.getByTestId("social-btn-kakao").click();
    await expect(page.getByTestId("social-auth-panel")).toBeVisible();
    await page.locator("#social-auth-email").fill(email);
    await page.getByTestId("social-auth-submit").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /다온이의 오늘 추천 메뉴/ })).toBeVisible();

    // 5. 마이페이지 진입 → 카카오 '연동됨' 확인 + 구글/네이버 추가 연동 및 해제 확인
    await page.getByRole("link", { name: "마이" }).click();
    await expect(page).toHaveURL(/\/my$/);
    await expect(page.getByTestId("my-social-accounts-section")).toBeVisible();
    await expect(page.getByTestId("my-social-card-kakao")).toContainText("연동됨");
    await expect(page.getByTestId("my-social-card-google")).toContainText("미연동");
    await expect(page.getByTestId("my-social-card-naver")).toContainText("미연동");

    // 구글 연동하기
    await page.getByTestId("social-link-google").click();
    await expect(page.getByTestId("my-social-link-panel")).toBeVisible();
    await page.getByTestId("social-link-confirm-btn").click();
    await expect(page.getByTestId("my-social-card-google")).toContainText("연동됨");

    // 네이버 연동하기
    await page.getByTestId("social-link-naver").click();
    await page.getByTestId("social-link-confirm-btn").click();
    await expect(page.getByTestId("my-social-card-naver")).toContainText("연동됨");

    // 네이버 연동 해제
    await page.getByTestId("social-unlink-naver").click();
    await expect(page.getByTestId("my-social-card-naver")).toContainText("미연동");
  });

  test("신규 사용자가 회원가입 화면에서 '구글로 시작하기'로 즉시 가입 시 온보딩으로 이동한다", async ({
    page,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const googleEmail = `googlemom${suffix}@gmail.com`;

    await page.goto("/signup");
    await page.getByTestId("social-btn-google").click();
    await expect(page.getByTestId("social-auth-panel")).toBeVisible();
    await page.locator("#social-auth-email").fill(googleEmail);
    await page.getByTestId("social-auth-submit").click();

    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
