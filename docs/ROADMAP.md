# Toss Trader 고도화 로드맵

> 토스증권 Open API 전체 20개 endpoint 중 현재 3개만 사용 중.
> 본 문서는 그 17개 미사용 endpoint와 기존 한계점을 바탕으로 한 단계적 고도화 계획.

## 현재 상태 (Baseline)

- **사용 중인 API**: 3개
  - `POST /oauth2/token` (인증)
  - `GET /api/v1/accounts` (계좌 조회)
  - `POST /api/v1/orders` (주문 생성)
- **LLM 백엔드**: OpenCode (`opencode run --format json --auto`)
- **세션 모델**: 단일 세션 = 단일 symbol 가정
- **안전장치**: BUY/SELL 버튼 1회 클릭 = 즉시 주문 (확인 없음)
- **토큰 캐싱**: 없음 (매 호출마다 `POST /oauth2/token` 재발급)
- **시세 UI**: 없음 (분석 결과 텍스트만)

## 한계점

1. **LLM hallucination**: codex가 토스 API 호출에 실패하면 (401, timeout 등) 사실상 추측으로 판단
2. **사용자 신뢰 부족**: "왜 BUY지?" 근거를 사용자가 직접 확인 불가
3. **즉시 주문 위험**: 1클릭 = 실제 매수/매도, 실수 시 금전 손실
4. **자산 비가시성**: 보유 종목, 잔고, 매수가능 금액을 화면에서 안 봄
5. **Rate Limit 위험**: 매 분석마다 새 토큰 발급 + 호출 폭증 가능

## 고도화 7대 방안 (우선순위순)

### 🥇 Phase 1 — 분석 정확도 + 안정성 (즉시, 2~3시간)

**§1. 에이전트 분석 정확도 (Context Snapshot)**

- 매 분석 호출 시 토스 API 8~10개 endpoint에서 데이터 수집
- 시세/호가/체결/캔들/종목/매수유의/시장/환율/보유/매수가능
- prompt에 JSON 첨부 → LLM이 실제 데이터로 판단
- 401 등 일부 실패해도 수집된 데이터로 동작 (graceful)
- 사용 API: `prices`, `orderbook`, `trades`, `candles`, `stocks`, `stocks/{symbol}/warnings`, `market-calendar/KR`, `exchange-rate`, `holdings`, `buying-power`

**§7. Rate Limit + 토큰 캐싱 + 동시성**

- `expires_in` 동안 토큰 캐싱 (메모리, in-flight 패턴)
- 429 응답 시 exponential backoff
- `Promise.all` 기반 병렬 fetch (Rate limit 안전 마진 두고)
- 토큰 발급 race condition 방지 (in-flight Promise 공유)

**완료 기준**: LLM이 "삼성전자 현재가 81,000원, 거래량 증가, 보유 0, 매수가능 100,260원" 같은 **실제 수치 기반** 응답을 함

### 🥈 Phase 2 — 가시성 (1~2일)

**§2. 시세/차트 UI 패널**

- 현재가, 등락률, 거래량, 호가 10단계
- 캔들 차트 (lightweight-chart 또는 순수 SVG)
- 30초 단위 폴링

**§4. 포트폴리오 대시보드**

- 보유 종목 리스트 (매입가/현재가/수익률)
- 매수 가능 금액, 누적 수수료
- 일별 손익 집계 (history 기반)

**사용 API**: `holdings`, `buying-power`, `commissions`, `prices`, `orderbook`, `candles`

**완료 기준**: 한 화면에서 "내 자산 + 이 종목 시세 + 에이전트 판단" 동시 확인

### 🥉 Phase 3 — 안전장치 + UX (안정화)

**§6. Confirm 모드 + 가드**

- 3-모드: `off` (즉시) / `paper` (시뮬레이션) / `confirm` (UI 확인 필수)
- Holdings 기반 SELL 가드 (미보유 종목 매도 차단)
- Buying power 기반 BUY 가드 (잔고 부족 차단)
- High-value 경고 (1억+ 주문 confirm 강제)
- 미체결 주문 전체 취소 버튼

**§5. 종목 검색 + 워치리스트**

- `GET /api/v1/stocks?query=삼성` 자동완성
- `GET /api/v1/ranking` 거래대금/등락률 상위
- localStorage 워치리스트

**사용 API**: `stocks`, `holdings`, `buying-power`, `sellable-quantity`, `ranking`, `orders`, `orders/{id}/cancel`

**완료 기준**: 잘못된 매매가 1회 클릭으로 발생할 수 없음

### 🏅 Phase 4 — 고급 (차별화)

**§3. 조건주문 자동 등록**

- 단일/OCO/OTO 3가지 조건
- 가격 도달 시 자동 체결
- 에이전트 = 24시간 트레이더 완성

**사용 API**: `Conditional Order` (신규 카테고리)

**완료 기준**: "삼성전자가 78,000원 이하로 내려가면 자동 매수" 같은 조건 설정

## 우선순위 매트릭스

