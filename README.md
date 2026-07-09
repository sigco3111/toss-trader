# 🤖 toss-trader

> **프로젝트**: 토스증권 Open API 기반 투자 어시스턴트
> **Paper trading 기본값, 실계좌는 명시적 사용자 확인 후**
> **스택**: Next.js 16.2.10 (App Router) + React 19.2.4 + TypeScript 5 + Tailwind CSS 4 + ESLint 9 (2026-07-10 보일러플레이트 검증 완료)
> **v0.4 단순화**: Notion 이력 제거 + kstost/stock 원본 history.ts 방식 (로컬 JSON)

[kstost/stock](https://github.com/kstost/stock)에서 영감을 받아 **원본과 같은 Next.js + Vercel 구조**로 재설계한 버전입니다.
자세한 아키텍처는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참조.

## 🎬 라이브 데모

```text
Vercel 자동 배포 (예정) — https://toss-trader.vercel.app/
```

```
$ open https://toss-trader.vercel.app/
# → 대시보드에서 시세/잔고/매수/매도
# → LLM 분석은 오빠 PC의 OpenCode 글로벌 디폴트(= 미니맥스 M3) 사용
```

## 🤖 생성 정보

- **기반**: [kstost/stock](https://github.com/kstost/stock) (MIT, kstost) — Next.js 15 + 토스 Open API
- **재설계 사유**: 원본과 같은 Next.js 구조 + paper trading 우선 + **v0.3 단순화** (LLM 호출 0줄) + **v0.4 단순화** (Notion 제거, kstost history.ts 방식)
- **대상**: sigco3111 + 토스증권 WTS 계좌 보유 일반 개인
- **개발 도구**: OpenCode + oh-my-opencode (글로벌 디폴트 = 미니맥스 M3)

## ✨ 주요 특징

- 🔒 **시크릿 격리** — 토스 client_id/secret은 본인 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600), toss-trader 코드 내 보관 0
- 📝 **Paper trading 기본값** — `DRY_RUN=true` 기본, 실계좌는 Telegram 사용자 confirm 후만 활성
- 🧠 **LLM 단일화** — 본인 PC의 OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`) 한 가지. 모델 변경 = OpenCode 설정에서만
- 💬 **Telegram confirm** — BUY/SELL은 Telegram inline button 사용자 명시 확인 후
- 🗂️ **로컬 history** — kstost/stock 원본 방식 (1 record = 1 JSON 파일). Vercel에서 readonly 시 silent
- 🛡️ **안전 가드 6종** — `safety.ts` (DRY_RUN + 422 가드 + 422 retry + confirmHighValue + Telegram confirm + 토큰 길이 검증)

## 🎮 조작법

| 화면 | 동작 |
|---|---|
| `/` (메인) | Portfolio (잔고/손익) + 매수/매도 버튼 (paper 기본) |
| `BUY/SELL` 버튼 | Confirm 모달 → Telegram 메시지 발송 → 사용자 [확인] → 토스 주문 (DRY_RUN=false) |
| `🔄 새로고침` | Portfolio 10초 자동 갱신 + 수동 새로고침 |

## 🌐 API endpoint (개발자/에이전트용)

toss-trader는 토스 Open API의 **catch-all relay**를 제공합니다. `/api/toss/[...path]` 하나로 토스의 28개 endpoint 모두 호출 가능.

| 동작 | 호출 예시 |
|---|---|
| 계좌 목록 | `GET /api/toss/api/v1/accounts` |
| 보유 종목 | `GET /api/toss/api/v1/holdings` + `X-Tossinvest-Account: 1` 헤더 |
| 시세 조회 | `GET /api/toss/api/v1/prices?symbols=005930,000660` |
| 호가 조회 | `GET /api/toss/api/v1/orderbook?symbol=005930` |
| 캔들 (차트) | `GET /api/toss/api/v1/candles?symbol=005930&interval=1d` |
| 매수/매도 (paper) | `POST /api/toss/api/v1/orders` + JSON body (DRY_RUN=true 시 **자동 차단**, 423 응답) |
| 매수/매도 (실계좌) | DRY_RUN=false + Telegram 사용자 confirm 후만 |

| History | 호출 예시 |
|---|---|
| 이력 조회 | `GET /api/history?limit=100&kind=order` |
| 이력 조회 (symbol) | `GET /api/history?symbol=005930&limit=50` |
| 이력 기록 (자동) | OrderButton이 매수/매도 결과 시 자동 POST |
| Vercel readonly | GET/POST 모두 `availability: "readonly"` 응답 |

| Deploy | URL / 명령 |
|---|---|
| Vercel 대시보드 | https://vercel.com/dashboard |
| 자동 preview | PR마다 자동 생성 |
| Vercel CLI | `vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)` |

> 📦 **전전 endpoint 표** (28종 + 5 카테고리 + 16 rate limit 그룹 + 422 가드 10종) = [docs/OPENAPI_REFERENCE.md](docs/OPENAPI_REFERENCE.md)

### 안전 가드 (6종 자동 적용)

| # | 가드 | 효과 |
|---|---|---|
| 1 | `DRY_RUN=true` 기본 | POST `/api/v1/orders` 자동 차단 (HTTP 423) |
| 2 | 422 코드 자동 인식 | 10종 코드 → 사용자 친화 메시지 변환 |
| 3 | 1억+ 주문 | `confirmHighValueOrder: true` 헤더 자동 설정 가능 |
| 4 | 429/5xx 재시도 | `Retry-After` 우선 + 지수 백오프 (1s→2s→4s, max 3회) |
| 5 | 401 토큰 재발급 | 캐시 무효화 후 1회 재시도 |
| 6 | 안전 가드 6종 (`safety.ts`) | TRADING_MODE + AMOUNT_LIMIT + MARKET_HOURS + ACCOUNT_TYPE + TELEGRAM_CONFIRM + AUDIT_LOG |

### 응답 envelope (toss-trader 메타 추가)

```json
{
  "data": { /* 토스 원본 응답 */ },
  "servedAt": "2026-07-10T07:30:00.000Z",
  "dryRun": true,
  "rateLimit": {
    "limit": 5,
    "remaining": 4,
    "reset": 1
  }
}
```

---

## 🛠️ 개발자 섹션

> 아래는 개발자/에이전트용 정보. 비개발자는 무ignore해도 됩니다.

### 기술 스택

- **프레임워크**: Next.js 16.2.10 (App Router)
- **언어**: TypeScript 5, React 19.2.4
- **스타일**: Tailwind CSS 4
- **린트**: ESLint 9
- **호스팅**: Vercel
- **테스트**: vitest + MSW (HTTP mock)
- **이력**: kstost/stock 원본 (로컬 JSON)

### 로컬 개발

```bash
# 1) 의존성
npm install

