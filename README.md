# 🤖 toss-trader

> **프로젝트**: 토스증권 Open API 기반 투자 어시스턴트
> **Paper trading 기본값, 실계좌는 명시적 사용자 확인 후**
> **스택**: Next.js 16.2.10 (App Router) + React 19.2.4 + TypeScript 5 + Tailwind CSS 4 + ESLint 9 (2026-07-10 보일러플레이트 검증 완료)

[kstost/stock](https://github.com/kstost/stock)에서 영감을 받아 **원본과 같은 Next.js + Vercel 구조**로 재설계한 버전입니다.
자세한 아키텍처는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참조.

## 🎬 라이브 데모

```text
Vercel 자동 배포 (예정) — https://toss-trader.vercel.app/
```

```
$ open https://toss-trader.vercel.app/
# → 대시보드에서 시세 조회 + 매수/매도 시뮬레이션 (paper)
# → LLM 분석은 오빠 PC의 OpenCode 글로벌 디폴트(= 미니맥스 M3) 사용
```

## 🤖 생성 정보

- **기반**: [kstost/stock](https://github.com/kstost/stock) (MIT, kstost) — Next.js 15 + 토스 Open API
- **재설계 사유**: 원본과 같은 Next.js 구조 + paper trading 우선 + **v0.3 단순화** (LLM 호출 0줄, 모델 = OpenCode 글로벌)
- **대상**: sigco3111 + 토스증권 WTS 계좌 보유 일반 개인
- **개발 도구**: OpenCode + oh-my-opencode (글로벌 디폴트 = 미니맥스 M3)

## ✨ 주요 특징

- 🔒 **시크릿 격리** — 토스 client_id/secret은 오빠 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600), toss-trader 코드 내 보관 0
- 📝 **Paper trading 기본값** — `DRY_RUN=true` 기본, 실계좌는 Telegram 사용자 confirm 후만 활성
- 🧠 **LLM 단일화** — 오빠 PC의 OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`) 한 가지. 사용자 모델 변경 = OpenCode 설정에서만
- 💬 **Telegram confirm** — BUY/SELL은 Telegram inline button 사용자 명시 확인 후
- 🗂️ **Notion 이력** — 모든 분석/주문은 Notion DB 기록 (Vercel env 사용, 서버 측)
- 🛡️ **안전 가드 5종** — `safety.ts` (DRY_RUN + 422 가드 + confirmHighValueOrder + Telegram confirm + 토큰 길이 검증)

## 🚀 실행 방법

```bash
# 1) 의존성
npm install

# 2) 토스 Open API 키 (오빠 PC)
#    ~/.hermes/secrets/tossinvest.env (chmod 600)
#      TOSS_CLIENT_ID=...
#      TOSS_CLIENT_SECRET=...
#    WTS 로그인 → 설정 > Open API 메뉴에서 발급

# 3) Vercel env (서버 측 도구만)
vercel link
vercel env add NOTION_API_KEY
vercel env add TELEGRAM_BOT_TOKEN

# 4) Vercel 배포
vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)
```

## 🎮 조작법

| 화면 | 동작 |
|---|---|
| `/` (메인) | 시세/잔고/이력 + 매수/매도 버튼 (paper 기본) |
| `BUY` 버튼 클릭 | Telegram confirm → 안전 가드 5종 통과 → 토스 주문 (DRY_RUN=false 시) |

## 🛠️ 기술 스택

- **프레임워크**: Next.js 15 (App Router) + TypeScript + Tailwind
- **LLM 호출**: ❌ toss-trader 코드 0줄. 오빠 PC의 OpenCode 글로벌 디폴트가 처리
- **Vercel env**: Notion API, Telegram Bot (서버 측 도구만)
- **이력**: Notion DB (`toss-trader` database)
- **알림**: Telegram Bot API (inline keyboard)
- **테스트**: `vitest` + MSW (HTTP mock)

## 🛠️ 개발 도구 — OpenCode + oh-my-opencode

toss-trader는 **오빠 PC의 OpenCode + oh-my-opencode** 환경에서 개발합니다.

### 핵심 원칙 (v0.3 단순화)

> **모델 변경의 유일한 경로 = OpenCode 설정**. 우리 프로젝트는 모델 설정 코드 0줄.

### 1) OpenCode — TUI/exec 에이전트

```bash
brew install opencode         # 또는 bunx
opencode                       # TUI 진입
opencode exec "..."            # 비대화형
```

- **글로벌 디폴트**: `~/.config/opencode/opencode.json`의 `model: "minimax/MiniMax-M3"`
- **프로젝트별 override**: `opencode -m <model>` 또는 프로젝트 `opencode.json`의 `model`
- **공식 문서**: [opencode.ai/docs](https://opencode.ai/docs)

### 2) oh-my-opencode — OpenCode 플러그인

```bash
bunx oh-my-opencode@latest install --no-tui \
  --platform=opencode \
  --minimax-coding-plan=yes \
  --claude=no --gemini=no --copilot=no \
  --skip-auth