| # | 방안 | 임팩트 | 난이도 | 가치 |
|---|---|---|---|---|
| 1 | Context snapshot | ⭐⭐⭐⭐⭐ | 중 | ⭐⭐⭐⭐⭐ |
| 2 | 시세/차트 UI | ⭐⭐⭐⭐ | 중-상 | ⭐⭐⭐⭐⭐ |
| 6 | 안전장치 | ⭐⭐⭐⭐⭐ | 중-상 | ⭐⭐⭐⭐ |
| 7 | Rate limit/캐싱 | ⭐⭐⭐ | 중 | ⭐⭐⭐ |
| 4 | 포트폴리오 | ⭐⭐⭐ | 중 | ⭐⭐⭐ |
| 5 | 검색/워치리스트 | ⭐⭐ | 중 | ⭐⭐⭐ |
| 3 | 조건주문 | ⭐⭐⭐⭐ | 상 | ⭐⭐⭐⭐ |

## Phase 1 상세 계획 (현재 진행)

### 1.1 토큰 캐싱 (`lib/tossinvest.ts`)

```ts
type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

async function getAccessToken(apiKey, secretKey): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.token;
  if (inflight) return inflight;
  inflight = issueAccessToken(apiKey, secretKey).then((t) => {
    cached = { token: t, expiresAt: now + 23 * 60 * 60 * 1000 }; // 23h (보수적)
    inflight = null;
    return t;
  }).catch((e) => { inflight = null; throw e; });
  return inflight;
}
```

### 1.2 Market Context 수집 (`lib/market-context.ts`)

```ts
export type MarketContext = {
  collectedAt: string;
  symbol: string;
  market: "KR" | "US";
  // 시세
  price?: unknown;
  orderbook?: unknown;
  recentTrades?: unknown;
  priceLimits?: unknown;
  candles?: unknown;
  // 종목
  stockInfo?: unknown;
  warnings?: unknown;
  // 시장
  marketCalendarKR?: unknown;
  exchangeRate?: unknown;
  // 자산
  holdings?: unknown;
  buyingPower?: unknown;
  sellableQuantity?: unknown;
  // 에러
  errors: { endpoint: string; message: string }[];
};

export async function collectMarketContext(
  session: SessionState,
  symbol: string,
  market: "KR" | "US",
): Promise<MarketContext>
```

- 토큰 발급 후 accountSeq 확보
- `Promise.allSettled`로 병렬 fetch (실패는 errors에 누적, 계속 진행)
- 401/403은 `{error: "auth_failed"}`로 마킹 → codex는 HOLD 결정 가능

### 1.3 Prompt에 Context 첨부 (`lib/agents/shared.ts`)

```ts
// buildPrompt()에 context 인자 추가
export function buildPrompt(session, context: MarketContext): string
```

- system prompt 끝부분에 "## 실시간 시장 데이터 (수집 시각: ...)" 섹션 추가
- 각 endpoint 결과를 마크다운 코드블록(JSON)으로 첨부
- "errors 배열이 있으면 그 endpoint는 신뢰하지 말라"는 지침 추가

### 1.4 `/api/agent/run` 라우트 수정

```ts
const context = await collectMarketContext(session, body.symbol, body.market);
const result = await runInvestmentAgent(session, context);
```

- symbol/market은 어떻게 결정? → 현재 session에 "watchlist" 필드 추가하거나, recommendations에서 가져오기
- **결정 필요**: §1.4는 별도 작업으로 Phase 1.5에서 다룸 (기본 동작 = 마지막 recommendation의 symbol)

### 1.5 세션에 watchlist 추가 (선택)

- `SessionState`에 `watchlist: { symbol, market }[]` 추가
- UI에서 "+ 워치리스트 추가" 버튼
- `/api/agent/run`은 watchlist 첫 항목 또는 last recommendation의 symbol 사용

### 1.6 진단 정보(history)에 context 포함

- `AnalysisHistoryRecord`에 `context: MarketContext` 필드 추가
- 후속 분석 시 codex가 참고할 수 있게

## Phase 1 작업 순서

1. **`lib/tossinvest.ts`**: 토큰 캐싱 + `getAccessToken()` public API
2. **`lib/market-context.ts`**: 새 파일, 8~10개 endpoint collector
3. **`lib/agents/shared.ts`**: `buildPrompt(session, context)` signature 변경
4. **`lib/agents/opencode/runner.ts`**: context를 buildPrompt에 전달
5. **`app/api/agent/run/route.ts`**: context 수집 → runner 전달 → history에 저장
6. **`lib/types.ts`**: `MarketContext` 타입, `AnalysisHistoryRecord.context` 필드
7. **`app/page.tsx`**: 최소 변경 (symbol/market 결정 로직만)
8. 검증: lint + build + 실제 1회 분석 + history 파일에 context 저장 확인

## 위험 & 주의

- **Rate Limit**: 8개 endpoint × 30초 간격 = 시간당 960 호출. docs rate limit 확인 후 안전 마진 필요.
- **응답 크기**: candles 20개 + 나머지 JSON → codex context에 큰 용량. 압축 또는 핵심만 발췌 고려.
- **API 키 노출**: context는 codex로 전송되지만 redact() 8자 미만 스킵 로직 그대로 유지.
- **History 파일 크기**: 1 record 1 file. context 추가 시 파일 크기 2~3배 증가 가능. history 보존 정책 확인 필요.

## 비-고도화 (의도적 보류)

- **텔레그램 알림**: toss-trader v1.4.1에 있었지만 본 프로젝트는 UI 직접 확인 전제 → 보류
- **paper trading 모드**: env var `TOSS_TRADING_MODE=paper`로 가능하지만 우선순위 낮음
- **외부 storage (S3)**: history를 외부로 빼는 건 운영 단계 이슈
- **백테스팅**: 별도 프로젝트로 분리
