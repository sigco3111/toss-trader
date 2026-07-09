/**
 * test/safety.test.ts — toss-trader 6대 안전 가드 TDD (3단계)
 *
 * v0.3 단순화: 6대 가드 모두 외부 HTTP 호출 0. 순수 함수로 테스트 가능.
 * 시간 의존(가드 3) 가드는 `now` 주입으로 결정론적.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { guardRequest } from "@/lib/safety";

// ─── 환경변수 헬퍼 ───────────────────────────────────────────────
const ENV_BACKUP = { ...process.env };

beforeEach(() => {
  // 각 테스트 전에 안전 기본값으로 reset
  delete process.env.TOSS_TRADING_MODE;
  delete process.env.TOSS_MAX_TRADE_AMOUNT;
  delete process.env.TOSS_TELEGRAM_CHAT_ID;
  delete process.env.TOSS_ACCOUNT_TYPE_OVERRIDE;
  // console.log mock (audit log)
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ENV_BACKUP };
  vi.restoreAllMocks();
});

function kstDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  // KST 시간을 UTC로 변환 (KST = UTC+9)
  const utc = Date.UTC(year, month - 1, day, hour - 9, minute, 0);
  return new Date(utc);
}

const sampleBuyOrder = {
  symbol: "005930",
  side: "BUY",
  quantity: 10,
  price: 70000,
  orderType: "LIMIT",
};

// ─── 가드 1: TRADING_MODE 강제 ─────────────────────────────────
describe("가드 1: TRADING_MODE 강제", () => {
  it("paper 모드(기본)에서 POST /api/v1/orders → 차단 (423)", () => {
    // TOSS_TRADING_MODE 미설정 = paper fallback
    const r = guardRequest({ method: "POST", path: "/api/v1/orders", body: sampleBuyOrder });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(423);
      expect(r.error.code).toBe("trading-mode-paper");
    }
  });

  it("live 모드에서 GET /api/v1/accounts → 통과 (ok)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({ method: "GET", path: "/api/v1/accounts" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("live");
  });

  it("simulation 모드에서 POST /api/v1/orders → 차단 (423)", () => {
    process.env.TOSS_TRADING_MODE = "simulation";
    const r = guardRequest({ method: "POST", path: "/api/v1/orders", body: sampleBuyOrder });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("trading-mode-simulation");
  });

  it("알 수 없는 TOSS_TRADING_MODE 값 → paper fallback", () => {
    process.env.TOSS_TRADING_MODE = "unknown-mode-xyz";
    const r = guardRequest({ method: "POST", path: "/api/v1/orders", body: sampleBuyOrder });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("trading-mode-paper");
  });
});

// ─── 가드 2: TRADE_AMOUNT_LIMIT ────────────────────────────────
describe("가드 2: TRADE_AMOUNT_LIMIT", () => {
  it("BUY: price×quantity ≤ 한도 → 통과 (live 모드 가정, 시간대 OK)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_MAX_TRADE_AMOUNT = "1000000"; // 100만원
    // 70000 × 10 = 700,000 < 1,000,000
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0), // 금요일 10시
    });
    expect(r.ok).toBe(true);
  });

  it("BUY: price×quantity > 한도 → 차단 (422 amount-limit-exceeded)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_MAX_TRADE_AMOUNT = "500000"; // 50만원
    // 70000 × 10 = 700,000 > 500,000
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(422);
      expect(r.error.code).toBe("amount-limit-exceeded");
    }
  });

  it("SELL: quantity > 0 → 통과 (금액 계산 없음)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, side: "SELL", price: 0, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0),
    });
    // 가드 1 (live) → 통과, 가드 2 (SELL 수량>0) → 통과, 가드 3 (장중) → 통과
    expect(r.ok).toBe(true);
  });

  it("SELL: quantity ≤ 0 → 차단 (422 amount-limit-exceeded)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, side: "SELL", quantity: 0 },
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("amount-limit-exceeded");
  });
});

// ─── 가드 3: MARKET_HOURS (KST) ────────────────────────────────
describe("가드 3: MARKET_HOURS (KST 09:00~15:30, lunch 12:00~13:00 차단)", () => {
  it("KST 10:00 (장중) → 통과", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0), // 금요일 10시
    });
    expect(r.ok).toBe(true);
  });

  it("KST 08:59 (장 시작 전) → 차단 (422 order-hours-closed)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 8, 59),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(422);
      expect(r.error.code).toBe("order-hours-closed");
    }
  });

  it("KST 12:30 (lunch) → 차단", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 12, 30),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("order-hours-closed");
  });

  it("KST 15:30 (장 마감) → 차단", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 15, 30),
    });
    expect(r.ok).toBe(false);
  });

  it("KST 토요일 10:00 (주말) → 차단", () => {
    process.env.TOSS_TRADING_MODE = "live";
    // 2026-07-11 = 토요일
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 11, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("order-hours-closed");
  });

  it("simulation 모드는 장 시간 무관 통과", () => {
    process.env.TOSS_TRADING_MODE = "simulation";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 11, 3, 0), // 토요일 새벽
    });
    // 가드 1 (simulation) → 차단
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("trading-mode-simulation");
  });
});

// ─── 가드 4: 계좌 모드 ─────────────────────────────────────────
describe("가드 4: 계좌 모드 가드", () => {
  it("연금 계좌(override) → paper 자동 fallback 차단 (423)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_ACCOUNT_TYPE_OVERRIDE = "pension";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(423);
      expect(r.error.code).toBe("account-restricted");
    }
  });

  it("RIA 계좌(override) → 차단", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_ACCOUNT_TYPE_OVERRIDE = "ria";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
  });

  it("종합매매 계좌(override) → 차단 (Chinese 호환)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_ACCOUNT_TYPE_OVERRIDE = "综合매매";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
  });

  it("일반 계좌(override 없음) → 통과", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(true);
  });
});

// ─── 가드 5: Telegram confirm 게이트 ──────────────────────────
describe("가드 5: Telegram confirm 게이트", () => {
  it("live 모드 + telegramConfirmed=true → 통과", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(true);
  });

  it("live 모드 + telegramConfirmed 미포함 → 차단 (425)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder, // telegramConfirmed 없음
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.httpStatus).toBe(425);
      expect(r.error.code).toBe("telegram-confirm-required");
    }
  });

  it("paper 모드는 telegramConfirmed 무관 통과 (가드 5 미적용, 가드 1에서 차단됨)", () => {
    // TOSS_TRADING_MODE 미설정 = paper
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    // 가드 1에서 paper 모드 차단
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("trading-mode-paper");
  });
});

// ─── 가드 6: Audit log (side effect) ───────────────────────────
describe("가드 6: Audit log", () => {
  it("가드 차단 시 console.log 호출됨", () => {
    process.env.TOSS_TRADING_MODE = "paper";
    const logSpy = vi.spyOn(console, "log");
    guardRequest({ method: "POST", path: "/api/v1/orders", body: sampleBuyOrder });
    expect(logSpy).toHaveBeenCalled();
    const firstCall = logSpy.mock.calls[0]?.[0] as string | undefined;
    expect(firstCall).toContain("[safety]");
    expect(firstCall).toContain("trading-mode-paper");
  });

  it("가드 통과 시에도 audit log 출력", () => {
    process.env.TOSS_TRADING_MODE = "live";
    const logSpy = vi.spyOn(console, "log");
    guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: { ...sampleBuyOrder, telegramConfirmed: true },
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes('"action":"pass"'))).toBe(true);
  });
});

// ─── 통합 시나리오 ──────────────────────────────────────────────
describe("통합: 가드 체인 순서", () => {
  it("가드 1(TRADING_MODE) → 가드 2(AMOUNT) → 가드 3(HOURS) → 가드 4(ACCOUNT) → 가드 5(TELEGRAM)", () => {
    process.env.TOSS_TRADING_MODE = "live";
    process.env.TOSS_MAX_TRADE_AMOUNT = "100000";
    process.env.TOSS_ACCOUNT_TYPE_OVERRIDE = "pension";
    // 금액도 초과 + 연금계좌 → 가드 2 또는 가드 4 먼저 걸림
    const r = guardRequest({
      method: "POST",
      path: "/api/v1/orders",
      body: sampleBuyOrder,
      now: kstDate(2026, 7, 10, 10, 0),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // 가드 1 통과(live) → 가드 2 차단(amount 초과) 우선
      expect(r.error.code).toBe("amount-limit-exceeded");
    }
  });

  it("GET 요청은 모든 가드 통과", () => {
    process.env.TOSS_TRADING_MODE = "paper";
    const r = guardRequest({ method: "GET", path: "/api/v1/accounts" });
    expect(r.ok).toBe(true);
  });
});
