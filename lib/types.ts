export type Market = "KR" | "US";
export type TradeAction = "BUY" | "SELL" | "HOLD";
export type Currency = "KRW" | "USD";

export type AgentReference = {
  title: string;
  url: string;
  reason: string;
};

export type AgentOrder = {
  quantity: number;
  limitPrice: number;
  currency: Currency;
};

export type AgentRecommendation = {
  symbol: string;
  market: Market;
  decision: {
    action: TradeAction;
    confidence: number;
    reason: string;
  };
  order: AgentOrder | null;
  references: AgentReference[];
};

export type SessionState = {
  id: string;
  createdAt: string;
  apiKey: string;
  secretKey: string;
  instructions: string;
  intervalSeconds: number;
  /**
   * Symbol the user wants the agent to focus on. Persists across analyses;
   * the UI may also override it per-call.
   */
  targetSymbol: string;
  targetMarket: Market;
  latestRecommendation: AgentRecommendation | null;
  latestHistoryFile: string | null;
};

export type AnalysisHistoryRecord = {
  kind: "analysis";
  epochSeconds: number;
  createdAt: string;
  sessionId: string;
  /** Which symbol/market this analysis was scoped to. */
  symbol: string;
  market: Market;
  recommendation: AgentRecommendation;
  rawAssistantMessage: string;
  diagnostics: {
    exitCode: number | null;
    stdout: string;
    stderr: string;
  };
  /** Per-call market snapshot that was attached to the prompt. */
  context?: import("@/lib/market-context").MarketContext;
};

export type OrderHistoryRecord = {
  kind: "order";
  epochSeconds: number;
  createdAt: string;
  sessionId: string;
  request: {
    symbol: string;
    market: Market;
    side: "BUY" | "SELL";
    quantity: string;
    limitPrice: string;
    currency: Currency;
  };
  response: unknown;
};

export type HistoryRecord = AnalysisHistoryRecord | OrderHistoryRecord;
