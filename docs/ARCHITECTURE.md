# 🏗️ toss-trader 아키텍처

> 2026-07-09 v0.2 결정: **원본 (kstost/stock) 패턴 = Next.js + Vercel 웹 대시보드** 채택.
> 1차 스캐폴드 (CLI + Telegram) → 2차 스캐폴드 (Next.js + Vercel + BYOK)로 **대대적 갱신**.

## 🌐 전체 구조

```
사용자 브라우저 (sigco3111)
    ↓ HTTPS
[Vercel — Next.js 15 (App Router)]
    ├── app/page.tsx            # 메인 대시보드 (시세/잔고/주문/이력)
    ├── app/settings/page.tsx   # BYOK 폼 (Toss/NIM/MiniMax/OpenAI 토큰)
    ├── app/api/
    │   ├── llm/route.ts        # LLM provider 라우터 (provider별 분기)
    │   ├── llm/nim/route.ts    # NIM (MiniMax M2.7, GLM-5, GPT-OSS 120B, DeepSeek V4 Pro, Mistral, Nemotron)
    │   ├── llm/openai/route.ts # OpenAI
    │   ├── llm/anthropic/route.ts # (선택)
    │   ├── toss/route.ts       # 토스 Open API relay (CORS 우회)
    │   ├── notion/route.ts     # Notion DB 기록
    │   └── telegram/route.ts   # Telegram inline button 발송
    ├── components/
    │   ├── ChatPanel.tsx       # LLM 대화 (provider 선택 드롭다운)
    │   ├── Portfolio.tsx       # 보유 종목 / 손익
    │   ├── OrderButton.tsx     # BUY/SELL + DRY_RUN 토글
    │   └── SettingsForm.tsx    # BYOK 폼 (localStorage)
    ├── lib/
    │   ├── llm/
    │   │   ├── router.ts       # provider 라우팅 + BYOK 토큰 처리
    │   │   ├── nim.ts          # NIM OpenAI 호환 호출
    │   │   ├── openai.ts
    │   │   └── anthropic.ts
    │   ├── toss.ts             # 토스 Open API 클라이언트
    │   ├── notion.ts
    │   ├── telegram.ts
    │   └── safety.ts           # DRY_RUN 가드 + 422 가드
    └── styles/

Toss Open API (openapi.tossinvest.com)        ← BYOK 토큰
NIM (integrate.api.nvidia.com)               ← BYOK 토큰
OpenAI (api.openai.com)                      ← BYOK 토큰
Notion API                                   ← Vercel env (서버 side)
Telegram Bot API                             ← Vercel env (서버 side)
```

## 🔑 BYOK (Bring Your Own Key) — 시크릿 격리

| 항목 | 결정 |
|---|---|
| **저장소** | 브라우저 `localStorage` (영구) |
| **마감** | 없음 (사용자가 직접 clear) |
| **XSS 위험** | 사용자가 수용 (메모리 §"kakao-timeline 보안 교훈" — 메신저 평문 노출 금지만 절대) |
| **Vercel env** | ❌ Toss/NIM/OpenAI 토큰 박지 않음 |
| **Vercel env 가능** | ✅ Notion API key, Telegram bot token (서버 측 도구용) |

### 4단계 BYOK 흐름

```text
[1] 사용자: WTS 로그인 → client_id/secret 발급 → 토스 Open API 콘솔에서 직접
[2] 사용자: NIM/MiniMax/OpenAI API 콘솔에서 직접 API 키 발급
[3] 사용자: toss-trader UI 첫 진입 → SettingsForm에 4개 키 입력 → localStorage 저장
[4] 사용자: 매 요청 시 헤더에 X-User-Token 첨부 (XSS 안전 위해 메모리만)
```

### 키 입력 폼 (4개 슬롯)

```text
Toss API Key      : _______________  (client_id)
Toss Secret Key   : _______________  (client_secret)
NIM/OpenAI/MiniMax API Key  : _______________
DRY_RUN toggle    : [ ON | OFF ]   (기본 ON)
```

## 🧠 LLM Provider 라우터

### 지원 Provider (2026-07-09)