# 2) 환경변수 셋업
#    .env.example → .env.local 복사 후 본인 값 입력
cp .env.example .env.local
#    .env.local 편집:
#      TOSS_CLIENT_ID=실제_클라이언트_ID
#      TOSS_CLIENT_SECRET=실제_시크릿
#      TELEGRAM_BOT_TOKEN=봇_토큰 (선택)
#      TELEGRAM_CHAT_ID=본인_chat_id (선택)

# 3) Vercel 배포 (또는 자동: GitHub push 시 자동 deploy)
#    옵션 A: Vercel 대시보드 → GitHub repo 연결 → 자동 preview/prod
#    옵션 B: Vercel CLI
vercel link
vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)

# 4) 로컬 dev
npm run dev  # http://localhost:3000
```

### Vercel 환경변수 셋업 (v0.4)

Vercel 대시보드 → Project → **Settings → Environment Variables** 에서 추가:

| Key | Value 예시 | 용도 |
|---|---|---|
| `TOSS_CLIENT_ID` | `toss_a1b2c3...` | 토스 Open API client_id (필수) |
| `TOSS_CLIENT_SECRET` | `sk_live_...` | 토스 Open API client_secret (필수) |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-...` | Telegram 봇 토큰 (선택, dev fallback 지원) |
| `TELEGRAM_CHAT_ID` | `123456789` | 본인 Telegram chat_id (선택) |
| `TOSS_TRADING_MODE` | `paper` (기본값) | `paper` / `live` / `simulation` |
| `TOSS_MAX_TRADE_AMOUNT` | `1000000` (기본값) | 단일 주문 한도 (원) |
| `DRY_RUN` | `true` (기본값) | `false` + live + Telegram confirm 시 실계좌 |

