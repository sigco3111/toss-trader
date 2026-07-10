import { NextResponse } from "next/server";
import { runInvestmentAgent } from "@/lib/agents";
import { collectMarketContext } from "@/lib/market-context";
import { writeHistory } from "@/lib/history";
import { getSession, updateLatestRecommendation } from "@/lib/session-store";
import type { AnalysisHistoryRecord, Market } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

type RequestBody = {
  sessionId?: string;
  /**
   * Optional override for which symbol to analyze. Defaults to the symbol from
   * the session's most recent recommendation, or returns 400 if no seed is
   * available.
   */
  symbol?: string;
  market?: Market;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const session = getSession(body.sessionId);

  if (!session) {
    return NextResponse.json({ error: "활성 세션이 없습니다." }, { status: 404 });
  }

  // Determine which symbol to analyze. Caller may pass an explicit override;
  // otherwise use the session's targetSymbol (set when the user started the
  // session). If neither is available we can't scope the market context.
  const symbol = body.symbol?.trim() || session.targetSymbol;
  const market: Market = body.market || session.targetMarket;

  if (!symbol) {
    return NextResponse.json(
      {
        error:
          "분석할 종목이 지정되지 않았습니다. /api/agent/run 요청에 symbol을 포함하거나, 세션 시작 시 targetSymbol을 지정하세요.",
      },
      { status: 400 },
    );
  }

  try {
    // 1) Build the per-call market snapshot (token-cached auth + ~12 GETs).
    //    This may take a few seconds on the first call (auth) and ~1s on
    //    subsequent ones.
    const context = await collectMarketContext(session, symbol, market);

    // 2) Hand the snapshot to the agent as part of the prompt. Even if every
    //    endpoint failed, the run still completes — the agent falls back to
    //    HOLD with an honest reason.
    const result = await runInvestmentAgent(session, context);

    const epochSeconds = Math.floor(Date.now() / 1000);
    const record: AnalysisHistoryRecord = {
      kind: "analysis",
      epochSeconds,
      createdAt: new Date(epochSeconds * 1000).toISOString(),
      sessionId: session.id,
      symbol,
      market,
      recommendation: result.recommendation,
      rawAssistantMessage: result.rawAssistantMessage,
      diagnostics: result.diagnostics,
      context,
    };
    const historyFile = await writeHistory(record);
    const redactedSession = updateLatestRecommendation(
      session.id,
      result.recommendation,
      historyFile,
    );

    return NextResponse.json({
      recommendation: result.recommendation,
      historyFile,
      session: redactedSession,
      context: {
        collectedAt: context.collectedAt,
        symbol: context.symbol,
        accountSeq: context.account?.accountSeq ?? null,
        endpointCount:
          12 -
          context.errors.filter((e) => e.endpoint !== "auth").length,
        errorCount: context.errors.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "OpenCode 실행에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