| Provider | base URL | 모델 | 비고 |
|---|---|---|---|
| **NIM** | `https://integrate.api.nvidia.com/v1` | `openai/gpt-oss-120b` (기본) | 무료, OpenAI 호환 |
| | | `MiniMax/MiniMax-M2.7` (미니맥스 M2.7) | NVIDIA 카탈로그 |
| | | `openai/glm-5` (GLM-5) | NVIDIA 카탈로그 |
| | | `deepseek-ai/DeepSeek-V4-Pro` | NVIDIA 카탈로그 |
| | | `mistralai/Mistral-Large-3` | NVIDIA 카탈로그 |
| | | `nvidia/Nemotron-3-Super-120B` | NVIDIA 카탈로그 |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-5.x` | 유료 |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-sonnet-4.6` | (선택) |
| **Codex (선택)** | 로컬 CLI | `bunx oh-my-opencode` | Vercel에서 ❌, 사용자 PC |

### 라우팅 결정 흐름

```text
[1] UI에서 user 선택 provider
[2] router.ts: BYOK 토큰 localStorage에서 로드
[3] nim.ts/openai.ts/anthropic.ts: provider별 base URL + headers
[4] OpenAI 호환: NIM, OpenAI, Mistral (NVIDIA 위) → /chat/completions
[5] Anthropic: /v1/messages (별도 형식)
[6] 응답: SSE 스트림으로 UI에 표시
```

## 🛡️ 안전 가드 (5가지)

| # | 가드 | 위치 |
|---|---|---|
| 1 | `DRY_RUN=true` 기본값 (Toss 주문 endpoint 완전 차단) | `lib/safety.ts` |
| 2 | 토스 422 `account-restricted` / `prerequisite-required` 자동 안내 | `lib/safety.ts` |
| 3 | `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder | `lib/safety.ts` |
| 4 | Telegram inline button = 사용자 마지막 confirm | `app/api/telegram/route.ts` |
| 5 | BYOK 입력값 길이/형식 검증 (실패 → 안전 기본값) | `components/SettingsForm.tsx` |

## 📂 디렉토리 구조 (2차 스캐폴드)

```
toss-trader/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── llm/route.ts
│       ├── llm/nim/route.ts
│       ├── llm/openai/route.ts
│       ├── toss/route.ts
│       ├── notion/route.ts
│       └── telegram/route.ts
├── components/
│   ├── ChatPanel.tsx
│   ├── Portfolio.tsx
│   ├── OrderButton.tsx
│   └── SettingsForm.tsx
├── lib/
│   ├── llm/
│   │   ├── router.ts
│   │   ├── nim.ts
│   │   ├── openai.ts
│   │   └── anthropic.ts
│   ├── toss.ts
│   ├── notion.ts
│   ├── telegram.ts
│   └── safety.ts
├── schemas/
│   └── recommendation.schema.json
├── docs/
│   ├── ARCHITECTURE.md        ← 본 문서
│   ├── OPENAPI_REFERENCE.md   ← v0.1에서 이관
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
4. **사용자 진입** — Vercel URL → SettingsForm BYOK 입력 → localStorage 저장
5. **첫 분석** — `/api/toss/route.ts` → Toss Open API (BYOK 토큰) → NIM 분석 → 응답

## 📝 출처

- **원본**: [kstost/stock](https://github.com/kstost/stock) (MIT, 2026) — Next.js 15 + Codex CLI + Toss Open API
- **Codex 미니맥스 공식 지원**: [openai/plugins/nvidia](https://github.com/openai/plugins/tree/main/plugins/nvidia) (NVIDIA 공식 Codex 플러그인, 미니맥스 M2.7 카탈로그)
- **OpenAI Codex config**: [config-reference](https://developers.openai.com/codex/config-reference) (`model_providers.<id>` 패턴)
- **토스 Open API**: [docs/OPENAPI_REFERENCE.md](OPENAPI_REFERENCE.md)
- **BYOK 패턴**: 메모리 §"BYOK 게임 세션" (2026-07-07)
- **시크릿 격리 정책**: 메모리 §"kakao-timeline 보안 교훈" (2026-07-09) — 메신저 평문 노출만 금지