> **Production / Preview / Development** 3개 환경별로 따로 설정 가능. 보통 Production + Preview에만 토큰 넣음.

### `vercel.json` 핵심 설정

```json
{
  "framework": "nextjs",
  "regions": ["icn1"],
  "buildCommand": "npm run build",
  "functions": {
    "app/api/telegram/callback/route.ts": { "maxDuration": 10 },
    "app/api/telegram/send/route.ts": { "maxDuration": 10 },
    "app/api/toss/[...path]/route.ts": { "maxDuration": 10 },
    "app/api/history/route.ts": { "maxDuration": 10 }
  }
}
```

- `icn1`: Vercel 서울 리전 (한국 사용 시 latency 최소화)
- `maxDuration: 10`: Edge Function 기본 10초. toss-trader API는 sub-second 응답이라 충분

### `.env.example` (커밋 가능, 실제 값 없음)

```bash
TOSS_CLIENT_ID=your_client_id_here
TOSS_CLIENT_SECRET=your_client_secret_here
TOSS_TRADING_MODE=paper
TOSS_MAX_TRADE_AMOUNT=1000000
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_CONFIRM_TTL_SEC=300
DRY_RUN=true
```

> 실제 값은 `.env.local` (git 추적 금지)에 입력. Vercel은 대시보드에서 직접 추가.

### 🛠️ 개발 도구 — OpenCode + oh-my-opencode

toss-trader는 **오빠 PC의 OpenCode + oh-my-opencode** 환경에서 개발합니다.

#### 핵심 원칙 (v0.3 단순화)

> **모델 변경의 유일한 경로 = OpenCode 설정**. 우리 프로젝트는 모델 설정 코드 0줄.

#### 1) OpenCode — TUI/exec 에이전트

```bash
brew install opencode
opencode                       # TUI 진입
opencode exec "..."            # 비대화형
```

