# 🏗️ toss-trader 아키텍처

> 2026-07-10 v0.4 결정: **Notion 이력 제거 + kstost/stock 원본 history.ts 방식** (로컬 JSON, 1 record = 1 파일).
> 1차 스캐폴드 (CLI + Telegram) → 2차 (Next.js + Vercel + BYOK + 다중 LLM) → 3차 (v0.3 단순화: BYOK 폼 / LLM provider 라우터 / ChatPanel 제거) → **4차 (현재: Notion 제거 + kstost history.ts)**. toss-trader는 토스 Open API relay + kstost history + Telegram 알림 + Portfolio UI만 담당.

## 🌐 전체 구조

```
사용자 브라우저 (sigco3111)
    ↓ HTTPS
[Vercel — Next.js 15 (App Router)]
    ├── app/page.tsx                  # 메인 대시보드 (Portfolio + OrderButton)
    ├── app/api/
    │   ├── toss/[...path]/route.ts   # 2단계: 토스 Open API relay (CORS 우회)
    │   ├── telegram/send/route.ts    # 4단계: 주문 confirm 발송
    │   ├── telegram/callback/route.ts # 4단계: Telegram webhook
    │   └── history/route.ts          # 6단계: history GET/POST
    ├── components/
    │   ├── Portfolio.tsx             # 5단계: 보유 종목 + 손익 (10초 polling)
    │   └── OrderButton.tsx           # 4단계: BUY/SELL + history write
    ├── lib/
    │   ├── toss.ts                   # 2단계: 토스 Open API 클라이언트
    │   ├── safety.ts                 # 3단계: 6대 가드
    │   ├── telegram.ts               # 4단계: in-memory orderId 매칭
    │   ├── history.ts                # 6단계: kstost JSON 기록
    │   ├── types.ts                  # 6단계: HistoryRecord
    │   └── format.ts                 # 5단계: KRW/손익 포맷
    └── styles/

Toss Open API (openapi.tossinvest.com)        ← 오빠 PC의 ~/.hermes/secrets/tossinvest.env
Telegram Bot API                             ← Vercel env (서버 side, dev fallback 지원)
```

> **v0.4 핵심**: Notion 완전 제거. history는 kstost/stock 원본 (`history/<epoch>.json`). Vercel serverless filesystem 제약 (read-only, ephemeral)은 `checkHistoryAvailability()`로 graceful 처리.

## 🔑 시크릿 격리 (v0.4)

| 항목 | 결정 |
|---|---|
| **Toss client_id/secret** | 오빠 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600) |
| **toss-trader 코드 내 보관** | ❌ 0. `app/api/toss/[...path]/route.ts` 호출 시 env 주입 |
| **Vercel env 가능** | ✅ Telegram bot token (서버 측 도구용) |
| **Vercel env 금지** | ❌ Toss/NIM/OpenAI 토큰 (v0.3에서 BYOK로 Vercel 회피 → v0.4에서 toss-trader 코드 자체에서 제거) |
| **Notion** | ❌ 완전 제거 (v0.4) |
| **모델 변경 경로** | 오빠 PC의 `~/.config/opencode/opencode.json`의 `model` 필드 (toss-trader 무관) |

### 토큰 흐름

```text
[1] 오빠: WTS 로그인 → client_id/secret 발급 → 토스 Open API 콘솔에서 직접
[2] 오빠: ~/.hermes/secrets/tossinvest.env에 저장 (chmod 600)
[3] Vercel 배포: toss-trader 코드는 토큰을 모름. toss API 호출 시 환경변수 또는 fetch 옵션으로 주입
[4] 사용자: 브라우저로 toss-trader 대시보드 접속 → 시세/매수/매도 (paper 기본)
[5] history 기록: lib/history.ts는 토큰 안 만짐. 호출자(API route)가 record 조립
```

## 🗂️ history 저장 (v0.4, kstost/stock 원본 방식)

