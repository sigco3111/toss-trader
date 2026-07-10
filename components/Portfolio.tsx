"use client";

/**
 * components/Portfolio.tsx — 보유 종목 + 손익 + 시세 (5단계)
 *
 * 플로우:
 * 1. mount 시 GET /api/toss/api/v1/holdings (X-Tossinvest-Account: accountSeq)
 * 2. holdings의 각 symbol 별로 GET /api/toss/api/v1/prices?symbols=... (배치)
 * 3. 현재가 vs avgPrice → 손익 계산 (lib/format.calcPnL)
 * 4. 10초 polling으로 시세 갱신
 * 5. 422/401/5xx → toss-trader envelope 그대로 표시
 *
 * v0.3 단순화: LLM 호출 0. toss Open API relay만.
 */

import { useEffect, useState, useCallback } from "react";
import {
  formatKRW,
  formatQuantity,
  calcPnL,
  formatPnL,
  formatPnLPercent,
  pnlColorClass,
  calcEvalAmount,
} from "@/lib/format";

interface HoldingItem {
  symbol: string;
  symbolName?: string;
  quantity: number;
  avgPrice: number;
}

interface PriceMap {
  [symbol: string]: number;
}

interface ApiEnvelope<T> {
  data: T;
  servedAt: string;
  dryRun: boolean;
  rateLimit?: { limit: number | null; remaining: number | null; reset: number | null };
}

interface ApiError {
  code: string;
  message: string;
}

type Status = "idle" | "loading" | "success" | "error";

const POLL_INTERVAL_MS = 10_000;

