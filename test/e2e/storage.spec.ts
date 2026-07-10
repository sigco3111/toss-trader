/**
 * test/e2e/storage.spec.ts — Storage provider e2e (v1.3.1)
 *
 * STORAGE_PROVIDER=s3 + S3 mock (helpers/api-mock.ts에서 availability='available' +
 * records 셋업) 시나리오. Vercel preview URL에서 S3 mock이 검증.
 *
 * v1.3.1: /api/history mock을 'available'로 변경 → e2e에서도 S3 시나리오 검증 가능.
 */

import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./helpers/api-mock";

test.describe("Storage (v1.3 S3/R2 mock)", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("History 탭 GET /api/history → availability 'available' (S3 mock)", async ({ page }) => {
    await page.goto("/");

    // History 탭 클릭
    await page.getByRole("tab", { name: /History/ }).click();

    // S3 mock: availability 'available', records 1개 (삼성전자 10주 1752123456)
    await expect(page.getByRole("heading", { name: /삼성전자.*005930.*이력/ })).toBeVisible();
    // 기록 표시 (History 컴포넌트 표) — epoch → 사람이 읽는 날짜로 변환됨
    await expect(page.getByText(/삼성전자/)).toBeVisible();
    // 2025-07-09 22:00 (epoch 1752123456) KST
    await expect(page.getByText(/2025.*7.*9/)).toBeVisible();
  });

  test("History 탭 kind=order 필터 → order 기록만 표시", async ({ page }) => {
    await page.goto("/");

    // History 탭
    await page.getByRole("tab", { name: /History/ }).click();

    // kind=order 필터 (S3 mock records는 order 1개)
    await page.locator("select[aria-label='kind 필터']").selectOption("order");
    await expect(page.getByText(/삼성전자/)).toBeVisible();
    // 날짜 표시 (epoch 1752123456 → 2025-07-09)
    await expect(page.getByText(/2025.*7.*9/)).toBeVisible();
  });
});
