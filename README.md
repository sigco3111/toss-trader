# 🤖 toss-trader

> 토스증권 Open API + 다중 LLM (NIM/미니맥스/OpenAI) 기반 투자 어시스턴트
> **BYOK 시크릿 격리 + paper trading 우선, 실계좌는 명시적 사용자 확인 후**

[kstost/stock](https://github.com/kstost/stock)에서 영감을 받아 **원본과 같은 Next.js + Vercel 구조**로 재설계한 버전입니다.
자세한 아키텍처는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참조.

## 🎬 라이브 데모

```text
Vercel 자동 배포 (예정) — https://toss-trader.vercel.app/
```

```
$ open https://toss-trader.vercel.app/
# → SettingsForm에 토스/NIM/OpenAI 키 1회 입력 (localStorage)
# → 대시보드에서 시세 조회, LLM 분석, BUY/SELL 시뮬레이션
```

## 🤖 생성 정보

- **기반**: [kstost/stock](https://github.com/kstost/stock) (MIT, kstost) — Next.js 15 + Codex CLI + 토스 Open API
- **재설계 사유**: 원본과 같은 Next.js 구조 채택 + 다중 LLM (Codex = NIM 경유로 미니맥스 등 공식 지원) + BYOK 시크릿 격리
- **분석 엔진**: LLM provider 라우터 (NIM / 미니맥스 / GLM-5 / GPT-OSS 120B / DeepSeek V4 Pro / Mistral / Nemotron / OpenAI)
- **대상**: sigco3111 + 토스증권 WTS 계좌 보유 일반 개인 (사업자등록증 무관)

## ✨ 주요 특징

- 🔒 **BYOK 시크릿 격리** — 토스/NIM/OpenAI 키는 브라우저 localStorage에만, Vercel env 0
- 📝 **Paper trading 기본값** — `DRY_RUN=true` 기본, 실계좌는 UI 토글 명시 후만 활성
- 🧠 **다중 LLM** — NIM 카탈로그 6종 (미니맥스 M2.7 / GLM-5 / GPT-OSS 120B / DeepSeek V4 Pro / Mistral / Nemotron) + OpenAI 옵션
- 💬 **Telegram confirm** — BUY/SELL은 Telegram inline button 사용자 명시 확인 후
- 🗂️ **Notion 이력** — 모든 분석/주문은 Notion DB 기록 (Vercel env 사용, 서버 측)
- 🛡️ **안전 가드 5종** — `safety.ts` (DRY_RUN + 422 가드 + confirmHighValueOrder + Telegram confirm + BYOK 입력 검증)

## 🚀 실행 방법

```bash
# 1) 의존성
npm install

# 2) Vercel env (서버 측 도구만)
#   NOTION_API_KEY, TELEGRAM_BOT_TOKEN
vercel env add NOTION_API_KEY
vercel env add TELEGRAM_BOT_TOKEN

# 3) Vercel 배포
vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)

# 4) 사용자: 브라우저로 접속 → SettingsForm에 4개 키 입력 (localStorage 영구)
#    - Toss API Key
#    - Toss Secret Key
#    - NIM/OpenAI/MiniMax API Key
#    - DRY_RUN toggle (기본 ON)
```

## 🎮 조작법

| 화면 | 동작 |
|---|---|
| `/` (메인) | 시세/잔고/이력 + LLM 분석 + BUY/SELL 버튼 |
| `/settings` | BYOK 폼 (4개 키 입력/수정) |
| `BUY` 버튼 클릭 | Telegram confirm → 안전 가드 5종 통과 → 토스 주문 (DRY_RUN=false 시) |

## 🛠️ 기술 스택

- **프레임워크**: Next.js 15 (App Router) + TypeScript + Tailwind
- **LLM SDK**: `openai` (OpenAI 호환 — NIM, OpenAI, Mistral 모두)
- **시크릿**: localStorage (BYOK)
- **Vercel env**: Notion API, Telegram Bot (서버 측 도구만)
- **이력**: Notion DB (`toss-trader` database)
- **알림**: Telegram Bot API (inline keyboard)
- **테스트**: `vitest` + MSW (HTTP mock)

## 📂 프로젝트 구조

```
toss-trader/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 메인 대시보드
│   ├── settings/page.tsx         # BYOK 폼
│   └── api/
│       ├── llm/route.ts          # LLM provider 라우터
│       ├── llm/nim/route.ts      # NIM (미니맥스/GLM-5/...)
│       ├── llm/openai/route.ts
│       ├── toss/route.ts         # 토스 Open API relay
│       ├── notion/route.ts
│       └── telegram/route.ts
├── components/
│   ├── ChatPanel.tsx
│   ├── Portfolio.tsx
│   ├── OrderButton.tsx
│   └── SettingsForm.tsx          # BYOK localStorage 폼
├── lib/
│   ├── llm/
│   │   ├── router.ts             # provider 라우팅
│   │   ├── nim.ts
│   │   ├── openai.ts
│   │   └── anthropic.ts          # (선택)
│   ├── toss.ts
│   ├── notion.ts
│   ├── telegram.ts
│   └── safety.ts                 # 5대 가드
├── schemas/
│   └── recommendation.schema.json
├── docs/
│   ├── ARCHITECTURE.md           # 2차 스캐폴드 정식 문서
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

## 🎨 디자인 결정

### 원본 (kstost/stock) 대비 변경점

| 차원 | 원본 (kstost) | 우리 (v0.2) |
|---|---|---|
| UI | Next.js + Vercel | ✅ Next.js + Vercel (동일) |
| LLM | Codex CLI 단일 + `--yolo --ephemeral` | LLM provider 라우터 (NIM 카탈로그 6종 + OpenAI) |
| LLM 호출 | `child_process.spawn('codex')` | Vercel Edge Function HTTP 호출 |
| 시크릿 | Next.js 서버 메모리 | BYOK localStorage (영구) |
| 주문 실행 | 화면 버튼 즉시 | Telegram inline button + 사용자 확인 |
| 안전장치 | prompt 차원 | `safety.ts` 가드 5종 + 422 자동 처리 |
| Paper trading | ❌ 없음 | ✅ 기본값 (`DRY_RUN=true`) |
| Codex 미니맥스 | ❌ 미사용 | ⭕ NIM 카탈로그로 미니맥스 M2.7 지원 |

### 5대 안전 가드 (safety.ts)

1. `DRY_RUN=true` 기본값 — 토스 주문 endpoint 완전 차단
2. 토스 422 `account-restricted` / `prerequisite-required` 자동 안내
3. `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder
4. Telegram inline button = 사용자 마지막 confirm
5. BYOK 입력값 길이/형식 검증 (실패 → 안전 기본값)

### paper trading 우선 철학

실계좌 주문은 **비가역 (irreversible)** 입니다. 한 번 체결된 주문은 시장가로만 청산 가능하며, 잘못된 행동지침 한 줄이 수백만 원 손실로 이어질 수 있습니다. 따라서:

- 모든 분석은 **paper** 모드에서 검증
- 실계좌 모드 진입은 UI 토글 + 사용자 confirm 명시
- Telegram inline button이 사용자 마지막 확인

### LLM 다중 프로바이더 선택 기준

| 시나리오 | 추천 |
|---|---|
| 빠른 시그널, 무료 | `openai/gpt-oss-120b` (NIM) |
| 한국어/중국 시장 분석 | `MiniMax/MiniMax-M2.7` (NIM) |
| 깊은 추론, 코딩 | `deepseek-ai/DeepSeek-V4-Pro` (NIM) |
| 다국어/유럽 시장 | `mistralai/Mistral-Large-3` (NIM) |
| OpenAI 호환 표준 | `gpt-5.x` (OpenAI) |
| Claude 특화 추론 | `claude-sonnet-4.6` (Anthropic, 선택) |

## 🧠 동작 원리

```text
사용자 (브라우저)
    ↓
[1] settings/page.tsx: BYOK 폼 → localStorage에 4개 키 저장
    ↓
[2] 메인 대시보드: 종목 선택 + "분석" 클릭
    ↓
[3] app/api/toss/route.ts: 토스 Open API 호출 (BYOK 토큰)
    ├─ 시세/잔고/계좌 조회 (GET only, 주문 endpoint 차단)
    └─ 응답: TossApiResponse
    ↓
[4] app/api/llm/route.ts: provider 라우터
    ├─ provider 선택 (UI 드롭다운)
    ├─ BYOK 토큰 (localStorage)
    ├─ nim.ts / openai.ts / anthropic.ts: provider별 HTTP 호출
    └─ 응답: StreamingResponse (SSE)
    ↓
[5] components/ChatPanel.tsx: LLM 분석 표시 (BUY/SELL/HOLD)
    ↓
[6] BUY/SELL 클릭
    ├─ DRY_RUN=true → paper 시뮬레이션
    ├─ DRY_RUN=false → app/api/telegram/route.ts → Telegram inline button 발송
    ↓
[7] 사용자 Telegram 확인 → /api/toss/route.ts (POST /api/v1/orders)
    ├─ 422 가드 (account-restricted / prerequisite-required / confirm-high-value-required)
    └─ 체결 응답
    ↓
[8] app/api/notion/route.ts: Notion DB 기록
```

> **상세 아키텍처 + LLM provider 매트릭스 + 안전 가드**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> **상세 토스 Open API 레퍼런스**: [`docs/OPENAPI_REFERENCE.md`](docs/OPENAPI_REFERENCE.md)

## 🔬 검증

- [ ] `npm run build` 0 에러
- [ ] `npm run test` 0 실패
- [ ] `safety.ts` dry-run 가드 — `DRY_RUN=true`에서 주문 endpoint 호출 0회
- [ ] BYOK localStorage 영구성 — 페이지 reload 후에도 키 보존
- [ ] LLM provider 라우터 — 6종 provider 모두 정상 호출
- [ ] 토스 422 가드 — 5종 코드 자동 인식 + 사용자 안내
- [ ] Telegram inline button — 사용자 confirm 없이 실행 0회

## 📝 프롬프트 이력

- **v0.0 (2026-07-09)**: kstost/stock 영감 + 우리 스택 (Python + oh-my-opencode + CLI + Telegram) 1차 스캐폴드
- **v0.1 (2026-07-09)**: docs/OPENAPI_REFERENCE.md 정식 문서 (URL + 발급 + 422 + rate limit)
- **v0.2 (2026-07-09)**: 아키텍처 결정 — Next.js + Vercel + BYOK + 다중 LLM (NIM/미니맥스/OpenAI) + Codex 미니맥스 공식 지원 활용

## 🤝 원본 크레딧

- 원본: [kstost/stock](https://github.com/kstost/stock) (MIT License, 2026) — Next.js 15 + Codex CLI + Tossinvest Open API
- LLM provider 카탈로그: [openai/plugins/nvidia](https://github.com/openai/plugins/tree/main/plugins/nvidia) (NVIDIA 공식 Codex 플러그인, 미니맥스 M2.7 등 6종)
- OpenAI Codex docs: [developers.openai.com/codex](https://developers.openai.com/codex)

## 📜 License

MIT — 원본 kstost/stock과 동일
