/**
 * lib/types.ts — toss-trader 공유 타입 (6단계)
 *
 * 영감: kstost/stock/lib/types.ts (MIT)
 * v0.3 단순화: 시크릿 (apiKey/secretKey) 절대 저장 안 함.
 * HistoryRecord에는 API 응답 + 분석 결과만 보관.
 */

// ─── 마켓 / 통화 ───────────────────────────────────────────────
export type Market = "KR" | "US";
export type Currency = "KRW" | "USD";

// ─── 주문 / 분석 액션 ─────────────────────────────────────────
export type TradeAction = "BUY" | "SELL" | "HOLD";
export type OrderSide = "BUY" | "SELL";

// ─── 분석 추천 (오빠 PC의 OpenCode가 생성, toss-trader는 저장만) ─
export interface AgentReference {
  title: string;
  url: string;
  reason: string;
}

export interface AgentOrder {
  quantity: number;
  limitPrice: number;
  currency: Currency;
}

export interface AgentRecommendation {
  symbol: string;
  market: Market;
  decision: {
    action: TradeAction;
    confidence: number; // 0~1
    reason: string;
  };
  order: AgentOrder | null;
  references: AgentReference[];
}

// ─── HistoryRecord (3종) ──────────────────────────────────────
export interface AnalysisHistoryRecord {
  kind: "analysis";
  epochSeconds: number;
  createdAt: string;
  symbol: string;
  recommendation: AgentRecommendation;
  rawAssistantMessage?: string; // OpenCode 응답 원본
}

export interface OrderHistoryRecord {
  kind: "order";
  epochSeconds: number;
  createdAt: string;
  orderId: string; // lib/telegram.ts의 orderId
  request: {
    symbol: string;
    side: OrderSide;
    quantity: number;
    price: number;
    orderType: "LIMIT" | "MARKET";
    telegramConfirmed: boolean;
  };
  response: {
    ok: boolean;
    httpStatus: number;
    body: unknown; // toss-trader envelope 전체
  };
  // 시크릿은 절대 저장 안 함
}

export interface SnapshotHistoryRecord {
  kind: "snapshot";
  epochSeconds: number;
  createdAt: string;
  accountSeq: number;
  totalEval: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLRate: number;
  holdings: Array<{
    symbol: string;
    symbolName?: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlRate: number;
  }>;
}

export type HistoryRecord = AnalysisHistoryRecord | OrderHistoryRecord | SnapshotHistoryRecord;