# TUI에서 /connect → 미니맥스 API 키 1회 입력
```

- **11 agents** + **54+ hooks** + **5 MCPs** (context7, codegraph 등)
- **공식 카탈로그**: [github.com/code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

### 3) toss-trader에서 OpenCode의 역할

| 차원 | Vercel (사용자 분석) | OpenCode (오빠 코딩) |
|---|---|---|
| LLM 호출 | ❌ 코드 0줄 | ⭕ 오빠 PC TUI/exec |
| 모델 | — | 미니맥스 M3 (글로벌 디폴트) |
| 목적 | — | Next.js 컴포넌트/로직 자동 생성 |
| 시크릿 | Vercel env (Notion, Telegram만) | `~/.config/opencode/opencode.json` 또는 `/connect` |

> v0.3 단순화: "Vercel에서 LLM 호출" 행 자체가 ❌. 토스 Open API relay + Notion 기록 + Telegram 알림만.

## 📂 프로젝트 구조

```
toss-trader/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 메인 대시보드 (시세/잔고/매수/매도)
│   └── api/
│       ├── toss/route.ts         # 토스 Open API relay (시세/잔고)
│       ├── notion/route.ts       # Notion DB 이력
│       └── telegram/route.ts     # Telegram inline button
├── components/
│   ├── Portfolio.tsx             # 보유 종목 / 손익
│   └── OrderButton.tsx           # BUY/SELL + DRY_RUN 토글
├── lib/
│   ├── toss.ts                   # 토스 Open API 클라이언트
│   ├── notion.ts                 # Notion DB 기록
│   ├── telegram.ts               # Telegram Bot API
│   └── safety.ts                 # 5대 가드
├── schemas/
│   └── recommendation.schema.json
├── docs/
│   ├── ARCHITECTURE.md           # v0.3 정식 문서
│   ├── OPENAPI_REFERENCE.md      # 토스 API v1.1.5 레퍼런스
│   ├── SAFETY.md                 # (예정)
│   └── NOTION_SETUP.md           # (예정)
├── .env.example                  # Vercel env 예시 (Notion/Telegram만)
├── next.config.ts
├── package.json
├── tsconfig.json
├── AGENTS.md
├── README.md
├── LICENSE
└── .gitignore
```

> v0.3에서 제거된 것: `app/settings/`, `app/api/llm/`, `lib/llm/`, `components/SettingsForm.tsx`, `components/ChatPanel.tsx`. LLM provider 라우터 0줄.

## 🎨 디자인 결정

### 원본 (kstost/stock) 대비 변경점

| 차원 | 원본 (kstost) | 우리 (v0.3) |
|---|---|---|
| UI | Next.js + Vercel | ✅ Next.js + Vercel (동일) |
| LLM | Codex CLI 단일 | ❌ toss-trader 코드 0줄 (= OpenCode 글로벌) |
| LLM 호출 | `child_process.spawn('codex')` | ❌ Vercel에서 호출 없음. 오빠 PC의 OpenCode |
| 시크릿 | Next.js 서버 메모리 | 오빠 PC `~/.hermes/secrets/` (chmod 600) |
| 주문 실행 | 화면 버튼 즉시 | Telegram inline button + 사용자 확인 |
| 안전장치 | prompt 차원 | `safety.ts` 가드 5종 + 422 자동 처리 |
| Paper trading | ❌ 없음 | ✅ 기본값 (`DRY_RUN=true`) |
| 미니맥스 | ❌ 미사용 | ⭕ OpenCode 글로벌 디폴트 |

### 5대 안전 가드 (safety.ts)

1. `DRY_RUN=true` 기본값 — 토스 주문 endpoint 완전 차단
2. 토스 422 `account-restricted` / `prerequisite-required` 자동 안내
3. `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder
4. Telegram inline button = 사용자 마지막 confirm
5. 토큰 길이/형식 검증 (실패 → 안전 기본값)

