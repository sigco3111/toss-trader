/**
 * test/e2e/helpers/api-mock.ts — 토스 API mock (v1.2 + v1.3)
 *
 * 실계좌 영향 없이 가짜 응답으로 e2e 테스트.
 * v1.3: STORAGE_PROVIDER=s3 시나리오 mock 추가.
 */

import type { Page, Route } from "@playwright/test";
import type { HistoryRecord } from "@/lib/types";

/**
 * 토스 holdings mock: 삼성전자 10주 + SK하이닉스 5주 + 카카오 20주
 */
const MOCK_HOLDINGS = {
  result: {
    totalPurchaseAmount: { krw: "1150000", usd: null },
    marketValue: {
      amount: { krw: "1200000", usd: null },
      amountAfterCost: { krw: "1200000", usd: null },
    },
    profitLoss: {
      amount: { krw: "50000", usd: null },
      amountAfterCost: { krw: "50000", usd: null },
      rate: "4.55",
      rateAfterCost: "4.55",
    },
    dailyProfitLoss: { amount: { krw: "5000" }, rate: "0.42" },
    items: [
      {
        symbol: "005930",
        symbolName: "삼성전자",
        quantity: 10,
        avgPrice: 70000,
        currentPrice: 75000,
        evalAmount: 750000,
        pnl: 50000,
        pnlRate: 7.14,
      },
      {
        symbol: "000660",
        symbolName: "SK하이닉스",
        quantity: 5,
        avgPrice: 130000,
        currentPrice: 135000,
        evalAmount: 675000,
        pnl: 25000,
        pnlRate: 3.85,
      },
      {
        symbol: "035720",
        symbolName: "카카오",
        quantity: 20,
        avgPrice: 50000,
        currentPrice: 48000,
        evalAmount: 960000,
        pnl: -40000,
        pnlRate: -4.0,
      },
    ],
  },
};

/**
 * 토스 prices mock: { symbol, lastPrice }
 */
const MOCK_PRICES: Record<string, number> = {
  "005930": 75000,
  "000660": 135000,
  "035720": 48000,
};

/**
 * v1.3: STORAGE_PROVIDER 시나리오 (e2e에서 .env 변경 불가)
 * → STORAGE_PROVIDER=s3 환경 가정하고, S3 mock (PUT/GET List) 응답 셋업
 * → S3 미설정 또는 endpoint 오류 시 S3StorageProvider가 "disabled" 응답
 *
 * CI에서 localStorage 'disabled' 응답은 의도된 동작 (Vercel env 없음)
 * dev에서는 env 직접 export → S3 mock 응답 셋업 가능
 */
const S3_MOCK_RECORDS = [
  {
    file: "1752123456.json",
    record: {
      kind: "order",
      epochSeconds: 1752123456,
      createdAt: "2026-07-09T22:00:00.000Z",
      orderId: "order_test_001",
      request: {
        symbol: "005930",
        side: "BUY",
        quantity: 10,
        price: 70000,
        orderType: "LIMIT",
        telegramConfirmed: true,
      },
      response: { ok: true, httpStatus: 200, body: { mock: true } },
    },
  },
];

/**
 * 모든 토스 API + history + telegram mock
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // /api/toss/api/v1/holdings
  await page.route("**/api/toss/api/v1/holdings", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: MOCK_HOLDINGS,
        servedAt: new Date().toISOString(),
        dryRun: true,
        rateLimit: { limit: 5, remaining: 4, reset: 1 },
      }),
    });
  });

  // /api/toss/api/v1/prices?symbols=...
  await page.route("**/api/toss/api/v1/prices**", async (route: Route) => {
    const url = new URL(route.request().url());
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const result = symbols.map((s) => ({
      symbol: s,
      timestamp: new Date().toISOString(),
      lastPrice: String(MOCK_PRICES[s] ?? 70000),
      currency: "KRW",
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { result },
        servedAt: new Date().toISOString(),
        dryRun: true,
        rateLimit: { limit: 10, remaining: 9, reset: 1 },
      }),
    });
  });

  // /api/toss/api/v1/accounts
  await page.route("**/api/toss/api/v1/accounts", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { result: [{ accountSeq: 1, accountName: "종합매매" }] },
        servedAt: new Date().toISOString(),
        dryRun: true,
      }),
    });
  });

  // /api/telegram/send (auto 모드: 즉시 confirmed)
  await page.route("**/api/telegram/send", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const mode = body.confirmMode ?? "telegram";
    const orderId = `order_${Date.now().toString(36)}_test`;
    if (mode === "auto") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          orderId,
          devFallback: false,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "auto 모드: 즉시 confirmed",
          mode: "auto",
        }),
      });
    } else if (mode === "off") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          orderId,
          devFallback: false,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "off 모드: 차단",
          mode: "off",
        }),
      });
    } else {
      // telegram: dev fallback
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          orderId,
          devFallback: true,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "dev fallback: 자동 confirm",
          mode: "telegram",
        }),
      });
    }
  });

  // /api/toss/api/v1/orders (실제 주문 — paper mock)
  await page.route("**/api/toss/api/v1/orders", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          result: {
            orderId: `toss-${Date.now()}`,
            clientOrderId: body.clientOrderId,
            symbol: body.symbol,
            side: body.side,
            quantity: body.quantity,
            price: body.price,
            status: "FILLED",
            executedAt: new Date().toISOString(),
          },
        },
        servedAt: new Date().toISOString(),
        dryRun: true,
      }),
    });
  });

  // v1.3: /api/history (GET/POST) — STORAGE_PROVIDER별 mock
  // 기본 = readonly (Vercel CI 환경 가정)
  // STORAGE_PROVIDER=s3 + env 설정 = S3 mock 응답
  await page.route("**/api/history**", async (route: Route) => {
    if (route.request().method() === "GET") {
      // S3 mock: availability 'available' + records (e2e 시나리오)
      // Vercel CI에서는 'readonly' (env 없음) — 두 시나리오 모두 처리 가능하도록
      const url = new URL(route.request().url());
      const symbol = url.searchParams.get("symbol");
      const kind = url.searchParams.get("kind") as
        | "analysis"
        | "order"
        | "snapshot"
        | null;
      let filtered = S3_MOCK_RECORDS;
      if (kind) filtered = filtered.filter((r) => r.record.kind === kind);
      if (symbol) {
        filtered = filtered.filter((r) => {
          const rec = r.record as HistoryRecord;
          if (rec.kind === "order") return rec.request.symbol === symbol;
          if (rec.kind === "analysis") return rec.symbol === symbol;
          return false; // snapshot은 symbol 없음
        });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          availability: "available", // S3 mock enabled
          count: filtered.length,
          records: filtered,
          servedAt: new Date().toISOString(),
        }),
      });
    } else {
      // POST: 항상 저장 성공 (S3 mock)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          availability: "available",
          saved: true,
          filename: `s3-mock-${Date.now()}.json`,
          servedAt: new Date().toISOString(),
        }),
      });
    }
  });
}
