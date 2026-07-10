/**
 * test/telegram.test.ts — 토스 주문 Telegram confirm 게이트 TDD (4단계)
 *
 * v0.3 단순화: 외부 HTTP 호출은 fetch mock으로 처리. 콜백 매칭은
 * in-memory store 결정론적.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendOrderConfirm,
  handleCallback,
  cancelOrder,
  getOrder,
  listPendingOrders,
  _resetPendingStore,
} from "@/lib/telegram";

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TOSS_TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_CONFIRM_TTL_SEC;
  delete process.env.TOSS_TRADING_MODE; // v1.1.3
  _resetPendingStore();
  // 기본 fetch mock (사용 안 함)
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => "ok",
    status: 200,
    statusText: "OK",
  }) as unknown as typeof fetch;
});

afterEach(() => {
  process.env = { ...ENV_BACKUP };
  vi.restoreAllMocks();
});

const sampleOrder = {
  symbol: "005930",
  side: "BUY" as const,
  quantity: 10,
  price: 70000,
};

// ─── sendOrderConfirm ───────────────────────────────────────────
describe("sendOrderConfirm", () => {
  it("sendOrderConfirm → dev fallback 자동 confirm (TELEGRAM_BOT_TOKEN 없음)", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    expect(r.ok).toBe(true);
    expect(r.devFallback).toBe(true);
    expect(r.mode).toBe("telegram");
  });

  it("sendOrderConfirm auto → 즉시 confirmed (v1.1.4 단순화, 5초/2차 confirm 없음)", async () => {
    const r = await sendOrderConfirm(sampleOrder, "auto");
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("auto");
    expect(r.message).toContain("즉시 confirmed");
  });

  it("sendOrderConfirm off → ok:false (가드 5에서 차단)", async () => {
    const r = await sendOrderConfirm(sampleOrder, "off");
    expect(r.ok).toBe(false);
    expect(r.mode).toBe("off");
  });

  it("pending store에 orderId 저장됨 (dev fallback)", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    const stored = getOrder(r.orderId);
    expect(stored).toBeDefined();
    expect(stored?.symbol).toBe("005930");
    expect(stored?.side).toBe("BUY");
    expect(stored?.totalAmount).toBe(70000 * 10);
  });

  it("Telegram sendMessage 설정 시 devFallback=false + fetch 호출", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "123456789";
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockClear();
    const r = await sendOrderConfirm(sampleOrder);
    expect(r.devFallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, opts] = call!;
    expect(String(url)).toContain("/bottest-bot-token/sendMessage");
    const bodyObj = JSON.parse(String((opts as RequestInit).body));
    expect(bodyObj.chat_id).toBe("123456789");
    expect(bodyObj.reply_markup.inline_keyboard).toHaveLength(1);
  });

  it("Telegram sendMessage 실패 (4xx/5xx) 시 throw + store에서 제거", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "123456789";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "bot token invalid",
    }) as unknown as typeof fetch;
    await expect(sendOrderConfirm(sampleOrder)).rejects.toThrow(/sendMessage 실패/);
    expect(listPendingOrders()).toHaveLength(0);
  });
});

// ─── handleCallback ─────────────────────────────────────────────
describe("handleCallback", () => {
  it("confirm 콜백 → status=confirmed + order 반환", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    const cb = await handleCallback(`confirm:${r.orderId}`, "cb-query-1");
    expect(cb.action).toBe("confirm");
    expect(cb.orderId).toBe(r.orderId);
    expect(cb.order?.status).toBe("confirmed");
  });

  it("cancel 콜백 → status=canceled", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    const cb = await handleCallback(`cancel:${r.orderId}`, "cb-query-2");
    expect(cb.action).toBe("cancel");
    expect(cb.order?.status).toBe("canceled");
  });

  it("없는 orderId → reason='not found'", async () => {
    const cb = await handleCallback("confirm:order_xxxxxxxxxxxx", "cb-x");
    expect(cb.action).toBe("confirm");
    expect(cb.reason).toContain("not found");
    expect(cb.order).toBeUndefined();
  });

  it("이미 confirm된 orderId 재콜백 → reason='이미 confirm됨 (멱등)'", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    await handleCallback(`confirm:${r.orderId}`);
    const cb = await handleCallback(`confirm:${r.orderId}`);
    expect(cb.reason).toContain("이미 confirm됨");
  });

  it("만료된 orderId (TELEGRAM_CONFIRM_TTL_SEC=0) → status=expired", async () => {
    process.env.TELEGRAM_CONFIRM_TTL_SEC = "0";
    const r = await sendOrderConfirm(sampleOrder);
    // TTL=0이면 즉시 만료. cleanupExpired()로 status=expired로 전환됨.
    // 1ms 시간 전진 (동일 ms 회피)
    await new Promise((resolve) => setTimeout(resolve, 1));
    const stored = getOrder(r.orderId);
    expect(stored?.status).toBe("expired");
    const cb = await handleCallback(`confirm:${r.orderId}`);
    expect(cb.reason).toContain("만료");
  });

  it("잘못된 콜백 형식 (콜론 없음) → action=unknown", async () => {
    const cb = await handleCallback("invalid", "cb-x");
    expect(cb.action).toBe("unknown");
    expect(cb.reason).toContain("형식");
  });
});

// ─── cancelOrder (UI 직접 취소) ───────────────────────────────
describe("cancelOrder", () => {
  it("pending 상태 → ok=true + status=canceled", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    const c = cancelOrder(r.orderId);
    expect(c.ok).toBe(true);
    const stored = getOrder(r.orderId);
    expect(stored?.status).toBe("canceled");
  });

  it("이미 confirm된 order → ok=false + reason", async () => {
    const r = await sendOrderConfirm(sampleOrder);
    await handleCallback(`confirm:${r.orderId}`);
    const c = cancelOrder(r.orderId);
    expect(c.ok).toBe(false);
    expect(c.reason).toContain("confirmed");
  });
});

// ─── listPendingOrders ─────────────────────────────────────────
describe("listPendingOrders", () => {
  it("pending 상태만 필터링 (confirmed/canceled/expired 제외)", async () => {
    const a = await sendOrderConfirm(sampleOrder);
    const b = await sendOrderConfirm(sampleOrder);
    const c = await sendOrderConfirm(sampleOrder);
    await handleCallback(`confirm:${a.orderId}`);
    await handleCallback(`cancel:${b.orderId}`);
    const pending = listPendingOrders();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.orderId).toBe(c.orderId);
  });
});