### paper trading 우선 철학

실계좌 주문은 **비가역 (irreversible)** 입니다. 한 번 체결된 주문은 시장가로만 청산 가능하며, 잘못된 행동지침 한 줄이 수백만 원 손실로 이어질 수 있습니다. 따라서:

- 모든 분석은 **paper** 모드에서 검증
- 실계좌 모드 진입은 Telegram 사용자 confirm 명시
- Telegram inline button이 사용자 마지막 확인

## 🧠 동작 원리

```text
사용자 (브라우저)
    ↓
[1] 메인 대시보드: 종목 선택 + "분석" 클릭
    ↓
[2] app/api/toss/route.ts: 토스 Open API 호출 (오빠 PC 토큰)
    ├─ 시세/잔고/계좌 조회 (GET only, 주문 endpoint 차단)
    └─ 응답: TossApiResponse
    ↓
[3] LLM 분석 (오빠 PC OpenCode가 처리, 사용자는 결과만 받음)
    ↓
[4] BUY/SELL 클릭
    ├─ DRY_RUN=true → paper 시뮬레이션
    ├─ DRY_RUN=false → app/api/telegram/route.ts → Telegram inline button 발송
    ↓
[5] 사용자 Telegram 확인 → /api/toss/route.ts (POST /api/v1/orders)
    ├─ 422 가드 (account-restricted / prerequisite-required / confirm-high-value-required)
    └─ 체결 응답
    ↓
[6] app/api/notion/route.ts: Notion DB 기록
```

> **상세 아키텍처 + 안전 가드**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> **상세 토스 Open API 레퍼런스**: [`docs/OPENAPI_REFERENCE.md`](docs/OPENAPI_REFERENCE.md)

## 🔬 검증

- [ ] `npm run build` 0 에러
- [ ] `npm run test` 0 실패
- [ ] `safety.ts` dry-run 가드 — `DRY_RUN=true`에서 주문 endpoint 호출 0회
- [ ] 토큰 길이 검증 — `tossinvest.env` chmod 600 + 길이 검증
- [ ] LLM 호출 0줄 — `grep -rn "openai\|nim\|anthropic" lib/ app/ components/` 모두 0건 (Vercel 코드)
- [ ] 토스 422 가드 — 5종 코드 자동 인식 + 사용자 안내
- [ ] Telegram inline button — 사용자 confirm 없이 실행 0회

## 📝 프롬프트 이력

- **v0.0 (2026-07-09)**: kstost/stock 영감 + 우리 스택 1차 스캐폴드
- **v0.1 (2026-07-09)**: docs/OPENAPI_REFERENCE.md 정식 문서 (URL + 발급 + 422 + rate limit)
- **v0.2 (2026-07-09)**: 아키텍처 결정 — Next.js + Vercel + BYOK + 다중 LLM (NIM/미니맥스/OpenAI) + Codex 미니맥스 공식 지원 활용
- **v0.3 (2026-07-09)**: 개발 도구 통합 — Codex CLI 0.143.0 + LazyCodex v4.16.0 (oh-my-openagent Codex 통합) 설치 및 README 반영
- **v0.4 (2026-07-10)**: 단순화 — Codex → OpenCode + oh-my-opencode로 전환. LLM provider 라우터/BYOK 폼/SettingsForm 모두 제거. LLM 호출 0줄, 모델 = OpenCode 글로벌 디폴트(미니맥스 M3) 단일. docs 3종(AGENTS/README/ARCHITECTURE) v0.3 갱신.

## 🤝 원본 크레딧

- 원본: [kstost/stock](https://github.com/kstost/stock) (MIT License, 2026) — Next.js 15 + Codex CLI + Tossinvest Open API
- [OpenCode 공식](https://opencode.ai/docs) — TUI/exec 에이전트
- [oh-my-opencode (code-yeongyu)](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인 (11 agents, 54+ hooks, 5 MCPs)
- [NIM 키 발급 직행 URL](https://build.nvidia.com/settings/api-keys) — 미니맥스 등 NIM 모델 키 발급 (핸드폰 인증 필요)

## 📜 License

MIT — 원본 kstost/stock과 동일