- **글로벌 디폴트**: `~/.config/opencode/opencode.json`의 `model: "minimax/MiniMax-M3"`
- **공식 문서**: [opencode.ai/docs](https://opencode.ai/docs)

#### 2) oh-my-opencode — OpenCode 플러그인

```bash
bunx oh-my-opencode@latest install --no-tui \
  --platform=opencode \
  --minimax-coding-plan=yes \
  --claude=no --gemini=no --copilot=no \
  --skip-auth
# TUI에서 /connect → 미니맥스 API 키 1회 입력
```

- **11 agents** + **54+ hooks** + **5 MCPs** (context7, codegraph 등)

#### 3) toss-trader에서 OpenCode의 역할

| 차원 | Vercel (사용자 분석) | OpenCode (오빠 코딩) |
|---|---|---|
| LLM 호출 | ❌ 코드 0줄 | ⭕ 오빠 PC TUI/exec |
| 모델 | — | 미니맥스 M3 (글로벌 디폴트) |
| 목적 | — | Next.js 컴포넌트/로직 자동 생성 |
| 시크릿 | Vercel env (Telegram만) | `~/.config/opencode/opencode.json` 또는 `/connect` |

> v0.3 단순화: "Vercel에서 LLM 호출" 행 자체가 ❌. 토스 Open API relay + history + Telegram 알림만.

### 📂 프로젝트 구조 (v0.4)

```
toss-trader/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # 메인 대시보드 (Portfolio + OrderButton)
│   ├── globals.css
│   ├── favicon.ico
│   └── api/
│       ├── toss/[...path]/route.ts    # 2단계: 토스 Open API relay
│       ├── telegram/send/route.ts     # 4단계: 주문 confirm 발송
│       ├── telegram/callback/route.ts # 4단계: Telegram webhook
│       └── history/route.ts           # 6단계: history GET/POST (kstost 방식)
├── components/
│   ├── Portfolio.tsx                  # 5단계: 보유 종목 + 손익
│   └── OrderButton.tsx                # 4단계: 매수/매도 + history write
├── lib/
│   ├── toss.ts                        # 2단계: 토스 Open API 클라이언트
│   ├── safety.ts                      # 3단계: 6대 가드
│   ├── telegram.ts                    # 4단계: Telegram confirm
│   ├── history.ts                     # 6단계: kstost 방식 JSON 기록
│   ├── types.ts                       # 6단계: HistoryRecord 등
│   └── format.ts                      # 5단계: KRW/손익 포맷
├── history/                           # 6단계: 1 record = 1 JSON 파일
│   └── .gitkeep                       # (history/*.json은 .gitignore)
├── docs/
│   ├── ARCHITECTURE.md                # v0.4 정식
│   ├── OPENAPI_REFERENCE.md           # v0.1
│   └── SAFETY.md                      # (예정)
├── .env.example
├── next.config.ts
├── next-env.d.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── vitest.config.ts
├── package.json                       # name=toss-trader
├── AGENTS.md
├── README.md
├── LICENSE
└── .gitignore
```

> v0.4에서 **삭제**: `app/api/notion/`, `lib/notion.ts`, `docs/NOTION_SETUP.md`, `@notionhq/client` 의존성.
> v0.3에서 **삭제**: `app/settings/`, `app/api/llm/`, `lib/llm/`, `components/SettingsForm.tsx`, `components/ChatPanel.tsx`.

### 🎨 디자인 결정

#### 원본 (kstost/stock) 대비 변경점

| 차원 | 원본 (kstost) | 우리 (v0.4) |
|---|---|---|
| UI | Next.js + Vercel | ✅ Next.js + Vercel (동일) |
| LLM | Codex CLI 단일 | ❌ toss-trader 코드 0줄 (= OpenCode 글로벌) |
| LLM 호출 | `child_process.spawn('codex')` | ❌ Vercel에서 호출 없음. 본인 PC의 OpenCode |
| 이력 저장 | 로컬 JSON (`history/<epoch>.json`) | ✅ **동일 패턴** (v0.4) |
| 시크릿 | Next.js 서버 메모리 | 본인 PC `~/.hermes/secrets/` (chmod 600) |
| 주문 실행 | 화면 버튼 즉시 | Telegram inline button + 사용자 확인 |
| 안전장치 | prompt 차원 | `safety.ts` 가드 6종 + 422 자동 처리 |
| Paper trading | ❌ 없음 | ✅ 기본값 (`DRY_RUN=true`) |
| 미니맥스 | ❌ 미사용 | ⭕ OpenCode 글로벌 디폴트 |
| Notion 이력 | ❌ 없음 (kstost) | ❌ 없음 (v0.4 단순화) |

#### 6대 안전 가드 (safety.ts)

1. `DRY_RUN=true` 기본값 — 토스 주문 endpoint 완전 차단
2. 토스 422 `account-restricted` / `prerequisite-required` 자동 안내
3. `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder
4. Telegram inline button = 사용자 마지막 confirm
5. 토큰 길이/형식 검증 (실패 → 안전 기본값)
6. (추가) TRADING_MODE / AMOUNT_LIMIT / MARKET_HOURS / ACCOUNT_TYPE / TELEGRAM_CONFIRM / AUDIT_LOG

#### paper trading 우선 철학

실계좌 주문은 **비가역 (irreversible)** 입니다. 한 번 체결된 주문은 시장가로만 청산 가능하며, 잘못된 행동지침 한 줄이 수백만 원 손실로 이어질 수 있습니다. 따라서:

- 모든 분석은 **paper** 모드에서 검증
- 실계좌 모드 진입은 Telegram 사용자 confirm 명시
- Telegram inline button이 사용자 마지막 확인

### 🧠 동작 원리

```text
사용자 (브라우저)
    ↓
[1] 메인 대시보드 로드
    ├─ Portfolio: 10초 polling (GET /api/toss/api/v1/holdings + prices)
    └─ 시세/잔고/손익 표시
    ↓
[2] BUY/SELL 클릭
    ├─ Confirm 모달 → "발송" 클릭
    └─ POST /api/telegram/send
    ↓
[3] lib/telegram.sendOrderConfirm()
    ├─ orderId = order_<12hex>
    ├─ in-memory store 저장 (TTL 5분)
    └─ Telegram API sendMessage (또는 dev fallback)
    ↓
[4] 사용자 Telegram [확인] 클릭
    └─ POST /api/telegram/callback (Telegram webhook)
    ↓
[5] lib/telegram.handleCallback() → orderId matched, status=confirmed
    └─ answerCallbackQuery로 사용자에게 토스트
    ↓
[6] 클라이언트 polling
    └─ POST /api/toss/api/v1/orders
       body: { symbol, side, quantity, price, telegramConfirmed: true, clientOrderId: orderId }
    ↓
[7] 3단계 가드 5 (telegramConfirmed) → 통과
    2단계 tossFetch: DRY_RUN 검사 + 422/429/401 자동 처리
    ↓
[8] 토스 Open API 주문 체결
    ↓
[9] OrderButton이 history 기록 (POST /api/history)
    └─ lib/history.writeHistory() → history/<epoch>.json (Vercel에서 readonly 시 silent)
```

> **상세 아키텍처 + 안전 가드**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> **상세 토스 Open API 레퍼런스**: [`docs/OPENAPI_REFERENCE.md`](docs/OPENAPI_REFERENCE.md)

### 🔬 검증

- [x] `npm run build` 0 에러 (2026-07-10 검증, 1131ms)
- [x] `npm run lint` 0 errors, 0 warnings
- [x] `npm run test` 81/81 PASS (format 31 + safety 25 + telegram 13 + history 12)
- [ ] `safety.ts` dry-run 가드 — `DRY_RUN=true`에서 주문 endpoint 호출 0회
- [ ] 토큰 길이 검증 — `tossinvest.env` chmod 600 + 길이 검증
- [ ] LLM 호출 0줄 — `grep -rn "openai\|nim\|anthropic" lib/ app/ components/` 모두 0건 (Vercel 코드)
- [ ] 토스 422 가드 — 5종 코드 자동 인식 + 사용자 안내
- [ ] Telegram inline button — 사용자 confirm 없이 실행 0회
- [ ] history 1 record = 1 JSON (kstost 호환)

### 📝 프롬프트 이력

- **v0.0 (2026-07-09)**: kstost/stock 영감 + 우리 스택 1차 스캐폴드
- **v0.1 (2026-07-09)**: docs/OPENAPI_REFERENCE.md 정식 문서
- **v0.2 (2026-07-09)**: 아키텍처 결정 — Next.js + Vercel + BYOK + 다중 LLM + Codex 미니맥스 공식 지원
- **v0.3 (2026-07-09)**: 개발 도구 통합 — Codex CLI + LazyCodex 설치
- **v0.4 (2026-07-10)**: 단순화 — Codex → OpenCode + oh-my-opencode. LLM 호출 0줄, BYOK 폼 제거, 모델 = OpenCode 글로벌
- **v0.5 (2026-07-10)**: 1단계 보일러플레이트 — Next.js 16.2.10 + React 19.2.4 + Tailwind 4 + TypeScript 5 + ESLint 9
- **v0.6 (2026-07-10)**: README 비개발자용 가이드 5단계 추가
- **v0.7 (2026-07-10)**: 2~5단계 — 토스 Open API relay + 6대 안전 가드 + Telegram confirm + OrderButton + Portfolio
- **v0.8 (2026-07-10)**: 6단계 — Notion 제거 + kstost/stock 원본 history.ts 방식 (로컬 JSON, 1 record = 1 파일). lib/history.ts + lib/types.ts + app/api/history/route.ts 신규, @notionhq/client 의존성 제거. OrderButton이 매수/매도 결과 시 자동 history 기록
- **v0.9 (2026-07-10)**: 7단계 — Vercel 배포 (vercel.json: framework=nextjs, regions=[icn1], functions maxDuration=10) + .env.example (TOSS_* / TELEGRAM_* / DRY_RUN 7개 env 키) + README 비개발자용 env 셋업 가이드 (Production/Preview/Development 3개 환경). 자주 막히는 곳 11개로 확장 (Deploy/401/history-readonly/telegram-send-failed 등 추가)

### 🤝 원본 크레딧

- 원본: [kstost/stock](https://github.com/kstost/stock) (MIT License, 2026) — Next.js 15 + Codex CLI + Tossinvest Open API + **lib/history.ts 패턴**
- [OpenCode 공식](https://opencode.ai/docs) — TUI/exec 에이전트
- [oh-my-opencode (code-yeongyu)](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인 (11 agents, 54+ hooks, 5 MCPs)
- [NIM 키 발급 직행 URL](https://build.nvidia.com/settings/api-keys) — 미니맥스 등 NIM 모델 키 발급 (핸드폰 인증 필요)

### 📜 License

MIT — 원본 kstost/stock과 동일
