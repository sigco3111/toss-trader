/**
 * app/api/telegram/callback/route.ts — Telegram webhook 콜백 수신
 *
 * Telegram Bot API → 이 endpoint (Bot webhook URL)
 * 페이로드: { callback_query: { id, data, from, ... } }
 * 처리: lib/telegram.ts handleCallback() → ID 매칭 + status 갱신 +
 *       answerCallbackQuery()로 사용자에게 토스트
 *
 * Bot webhook 등록:
 *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *     { url: "https://toss-trader.vercel.app/api/telegram/callback" }
 */

import { NextRequest, NextResponse } from "next/server";
import { handleCallback, answerCallback } from "@/lib/telegram";

interface TelegramCallbackQuery {
  id: string;
  data: string;
  from: { id: number; username?: string };
}

interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid-body", message: "JSON body 파싱 실패" },
      { status: 400 }
    );
  }

  const cb = update.callback_query;
  if (!cb || !cb.data) {
    return NextResponse.json({ ok: true, message: "no callback_query, skip" });
  }

  const result = await handleCallback(cb.data, cb.id);

  // 사용자에게 토스트 알림
  if (result.callbackQueryId) {
    const toastText =
      result.action === "confirm"
        ? result.order
          ? `✅ ${result.order.symbol} ${result.order.side} ${result.order.quantity.toLocaleString()}주 confirm됨. toss-trader가 주문을 전송합니다.`
          : "✅ confirm (order not found)"
        : result.action === "cancel"
          ? "❌ 취소됨"
          : "⚠️ 알 수 없는 action";
    await answerCallback(result.callbackQueryId, toastText, true);
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
    orderId: result.orderId,
    orderStatus: result.order?.status,
    reason: result.reason,
  });
}
