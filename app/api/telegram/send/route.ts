/**
 * app/api/telegram/send/route.ts — 토스 주문 Telegram confirm 발송
 *
 * 브라우저 → 이 endpoint → lib/telegram.ts → Telegram Bot API
 * 응답: { ok, orderId, devFallback, expiresAt, message }
 *
 * 4단계: OrderButton이 매수/매도 클릭 시 이 endpoint 호출.
 * 응답으로 받은 orderId를 5초 이내 confirm 폴링 (또는 SSE) 또는
 * Telegram 메시지의 inline button 클릭 → /api/telegram/callback 호출 →
 * 콜백 처리 후 클라이언트가 /api/toss/.../orders 재요청 시
 * body.telegramConfirmed=true 로 가드 5 통과.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendOrderConfirm } from "@/lib/telegram";

interface SendBody {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  accountSeq?: number;
}

function isValidBody(b: unknown): b is SendBody {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.symbol === "string" &&
    o.symbol.length > 0 &&
    (o.side === "BUY" || o.side === "SELL") &&
    typeof o.quantity === "number" &&
    o.quantity > 0 &&
    typeof o.price === "number" &&
    o.price > 0
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "invalid-body", message: "JSON body 파싱 실패" },
      { status: 400 }
    );
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        code: "invalid-order",
        message:
          "필수 필드: symbol (string), side (BUY|SELL), quantity (>0), price (>0)",
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendOrderConfirm(body);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        code: "telegram-send-failed",
        message: (e as Error).message ?? "Unknown error",
      },
      { status: 502 }
    );
  }
}