> 영감: [kstost/stock/lib/history.ts](https://github.com/kstost/stock) (MIT, 2026)

| 항목 | 결정 |
|---|---|
| **저장 위치** | `history/<epochSeconds>.json` (1 record = 1 파일) |
| **동시 초 충돌** | `history/<epochSeconds>-2.json`, `-3.json`, ... |
| **레코드 종류** | `analysis` (LLM 분석), `order` (매수/매도 결과), `snapshot` (Portfolio 시점) |
| **시크릿** | 절대 저장 안 함. 호출자 책임. |
| **Vercel** | read-only filesystem → `checkHistoryAvailability()` → `availability: "readonly"` 응답 + silent fail |
| **조회** | `GET /api/history?limit=100&kind=order&symbol=005930` |

### 6단계 API

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/history?limit=100&kind=order&symbol=005930` | (query) | `{ availability, count, records, servedAt }` |
| `POST` | `/api/history` | `{ record: HistoryRecord }` | `{ availability, saved, filename, servedAt }` |
| `GET` | `/api/history?limit=0` (Vercel) | — | `{ availability: "readonly", records: [] }` |

### Vercel 제약 (중요)

- Vercel serverless filesystem = read-only + ephemeral
- `writeHistory()`는 Vercel에서 `EACCES` / `EROFS` 실패 가능
- `checkHistoryAvailability()` 자동 감지 → UI에 표시
- dev/local에서는 정상 작동
- 영구 저장 필요 시: S3 / R2 / 외부 storage 별도 구현 (v0.5+ TODO)

## 🧠 LLM 단일 모델 (v0.3)

| Provider | base URL | 디폴트 모델 | 비고 |
|---|---|---|---|
| **minimax** | `https://api.minimax.io/anthropic` (Anthropic 호환) | `minimax/MiniMax-M3` | OpenCode `~/.config/opencode/opencode.json`의 `model` 필드 |

> **모델 변경 방법 (오빠만)**: `~/.config/opencode/opencode.json`의 `model` 필드 수정 또는 `opencode -m <model>` 임시 변경. toss-trader 코드 0줄 영향.

## 🛡️ 안전 가드 (6+5 = 11종)

### tossFetch 내장 (2단계, HTTP/422/429/401)

| # | 가드 | 효과 |
|---|---|---|
| 1 | DRY_RUN + POST/PUT/DELETE → `/api/v1/orders` | HTTP 423 즉시 차단 |
| 2 | 422 코드 10종 | 사용자 친화 메시지 매핑 |
| 3 | 1억+ 주문 | `confirmHighValueOrder: true` 헤더 자동 설정 가능 |
| 4 | 429/5xx 재시도 | `Retry-After` 우선 + 지수 백오프 (1s→2s→4s, max 3회) |
| 5 | 401 토큰 재발급 | 캐시 무효화 + 1회 재시도 |

### safety.ts (3단계, 의도/맥락/시간/금액/계좌/audit)

| # | 가드 | 환경변수 | 기본값 | 차단 시 HTTP |
|---|---|---|---|---|
| 6 | TRADING_MODE | `TOSS_TRADING_MODE` | `paper` | 423 |
| 7 | TRADE_AMOUNT_LIMIT | `TOSS_MAX_TRADE_AMOUNT` | 1,000,000원 | 422 |
| 8 | MARKET_HOURS | (KST 시간) | 09:00~15:30 (lunch 12~13) | 422 |
| 9 | ACCOUNT_TYPE | `TOSS_ACCOUNT_TYPE_OVERRIDE` | 미설정 (통과) | 423 |
| 10 | TELEGRAM_CONFIRM | `TOSS_TELEGRAM_CHAT_ID` | live만 강제 | 425 |
| 11 | AUDIT | (N/A) | 모든 가드 통과/차단 stdout JSON | (side effect) |

## 📂 디렉토리 구조 (v0.4)

```
toss-trader/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── favicon.ico
│   └── api/
│       ├── toss/[...path]/route.ts
│       ├── telegram/send/route.ts
│       ├── telegram/callback/route.ts
│       └── history/route.ts
├── components/
│   ├── Portfolio.tsx
│   └── OrderButton.tsx
├── lib/
│   ├── toss.ts
│   ├── safety.ts
│   ├── telegram.ts
│   ├── history.ts
│   ├── types.ts
│   └── format.ts
├── history/
│   └── .gitkeep
├── docs/
│   ├── ARCHITECTURE.md        ← 본 문서 (v0.4)
│   ├── OPENAPI_REFERENCE.md   ← v0.1
│   └── SAFETY.md              ← (예정)
├── test/
│   ├── safety.test.ts
│   ├── telegram.test.ts
│   ├── format.test.ts
│   └── history.test.ts
├── .env.example
├── next.config.ts
├── next-env.d.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── vitest.config.ts
├── package.json
├── AGENTS.md
├── README.md
├── LICENSE
└── .gitignore
```

## 🚦 배포 워크플로 (v0.4)

### 자동 배포 (권장)

1. **GitHub fork** — `https://github.com/sigco3111/toss-trader` 우상단 Fork
2. **Vercel connect** — [vercel.com](https://vercel.com) → Add New Project → fork한 저장소 Import
3. **Vercel env** — Project Settings → Environment Variables:
   - `TOSS_CLIENT_ID` (필수)
   - `TOSS_CLIENT_SECRET` (필수)
   - `TELEGRAM_BOT_TOKEN` (선택, dev fallback 지원)
   - `TELEGRAM_CHAT_ID` (선택)
   - `TOSS_TRADING_MODE=paper` (기본값)
   - `DRY_RUN=true` (기본값)
4. **Deploy** — 자동 빌드 + preview URL 생성
5. **main push마다 자동 prod** — 이후 GitHub push 시 자동 deploy

### 수동 배포 (CLI)

```bash
# 1) Vercel CLI 설치 + 로그인
npm i -g vercel
vercel login

# 2) 프로젝트 연결
vercel link

# 3) 환경변수 추가 (대시보드 권장, CLI도 가능)
vercel env add TOSS_CLIENT_ID
# → 값 입력 → Production/Preview/Development 선택

# 4) 프로덕션 배포
vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)
```

### 사용자 진입 플로우

1. Vercel URL 접속 → 메인 대시보드 (Portfolio + OrderButton)
2. Portfolio 10초 polling 자동 시작
3. 매수/매도 시 OrderButton → Telegram 메시지 → 사용자 [확인] → 토스 주문
4. history 기록 (Vercel에서 readonly면 silent)

## 📝 출처

- **원본**: [kstost/stock](https://github.com/kstost/stock) (MIT, 2026) — Next.js 15 + Codex CLI + Toss Open API + **lib/history.ts 패턴** (v0.4에서 차용)
- **OpenCode 공식**: [opencode.ai/docs](https://opencode.ai/docs) — TUI/exec 에이전트
- **oh-my-opencode**: [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인
- **NIM 카탈로그**: [build.nvidia.com](https://build.nvidia.com) — 미니맥스 등 모델 키 발급
- **토스 Open API**: [docs/OPENAPI_REFERENCE.md](OPENAPI_REFERENCE.md)
- **시크릿 격리 정책**: 메모리 §"kakao-timeline 보안 교훈" (2026-07-09) — 메신저 평문 노출만 금지
