# 🏗️ toss-trader 아키텍처

> 2026-07-10 v0.3 결정: **단순화 — LLM 호출 0줄, 모델 = OpenCode 글로벌 디폴트**.
> 1차 스캐폴드 (CLI + Telegram) → 2차 스캐폴드 (Next.js + Vercel + BYOK + 다중 LLM) → **3차 (현재): BYOK 폼 / LLM provider 라우터 / ChatPanel 제거**. toss-trader는 토스 Open API relay + Notion 기록 + Telegram 알림만 담당.

## 🌐 전체 구조

```
사용자 브라우저 (sigco3111)
    ↓ HTTPS
[Vercel — Next.js 15 (App Router)]
    ├── app/page.tsx            # 메인 대시보드 (시세/잔고/매수/매도)
    ├── app/api/
    │   ├── toss/route.ts       # 토스 Open API relay (CORS 우회)
    │   ├── notion/route.ts     # Notion DB 기록
    │   └── telegram/route.ts   # Telegram inline button 발송
    ├── components/
    │   ├── Portfolio.tsx       # 보유 종목 / 손익
    │   └── OrderButton.tsx     # BUY/SELL + DRY_RUN 토글
    ├── lib/
    │   ├── toss.ts             # 토스 Open API 클라이언트
    │   ├── notion.ts
    │   ├── telegram.ts
    │   └── safety.ts           # 5대 가드 (DRY_RUN + 422 + confirm)
    └── styles/

Toss Open API (openapi.tossinvest.com)        ← 오빠 PC의 ~/.hermes/secrets/tossinvest.env
Notion API                                   ← Vercel env (서버 side)
Telegram Bot API                             ← Vercel env (서버 side)

오빠 PC (개발 환경 — Vercel과 분리)
    ↓
[OpenCode + oh-my-opencode]
    └─ 글로벌 디폴트 모델: minimax/MiniMax-M3
       (오빠가 모델 변경 시 opencode.json의 model 필드만 수정)
```

> **v0.3 핵심**: Vercel에서 LLM 호출 0건. BYOK 폼 0. LLM provider 라우터 0. ChatPanel 0.

## 🔑 시크릿 격리 (v0.3 단순화)

| 항목 | 결정 |
|---|---|
| **Toss client_id/secret** | 오빠 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600) |
| **toss-trader 코드 내 보관** | ❌ 0. `app/api/toss/route.ts` 호출 시 헤더 주입 (런타임 env 또는 fetch 옵션) |
| **Vercel env 가능** | ✅ Notion API key, Telegram bot token (서버 측 도구용) |
| **Vercel env 금지** | ❌ Toss/NIM/OpenAI 토큰 (v0.2에서 BYOK로 Vercel 회피 → v0.3에서 toss-trader 코드 자체에서 제거) |
| **모델 변경 경로** | 오빠 PC의 `~/.config/opencode/opencode.json`의 `model` 필드 (toss-trader 무관) |

### 토큰 흐름

```text
[1] 오빠: WTS 로그인 → client_id/secret 발급 → 토스 Open API 콘솔에서 직접
[2] 오빠: ~/.hermes/secrets/tossinvest.env에 저장 (chmod 600)
[3] Vercel 배포: toss-trader 코드는 토큰을 모름. toss API 호출 시 환경변수 또는 fetch 옵션으로 주입
[4] 사용자: 브라우저로 toss-trader 대시보드 접속 → 시세/매수/매도 (paper 기본)
```

## 🧠 LLM 단일 모델 (v0.3)

| Provider | base URL | 디폴트 모델 | 비고 |
|---|---|---|---|
| **minimax** (OpenCode 글로벌) | `https://api.minimax.io/anthropic` (Anthropic 호환) | `minimax/MiniMax-M3` | OpenCode `~/.config/opencode/opencode.json`의 `model` 필드 |

> **모델 변경 방법 (오빠만)**: `~/.config/opencode/opencode.json`의 `model` 필드 수정 또는 `opencode -m <model>` 임시 변경. toss-trader 코드 0줄 영향.

## 🛡️ 안전 가드 (5가지)

| # | 가드 | 위치 |
|---|---|---|
| 1 | `DRY_RUN=true` 기본값 (Toss 주문 endpoint 완전 차단) | `lib/safety.ts` |
| 2 | 토스 422 `account-restricted` / `prerequisite-required` 자동 안내 | `lib/safety.ts` |
| 3 | `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder | `lib/safety.ts` |
| 4 | Telegram inline button = 사용자 마지막 confirm | `app/api/telegram/route.ts` |
| 5 | 토큰 길이/형식 검증 (실패 → 안전 기본값) | `lib/safety.ts` |

## 📂 디렉토리 구조 (v0.3)

```
toss-trader/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── toss/route.ts
│       ├── notion/route.ts
│       └── telegram/route.ts
├── components/
│   ├── Portfolio.tsx
│   └── OrderButton.tsx
├── lib/
│   ├── toss.ts
│   ├── notion.ts
│   ├── telegram.ts
│   └── safety.ts
├── schemas/
│   └── recommendation.schema.json
├── docs/
│   ├── ARCHITECTURE.md        ← 본 문서 (v0.3)
│   ├── OPENAPI_REFERENCE.md   ← v0.1
│   ├── SAFETY.md              ← (예정) 5대 가드 + 422 매트릭스
│   └── NOTION_SETUP.md        ← (예정)
├── .env.example               # Vercel env 예시 (Notion/Telegram만)
├── next.config.ts
├── package.json
├── tsconfig.json
├── AGENTS.md
├── README.md
├── LICENSE
└── .gitignore
```

## 🚦 배포 워크플로

1. **Vercel connect** — `https://github.com/sigco3111/toss-trader`
2. **Vercel env** — `NOTION_API_KEY`, `TELEGRAM_BOT_TOKEN` (서버 측만)
3. **Vercel deploy** — 자동 preview → `--prod`
4. **사용자 진입** — Vercel URL → 메인 대시보드 (paper 기본)
5. **첫 분석** — toss-trader는 toss Open API 데이터만 제공. LLM 분석은 오빠 PC의 OpenCode가 처리 (필요 시)

## 📝 출처

- **원본**: [kstost/stock](https://github.com/kstost/stock) (MIT, 2026) — Next.js 15 + Codex CLI + Toss Open API
- **OpenCode 공식**: [opencode.ai/docs](https://opencode.ai/docs) — TUI/exec 에이전트
- **oh-my-opencode**: [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인
- **NIM 카탈로그**: [build.nvidia.com](https://build.nvidia.com) — 미니맥스 등 모델 키 발급
- **토스 Open API**: [docs/OPENAPI_REFERENCE.md](OPENAPI_REFERENCE.md)
- **시크릿 격리 정책**: 메모리 §"kakao-timeline 보안 교훈" (2026-07-09) — 메신저 평문 노출만 금지
