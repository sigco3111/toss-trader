/**
 * lib/safety.ts — toss-trader 6대 안전 가드 (3단계)
 *
 * 위치: lib/safety.ts (요청 진입점)
 * 책임: tossFetch() 내장 가드(HTTP/422/429) 외에 "의도/맥락/시간/금액" 단위 가드
 *
 * 6대 가드 (3단계):
 * 1. TRADING_MODE 강제 (paper / live / simulation, 기본 paper)
 * 2. TRADE_AMOUNT_LIMIT (단일 주문 금액 상한, BUY는 price×quantity, SELL은 quantity만)
 * 3. MARKET_HOURS 가드 (KST 09:00~15:30, lunch 12:00~13:00 차단)
 * 4. 계좌 모드 가드 (종합매매/연금/RIA = paper 자동 fallback)
 * 5. Telegram confirm 게이트 (live 모드 = Telegram user confirm 필수, 미설정 시 차단)
 * 6. Audit log (모든 가드 통과/차단 이벤트 → stdout JSON)
 *
 * v0.3 단순화: 가드 1~5는 HTTP 응답 throw. 가드 6은 side effect (stdout).
 * 사용 예: app/api/toss/[...path]/route.ts의 handle() 진입 직후
 *   const guard = safety.guardRequest({ method, path, body, headers });
 *   if (!guard.ok) return NextResponse.json(guard.error, { status: guard.httpStatus });
 */

import { TossError, type TossErrorBody } from "./toss";

// ─── 환경변수 ──────────────────────────────────────────────────────
export type TradingMode = "paper" | "live" | "simulation";

function getTradingMode(): TradingMode {
  const v = (process.env.TOSS_TRADING_MODE ?? "paper").toLowerCase();
  if (v === "live" || v === "simulation" || v === "paper") return v;
  return "paper"; // 알 수 없는 값 = paper fallback
}

function getMaxTradeAmount(): number {
  const v = process.env.TOSS_MAX_TRADE_AMOUNT;
  if (!v) return 1_000_000; // 기본 100만원
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1_000_000;
}

function getTelegramChatId(): string | null {
  // 3단계 가드 5에서 향후 사용 예정. 현재는 body.telegramConfirmed로 처리.
  // chat_id 자체는 가드 5가 강제하지 않음 (Telegram 발송은 4단계에서 구현).
  return process.env.TOSS_TELEGRAM_CHAT_ID ?? null;
}

function getAccountTypeOverride(): string | null {
  return process.env.TOSS_ACCOUNT_TYPE_OVERRIDE ?? null;
}

// ─── 미사용 함수 suppress (4단계에서 호출 예정) ───────────────
void getTelegramChatId;

// KST = UTC+9
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstHourMinute(date: Date): { hour: number; minute: number; weekday: number } {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    weekday: kst.getUTCDay(), // 0=Sun ... 6=Sat
  };
}

// ─── 가드 결과 타입 ────────────────────────────────────────────────
export type GuardResult =
  | { ok: true; mode: TradingMode }
  | { ok: false; httpStatus: number; error: TossErrorBody };

// ─── 가드 1: TRADING_MODE 강제 ────────────────────────────────────
function guardTradingMode(method: string, path: string, mode: TradingMode): GuardResult {
  const isOrder =
    (method === "POST" || method === "PUT" || method === "DELETE") &&
    isOrderPath(path);
  if (!isOrder) return { ok: true, mode };
  if (mode === "paper") {
    return {
      ok: false,
      httpStatus: 423,
      error: {
        code: "trading-mode-paper",
        message:
          "TOSS_TRADING_MODE=paper 모드입니다. 주문 endpoint가 차단됩니다. 실계좌 주문은 TOSS_TRADING_MODE=live + Telegram 사용자 confirm + DRY_RUN=false 3가지 조건 모두 충족 필요.",
        httpStatus: 423,
      },
    };
  }
  if (mode === "simulation") {
    return {
      ok: false,
      httpStatus: 423,
      error: {
        code: "trading-mode-simulation",
        message:
          "TOSS_TRADING_MODE=simulation 모드입니다. 시뮬레이션은 별도 endpoint를 사용하세요.",
        httpStatus: 423,
      },
    };
  }
  return { ok: true, mode: "live" };
}

function isOrderPath(path: string): boolean {
  return path.startsWith("/api/v1/orders") || path.startsWith("/api/v1/conditional-orders");
}

// ─── 가드 2: TRADE_AMOUNT_LIMIT ──────────────────────────────────
function guardTradeAmount(
  method: string,
  path: string,
  body: unknown,
  limit: number
): GuardResult {
  if (method !== "POST" || !isOrderPath(path)) return { ok: true, mode: "live" };
  if (!body || typeof body !== "object") return { ok: true, mode: "live" };
  const b = body as Record<string, unknown>;
  const side = String(b.side ?? "").toUpperCase();
  const quantity = Number(b.quantity ?? 0);
  const price = Number(b.price ?? 0);

  // SELL은 수량만 검증 (금액 계산은 현재가가 필요 → server-side 사전조회)
  if (side === "SELL") {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        httpStatus: 422,
        error: {
          code: "amount-limit-exceeded",
          message: "SELL 주문 수량이 0 이하입니다.",
          httpStatus: 422,
        },
      };
    }
    return { ok: true, mode: "live" };
  }

  // BUY는 price × quantity 검증
  if (side === "BUY") {
    const total = Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0;
    if (total > limit) {
      return {
        ok: false,
        httpStatus: 422,
        error: {
          code: "amount-limit-exceeded",
          message: `단일 주문 금액 ${total.toLocaleString()}원이 한도 ${limit.toLocaleString()}원을 초과합니다. (TOSS_MAX_TRADE_AMOUNT=${limit})`,
          httpStatus: 422,
        },
      };
    }
  }
  return { ok: true, mode: "live" };
}