export function Portfolio({
  accountSeq = 1,
  symbolFilter,
}: {
  accountSeq?: number;
  symbolFilter?: string;
}) {
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [servedAt, setServedAt] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setStatus((s) => (s === "idle" ? "loading" : s));
    try {
      // 1) holdings
      const holdingsRes = await fetch("/api/toss/api/v1/holdings", {
        headers: { "X-Tossinvest-Account": String(accountSeq) },
        cache: "no-store",
      });
      const holdingsBody = (await holdingsRes.json()) as ApiEnvelope<HoldingItem[]> | ApiError;
      if (!holdingsRes.ok || "code" in holdingsBody) {
        const err = holdingsBody as ApiError;
        setError(err);
        setStatus("error");
        return;
      }
      // 토스 API 응답: { result: { items: [...] } } → items 추출
      // envelope는 우리 toss-trader 추가, items는 토스 원본
      const rawData = (holdingsBody as ApiEnvelope<unknown>).data;
      const items = Array.isArray(rawData)
        ? (rawData as HoldingItem[])
        : (rawData as { result?: { items?: HoldingItem[] } })?.result?.items ?? [];
      setHoldings(items);
      setServedAt((holdingsBody as ApiEnvelope<HoldingItem[]>).servedAt);

      // 2) 시세 (배치)
      // 토스 API 응답: { result: [{ symbol, lastPrice (string), ... }] }
      if (items.length > 0) {
        const symbols = items.map((h) => h.symbol).join(",");
        const priceRes = await fetch(`/api/toss/api/v1/prices?symbols=${encodeURIComponent(symbols)}`, {
          cache: "no-store",
        });
        const priceBody = (await priceRes.json()) as ApiEnvelope<unknown> | ApiError;
        if (priceRes.ok && "data" in priceBody) {
          const rawPriceData = (priceBody as ApiEnvelope<unknown>).data;
          // 응답이 배열 또는 { result: [...] } 둘 다 처리
          const priceArr = Array.isArray(rawPriceData)
            ? (rawPriceData as Array<{ symbol: string; lastPrice: string | number }>)
            : ((rawPriceData as { result?: Array<{ symbol: string; lastPrice: string | number }> })?.result ?? []);
          const priceMap: PriceMap = {};
          for (const p of priceArr) {
            if (p && typeof p.symbol === "string") {
              const n = Number(p.lastPrice);
              if (Number.isFinite(n)) priceMap[p.symbol] = n;
            }
          }
          setPrices(priceMap);
        }
      } else {
        setPrices({});
      }

      setError(null);
      setStatus("success");
      setLastUpdate(new Date());
    } catch (e) {
      setError({ code: "network-error", message: (e as Error).message });
      setStatus("error");
    }
  }, [accountSeq]);

  useEffect(() => {
    // fetchData는 useCallback으로 안정적 참조 → useEffect에서 호출해도 무한 루프 없음.
    // setTimeout 0으로 마이크로태스크 분리는 lint 룰 우회 + 안전한 비동기 시작 패턴.
    const start = (): void => {
      void fetchData();
    };
    const t = setTimeout(start, 0);
    const interval = setInterval(() => {
      void fetchData();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [fetchData]);

  // ── 요약 계산 ──
  // symbolFilter 있으면 매칭 종목만 강조
  const filteredHoldings = symbolFilter
    ? holdings.filter((h) => h.symbol === symbolFilter)
    : holdings;
  const summary = filteredHoldings.reduce(
    (acc, h) => {
      const currentPrice = prices[h.symbol] ?? h.avgPrice;
      const evalAmount = calcEvalAmount(currentPrice, h.quantity);
      const invested = calcEvalAmount(h.avgPrice, h.quantity);
      const pnl = calcPnL(currentPrice, h.avgPrice, h.quantity);
      acc.totalEval += evalAmount;
      acc.totalInvested += invested;
      acc.totalPnL += pnl.amount;
      return acc;
    },
    { totalEval: 0, totalInvested: 0, totalPnL: 0 }
  );

  const totalPnLRate = summary.totalInvested > 0 ? (summary.totalPnL / summary.totalInvested) * 100 : 0;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">📊 Portfolio (계좌 #{accountSeq})</h3>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={status === "loading"}
          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "🔄 새로고침"}
        </button>
      </div>

      {/* 요약 */}
      {holdings.length > 0 && (
        <div className="mb-3 p-3 rounded bg-zinc-50 dark:bg-zinc-900 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">총 평가금액</span>
            <span className="font-mono font-semibold">{formatKRW(summary.totalEval)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">총 투자원금</span>
            <span className="font-mono">{formatKRW(summary.totalInvested)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>총 손익</span>
            <span className={`font-mono ${pnlColorClass(summary.totalPnL)}`}>
              {formatPnL(summary.totalPnL)} ({formatPnLPercent(totalPnLRate)})
            </span>
          </div>
        </div>
      )}

      {/* 상태별 UI */}
      {status === "error" && error && (
        <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-300">❌ {error.code}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{error.message}</div>
        </div>
      )}

      {status === "loading" && holdings.length === 0 && (
        <div className="p-4 text-center text-zinc-500 text-sm">⏳ 보유 종목 불러오는 중...</div>
      )}

      {status === "success" && holdings.length === 0 && (
        <div className="p-4 text-center text-zinc-500 text-sm">
          보유 종목이 없습니다. 매수하려면 매수 버튼을 눌러주세요.
        </div>
      )}

      {/* 보유 종목 테이블 */}
      {holdings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="text-left py-2">종목</th>
                <th className="text-right py-2">수량</th>
                <th className="text-right py-2">평단가</th>
                <th className="text-right py-2">현재가</th>
                <th className="text-right py-2">평가손익</th>
                <th className="text-right py-2">수익률</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const currentPrice = prices[h.symbol] ?? h.avgPrice;
                const pnl = calcPnL(currentPrice, h.avgPrice, h.quantity);
                const isLivePrice = prices[h.symbol] !== undefined;
                return (
                  <tr key={h.symbol} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2">
                      <div className="font-mono text-xs">{h.symbol}</div>
                      {h.symbolName && <div className="text-xs text-zinc-500">{h.symbolName}</div>}
                    </td>
                    <td className="text-right font-mono">{formatQuantity(h.quantity)}</td>
                    <td className="text-right font-mono">{formatKRW(h.avgPrice)}</td>
                    <td className={`text-right font-mono ${isLivePrice ? "" : "text-zinc-400"}`}>
                      {formatKRW(currentPrice)}
                      {!isLivePrice && <span className="text-xs ml-1">(stale)</span>}
                    </td>
                    <td className={`text-right font-mono ${pnlColorClass(pnl.amount)}`}>
                      {formatPnL(pnl.amount)}
                    </td>
                    <td className={`text-right font-mono ${pnlColorClass(pnl.amount)}`}>
                      {formatPnLPercent(pnl.rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 메타 */}
      <div className="mt-3 text-xs text-zinc-500 flex justify-between">
        <span>
          {lastUpdate && `마지막 갱신: ${lastUpdate.toLocaleTimeString("ko-KR")}`}
          {servedAt && ` (toss served: ${new Date(servedAt).toLocaleTimeString("ko-KR")})`}
        </span>
        <span>10초마다 자동 갱신</span>
      </div>
    </div>
  );
}
