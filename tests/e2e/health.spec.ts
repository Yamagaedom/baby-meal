import { expect, test } from "@playwright/test";

test("헬스체크 API(/api/health)가 DB 연결 및 시드 데이터 건수를 정상 응답한다", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("connected");
  expect(body.counts.ingredients).toBeGreaterThanOrEqual(200);
  expect(body.counts.recipes).toBeGreaterThanOrEqual(30);
});
