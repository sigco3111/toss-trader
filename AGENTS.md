# AGENTS.md — 다른 PC 에이전트용 작업 가이드

> ⚠️ **Next.js 16 (2026-07-10 보일러플레이트 검증)**: `create-next-app@latest` 결과 = `next@16.2.10` + `react@19.2.4` + `tailwind@4`. Next 15와 API/관례/파일 구조가 다를 수 있음. `node_modules/next/dist/docs/`의 가이드 우선 참조 + deprecation 경고 주의.

## 프로젝트 한 줄 요약

토스증권 Open API 기반 투자 어시스턴트.
**Next.js 15 + Vercel + paper trading 기본값**. LLM 분석은 **개발자(오빠) PC의 OpenCode 글로벌 디폴트 모델(= 미니맥스 M3)** 한 가지로 단일화. 원본 [kstost/stock](https://github.com/kstost/stock) 패턴을 우리 스택으로 재설계.

> v0.4 단순화 (2026-07-10): **Notion 이력 제거**, **kstost/stock 원본 history.ts 방식** 채택 (로컬 JSON). Vercel serverless filesystem 제약 + kstost 호환성. `app/api/notion/` + `lib/notion.ts` + `docs/NOTION_SETUP.md` 삭제, `lib/history.ts` + `lib/types.ts` + `app/api/history/route.ts` + `history/` 디렉토리 신규.
> v0.3 단순화: 사용자 분석 환경에서 다중 LLM provider 라우터 / BYOK localStorage 폼 제거. LLM 호출 = 오빠 PC의 OpenCode에서만. **사용자가 모델을 바꾸고 싶으면 OpenCode 설정(`~/.config/opencode/opencode.json`)을 직접 수정.** 우리 프로젝트는 모델 설정 코드 0줄.

자세한 아키텍처 = [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 디렉토리 구조 (v0.4)

```
toss-trader/
├── app/                         # Next.js 15 App Router
│   ├── page.tsx                 # 메인 대시보드 (시세/잔고/매수/매도)
│   ├── layout.tsx
│   └── api/
│       ├── toss/[...path]/route.ts    # 토스 Open API catch-all relay
│       ├── telegram/send/route.ts     # 주문 confirm 발송
│       ├── telegram/callback/route.ts # Telegram webhook → 콜백 매칭
│       └── history/route.ts           # 6단계: history GET/POST (kstost 방식)
├── components/                  # React UI
│   ├── Portfolio.tsx            # 5단계: 보유 종목 + 손익
│   └── OrderButton.tsx          # 4단계: 매수/매도 + Telegram confirm
├── lib/                         # 서버 측 비즈니스 로직
│   ├── toss.ts                  # 2단계: 토스 Open API 클라이언트
│   ├── safety.ts                # 3단계: 6대 가드
│   ├── telegram.ts              # 4단계: Telegram confirm
│   ├── history.ts               # 6단계: kstost 방식 JSON 기록
│   ├── types.ts                 # 6단계: HistoryRecord 등
│   └── format.ts                # 5단계: KRW/손익 포맷
├── history/                     # 6단계: 1 record = 1 JSON 파일
│   └── .gitkeep                 # (history/*.json은 .gitignore)
├── docs/
│   ├── README.md                  ← 본 문서 (인덱스)
│   ├── ARCHITECTURE.md            ← v0.4 정식
│   ├── OPENAPI_REFERENCE.md       ← v0.1
│   ├── SAFETY.md                  ← (예정)
│   └── raw/                       ← (로컬 전용, .gitignore 무시) 토스 Open API 1차 자료 캐시
│       ├── README.md              ← raw/ 안내
│       └── toss-api-research-2026-07-09/  ← 34개 파일, 1.0MB
├── AGENTS.md                    # 이 파일
├── README.md
├── LICENSE
└── .gitignore
```

> v0.4에서 **삭제**: `app/api/notion/`, `lib/notion.ts`, `docs/NOTION_SETUP.md`, `@notionhq/client` 의존성
> v0.3에서 **삭제**: `app/settings/`, `app/api/llm/`, `lib/llm/`, `components/SettingsForm.tsx`, `components/ChatPanel.tsx`

## 절대 어기지 말 것 (Red Lines)

1. **시크릿 평문 노출 금지** — 토스/NIM/OpenAI 토큰을 Vercel env에 박지 마. Vercel env는 **서버 측 도구(Telegram만) — v0.4에서 Notion 제거됨**.
2. **메신저 평문 전송 절대 금지** — Telegram 메시지에 토큰/API key 직접 노출 ❌. 토큰 회전 요청 시 토큰값 메시지 노출 금지, terminal 명령만 제시
3. **주문 endpoint 호출은 opt-in** — 기본값 = paper (`DRY_RUN=true`). `DRY_RUN=false` 명시 + Telegram 사용자 confirm 후에만 토스 Open API `POST /api/v1/orders` 등 호출
4. **사용자 행동지침 없으면 HOLD** — prompt의 안전 규칙으로 강제
5. **Vercel serverless 제약 인지** — `child_process.spawn` 등 외부 CLI 호출 ❌. HTTP 호출만 가능. **LLM 호출 0건 (오빠 PC의 OpenCode가 처리)**
6. **422 가드 자동 처리** — `account-restricted`, `prerequisite-required`, `confirm-high-value-required` (1억+) 자동 인식 + 사용자 안내
7. **v0.3 단순화 위반 금지** — BYOK 폼 / LLM provider 라우터 / 다중 provider 코드 추가하지 마. 모델 변경은 OpenCode 설정에서만.
8. **v0.4 단순화 위반 금지** — Notion 이력 / 외부 storage 자동화 추가하지 마. history는 kstost/stock 원본 (로컬 JSON).

## 핵심 기술 결정 (v0.4)

- **프레임워크**: Next.js 15 (App Router) + TypeScript + Tailwind
- **LLM 분석**: ❌ toss-trader 코드에 LLM 호출 0줄. **OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`)** 가 오빠 PC에서 모든 분석 처리
- **Vercel env**: Telegram Bot Token (서버 측 도구만). v0.4에서 Notion env 제거
- **Vercel 배포**: `vercel.json` (framework=nextjs, regions=[icn1], functions maxDuration=10) + 자동 GitHub push trigger
- **사용자 토큰 (Toss)**: 토스 Open API `client_id`/`secret` 만. Vercel env에 박지 않고 toss-trader 코드 내에서도 보관 안 함 — 사용자 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600) + `toss/route.ts` 호출 시 헤더 주입
- **이력 저장**: kstost/stock 원본 방식 (로컬 JSON, 1 record = 1 파일). Vercel에서 readonly 시 silent fail (next storage v0.5+ TODO)
- **알림**: Telegram Bot API (inline button)
- **검증**: `vitest` + MSW (HTTP mock)

## 의존성 (v0.4)

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "node-telegram-bot-api": "^0.66",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "typescript": "^5",
    "vitest": "^2",
    "msw": "^2"
  }
}
```

> v0.3에서 제거: `openai` npm (LLM 라우터 0줄).
> v0.4에서 제거: `@notionhq/client` (Notion 이력 제거).

## 작업 시작 체크리스트

다른 PC에서 이 repo를 받아 작업할 때:

```bash
# 1) 클론
git clone https://github.com/sigco3111/toss-trader.git
cd toss-trader

# 2) Node 의존성
npm install

# 3) (선택) OpenCode + oh-my-opencode 설치
brew install opencode
bunx oh-my-opencode@latest install --no-tui \
  --platform=opencode \
  --minimax-coding-plan=yes \
  --claude=no --gemini=no --copilot=no \
  --skip-auth
# TUI에서 /connect → 미니맥스 API 키 입력 (1회만)

# 4) 토스 Open API 키 (개발자 PC)
#    ~/.hermes/secrets/tossinvest.env (chmod 600)
#      TOSS_CLIENT_ID=...
#      TOSS_CLIENT_SECRET=...
#    WTS 로그인 → 설정 > Open API 메뉴에서 발급

# 5) Telegram Bot (선택, 미설정 시 dev fallback)
#    BotFather @BotFather → /newbot → 토큰 받기
#    ~/.hermes/secrets/telegram_bot_token.txt 저장
#    chat_id 본인 ID 확인 후 Vercel env 또는 .env

# 6) (구현 후) 테스트
npm run test

# 7) 로컬 dev
npm run dev  # http://localhost:3000
```

## 🛠️ 개발 도구 — OpenCode + oh-my-opencode

toss-trader는 **오빠 PC의 OpenCode + oh-my-opencode** 환경에서 개발합니다.

### 핵심 원칙 (v0.3 단순화)

> **모델 변경의 유일한 경로 = OpenCode 설정**. 우리 프로젝트는 모델 설정 코드 0줄.

오빠가 한 번 글로벌 디폴트를 미니맥스로 설정해두면, 모든 프로젝트(= toss-trader 포함)가 자동 적용. **사용자가 다른 모델로 바꾸고 싶으면 `~/.config/opencode/opencode.json`의 `model` 필드만 수정.**

### 1) OpenCode — TUI/exec 에이전트

```bash
brew install opencode
opencode                       # TUI 진입
opencode exec "..."            # 비대화형
```

- **글로벌 디폴트**: `~/.config/opencode/opencode.json`의 `model: "minimax/MiniMax-M3"`
- **공식 문서**: [opencode.ai/docs](https://opencode.ai/docs)

### 2) oh-my-opencode — OpenCode 플러그인

```bash
bunx oh-my-opencode@latest install --no-tui \
  --platform=opencode \
  --minimax-coding-plan=yes \
  --claude=no --gemini=no --copilot=no \
  --skip-auth
```

- **11 agents** + **54+ hooks** + **5 MCPs** (context7, codegraph 등)
- **공식 카탈로그**: [github.com/code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

### 3) toss-trader에서 OpenCode의 역할

| 차원 | Vercel (사용자 분석) | OpenCode (오빠 코딩) |
|---|---|---|
| LLM 호출 | ❌ 코드 0줄 | ⭕ 오빠 PC TUI/exec |
| 모델 | — | 미니맥스 M3 (글로벌 디폴트) |
| 목적 | — | Next.js 컴포넌트/로직 자동 생성 |
| 시크릿 | Vercel env (Telegram만) | `~/.config/opencode/opencode.json` 또는 `/connect` |

> v0.3 단순화: "Vercel에서 LLM 호출" 행 자체가 ❌. 토스 Open API relay + history + Telegram 알림만.

## LLM 단일 모델 (v0.3)

| Provider | base URL | 디폴트 모델 | 비고 |
|---|---|---|---|
| **minimax** | `https://api.minimax.io/anthropic` (Anthropic 호환) | `minimax/MiniMax-M3` | OpenCode `~/.config/opencode/opencode.json`의 `model` 필드 |

> 미니맥스 = NIM 카탈로그의 `MiniMax/MiniMax-M3` (NVIDIA build.nvidia.com/settings/api-keys).

## 막혔을 때

- 토스 Open API 스펙: [docs/OPENAPI_REFERENCE.md](docs/OPENAPI_REFERENCE.md)
- Next.js 15 App Router: [https://nextjs.org/docs/app](https://nextjs.org/docs/app)
- OpenCode 설정: [opencode.ai/docs](https://opencode.ai/docs)
- oh-my-opencode install: `bunx oh-my-opencode@latest install --help`
- NIM 키 발급 (직행): https://build.nvidia.com/settings/api-keys (핸드폰 인증 필요)
- 원본 Next.js 구현 참고: [kstost/stock](https://github.com/kstost/stock) (lib/tossinvest.ts + schemas/investment-agent-output.schema.json)

## 작업 위임 시 권장 (v0.4 순서)

- 1단계: Next.js 15 + TypeScript + Tailwind 보일러플레이트 셋업 ✅
- 2단계: `app/api/toss/[...path]/route.ts` 토스 Open API relay ✅
- 3단계: `lib/safety.ts` 6대 가드 + TDD ✅
- 4단계: `lib/telegram.ts` + `app/api/telegram/{send,callback}/route.ts` + `components/OrderButton.tsx` ✅
- 5단계: `components/Portfolio.tsx` + `lib/format.ts` + `app/page.tsx` v0.3 ✅
- 6단계: `lib/history.ts` + `lib/types.ts` + `app/api/history/route.ts` + `components/OrderButton.tsx` history write ✅
- **7단계: Vercel 배포** (vercel.json + .env.example) ✅
- 8단계: e2e 테스트 (Vercel preview URL)

각 단계마다 `npm run test` 그린 유지.

## 📚 참고 자료

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — v0.4 정식 아키텍처 (단순화: LLM 0줄, Notion 제거, kstost history)
- **[docs/OPENAPI_REFERENCE.md](docs/OPENAPI_REFERENCE.md)** — 토스증권 Open API v1.1.5 정식 레퍼런스
- [토스증권 WTS (키 발급)](https://www.tossinvest.com) — 로그인 후 설정 > Open API 메뉴
- [OpenCode 공식](https://opencode.ai/docs) — TUI/exec 에이전트
- [oh-my-opencode (code-yeongyu)](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인
- [NIM 키 발급 직행 URL](https://build.nvidia.com/settings/api-keys) — 미니맥스 등 NIM 모델 키 발급
- [kstost/stock](https://github.com/kstost/stock) — 원본 Next.js 구현 + `lib/history.ts` 패턴