// ─── 가드 3: MARKET_HOURS (KST 09:00~15:30, lunch 12:00~13:00 차단) ─
function guardMarketHours(path: string, mode: TradingMode, now: Date = new Date()): GuardResult {
  if (!isOrderPath(path) || mode === "simulation") return { ok: true, mode };
  const { hour, minute, weekday } = kstHourMinute(now);
  const inMinutes = hour * 60 + minute;
  // 주말 = 항상 차단
  if (weekday === 0 || weekday === 6) {
    return {
      ok: false,
      httpStatus: 422,
      error: {
        code: "order-hours-closed",
        message: "주말은 장이 닫혀있습니다.",
        httpStatus: 422,
      },
    };
  }
  // 09:00 이전, 15:30 이후, lunch 12:00~13:00 차단
  if (inMinutes < 9 * 60 || inMinutes >= 15 * 60 + 30 || (inMinutes >= 12 * 60 && inMinutes < 13 * 60)) {
    return {
      ok: false,
      httpStatus: 422,
      error: {
        code: "order-hours-closed",
        message: `KST ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} — 장 마감 (09:00~15:30, lunch 12:00~13:00). 사전 시장 캘린더 확인 필요.`,
        httpStatus: 422,
      },
    };
  }
  return { ok: true, mode };
}

// ─── 가드 4: 계좌 모드 가드 ──────────────────────────────────────
function guardAccountType(path: string, mode: TradingMode): GuardResult {
  if (!isOrderPath(path) || mode === "simulation") return { ok: true, mode };
  const override = getAccountTypeOverride();
  // 종합매매/연금/RIA는 자동 paper fallback
  if (override && ["pension", "ria", "综合매매", "integrated"].includes(override.toLowerCase())) {
    return {
      ok: false,
      httpStatus: 423,
      error: {
        code: "account-restricted",
        message: `계좌 종류=${override} — 주문이 제한되어 있습니다. toss-trader가 자동으로 paper 모드로 fallback합니다. TOSS_ACCOUNT_TYPE_OVERRIDE 환경변수 확인.`,
        httpStatus: 423,
      },
    };
  }
  return { ok: true, mode };
}

// ─── 가드 5: Telegram confirm 게이트 ─────────────────────────────
function guardTelegramConfirm(
  method: string,
  path: string,
  body: unknown,
  mode: TradingMode
): GuardResult {
  if (mode !== "live") return { ok: true, mode };
  if (method !== "POST" || !isOrderPath(path)) return { ok: true, mode: "live" };
  const b = (body ?? {}) as Record<string, unknown>;
  const confirmed = b.telegramConfirmed === true;
  if (!confirmed) {
    return {
      ok: false,
      httpStatus: 425,
      error: {
        code: "telegram-confirm-required",
        message:
          "live 모드 주문은 Telegram 사용자 confirm 필수. TOSS_TELEGRAM_CHAT_ID 설정 + 발송된 메시지의 [확인] inline button 클릭 후 재요청. body에 telegramConfirmed: true 포함.",
        httpStatus: 425,
      },
    };
  }
  return { ok: true, mode: "live" };
}

// ─── 가드 6: Audit log (side effect, fail-safe) ──────────────────
function audit(event: {
  guard: string;
  action: "pass" | "block";
  reason?: string;
  method: string;
  path: string;
  mode: TradingMode;
}): void {
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      ...event,
    });
    console.log(`[safety] ${line}`);
  } catch {
    // audit 실패 = 가드 동작에 영향 없음 (fail-safe)
  }
}

// ─── 메인 guardRequest() ────────────────────────────────────────
export interface GuardRequestInput {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // toss API path (e.g. "/api/v1/orders")
  body?: unknown;
  headers?: Record<string, string | undefined>;
  now?: Date; // 테스트용 주입 가능
}

export function guardRequest(input: GuardRequestInput): GuardResult {
  const mode = getTradingMode();
  const maxAmount = getMaxTradeAmount();
  const now = input.now ?? new Date();

  // 가드 1: TRADING_MODE
  const g1 = guardTradingMode(input.method, input.path, mode);
  if (!g1.ok) {
    audit({ guard: "trading-mode", action: "block", reason: g1.error.code, method: input.method, path: input.path, mode });
    return g1;
  }

  // 가드 2: TRADE_AMOUNT_LIMIT
  const g2 = guardTradeAmount(input.method, input.path, input.body, maxAmount);
  if (!g2.ok) {
    audit({ guard: "trade-amount", action: "block", reason: g2.error.code, method: input.method, path: input.path, mode });
    return g2;
  }

  // 가드 3: MARKET_HOURS
  const g3 = guardMarketHours(input.path, mode, now);
  if (!g3.ok) {
    audit({ guard: "market-hours", action: "block", reason: g3.error.code, method: input.method, path: input.path, mode });
    return g3;
  }

  // 가드 4: 계좌 모드
  const g4 = guardAccountType(input.path, mode);
  if (!g4.ok) {
    audit({ guard: "account-type", action: "block", reason: g4.error.code, method: input.method, path: input.path, mode });
    return g4;
  }

  // 가드 5: Telegram confirm
  const g5 = guardTelegramConfirm(input.method, input.path, input.body, mode);
  if (!g5.ok) {
    audit({ guard: "telegram-confirm", action: "block", reason: g5.error.code, method: input.method, path: input.path, mode });
    return g5;
  }

  // 모든 가드 통과
  audit({ guard: "all", action: "pass", method: input.method, path: input.path, mode });
  return { ok: true, mode };
}

// ─── 재노출 (3단계에서 route.ts가 사용) ───────────────────────────
export { TossError };
export type { TossErrorBody };
