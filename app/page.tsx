/**
 * app/page.tsx — toss-trader 메인 대시보드 (4단계)
 *
 * v0.3 단순화: LLM 호출 0. 토스 Open API 시세 + OrderButton만.
 * 5단계에서 Portfolio.tsx(잔고) + 6단계 Notion 이력 추가 예정.
 *
 * 현재는 시세 조회 데모 (삼성전자 005930) + OrderButton 통합.
 */

import { OrderButton } from "@/components/OrderButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🤖 toss-trader</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            토스증권 Open API 기반 투자 어시스턴트 (v0.3 단순화)
          </p>
        </header>

        <section className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h2 className="text-sm font-semibold mb-2">📋 v0.3 동작 흐름</h2>
          <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1 list-decimal list-inside">
            <li>종목 선택 + 매수/매도 클릭</li>
            <li>Confirm 모달에서 금액 확인 → &quot;발송&quot;</li>
            <li>Telegram 메시지 발송 (또는 dev fallback 자동 confirm)</li>
            <li>Telegram의 [확인] 클릭 → toss Open API에 주문 전송</li>
            <li>6대 안전 가드 자동 적용 (paper 기본, 가드 5 telegramConfirmed 필요)</li>
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">📊 시세 + 주문 (데모: 삼성전자 005930)</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 시세 표시 (5단계에서 Portfolio 컴포넌트로 분리) */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
              <h3 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300">삼성전자 (005930)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">현재가 (데모)</span>
                  <span className="font-mono font-semibold text-lg">70,000원</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>전일 대비</span>
                  <span>+1,500원 (+2.19%)</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>거래량</span>
                  <span>12,345,678주</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                ℹ️ 실제 시세는 <code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">/api/toss/api/v1/prices?symbols=005930</code> 조회.
                5단계에서 실시간 fetch로 교체 예정.
              </div>
            </div>

            {/* OrderButton */}
            <OrderButton symbol="005930" symbolName="삼성전자" currentPrice={70000} />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">🔧 5단계 이후 추가 예정</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
            <li><code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">components/Portfolio.tsx</code> — 보유 종목 + 손익 (5단계)</li>
            <li><code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">app/api/notion/route.ts</code> — Notion DB 이력 기록 (6단계)</li>
            <li><code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">lib/notion.ts</code> — Notion 클라이언트 (6단계)</li>
            <li><code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">vercel.json</code> + Vercel 배포 + env (7단계)</li>
          </ul>
        </section>

        <footer className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <p>🤖 toss-trader v0.3 | Next.js 16.2.10 + React 19.2.4 | Paper trading 기본</p>
          <p className="mt-1">
            📚 상세: <a href="https://github.com/sigco3111/toss-trader" className="underline">github.com/sigco3111/toss-trader</a>
            {' · '}
            🛡️ 안전 가드 6종 자동 적용 (DRY_RUN/TRADING_MODE/AMOUNT/HOURS/ACCOUNT/TELEGRAM)
          </p>
        </footer>
      </main>
    </div>
  );
}
