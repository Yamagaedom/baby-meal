import { expect, test } from "@playwright/test";
import { kstDateString, toKstDateParts } from "../../src/lib/age";

function birthDateMonthsAgo(monthsAgo: number): string {
  const { year, month, day } = toKstDateParts(new Date());
  const targetDate = new Date(Date.UTC(year, month - 1 - monthsAgo, Math.min(day, 15)));
  return kstDateString(targetDate);
}

test("생년월일 입력 시 월령·단계·간 단계가 실시간 자동 반영되고 확장 레시피 200+개가 제공된다", async ({
  page,
}) => {
  test.setTimeout(90000);
  const password = "bday-check-1234";
  const loginId = `bdaye2e${Date.now().toString().slice(-7)}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. 헬스체크 레시피 수 202개 이상(기존 152 + 신규 56 = 208) 검증
  const healthRes = await page.request.get("/api/health");
  expect(healthRes.status()).toBe(200);
  const healthJson = await healthRes.json();
  expect(healthJson.counts.recipes).toBeGreaterThanOrEqual(202);

  // 2. 가입 후 온보딩에서 생년월일 입력 → 월령·단계·저염 자동 반영 확인
  const signupRes = await page.request.post("/api/auth/signup", {
    data: { loginId, password, agreeIrrecoverable: true },
  });
  expect(signupRes.status()).toBe(201);

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding");

    const birth27m = birthDateMonthsAgo(27); // 유아식 2단계(25~36개월), 기본 간 단계 LOW
    await page.getByLabel(/아기 애칭/).fill("생일튼튼이");
    await page.getByLabel(/아기 생년월일/).fill(birth27m);

    const preview = page.getByTestId("auto-stage-preview");
    await expect(preview).toContainText(birth27m);
    await expect(preview).toContainText("유아식 2단계");

    // 기본 간 단계가 자동으로 저염(LOW)으로 전환되었는지 확인
    const lowSaltRadio = page.locator('input[name="saltLevel"][value="LOW"]');
    await expect(lowSaltRadio).toBeChecked();

    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 3. 마이페이지(/my)에서 생년월일 배지 노출 및 수정 폼 초기값 유지 확인
    await page.goto("/my");
    await expect(page.getByText(new RegExp(`생년월일 ${birth27m} · 월령 자동 반영`))).toBeVisible();

    await page.getByRole("button", { name: "수정" }).first().click();
    await expect(page.getByLabel(/아기 생년월일/)).toHaveValue(birth27m);

    // 4. 레시피 탐색(/recipes)에서 새로 추가된 확장 레시피 검색 확인
    await page.goto("/recipes");
    const searchInput = page.getByRole("searchbox", { name: "레시피 이름 검색" });
    await searchInput.fill("소고기단호박오트밀영양죽");
    await searchInput.press("Enter");
    await expect(
      page.getByRole("link", { name: /소고기단호박오트밀영양죽/ }).first(),
    ).toBeVisible();

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    const delRes = await page.request.delete("/api/auth/account", {
      data: { currentPassword: password },
    });
    expect(delRes.status()).toBe(200);
  }
});
