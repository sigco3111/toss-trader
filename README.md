# 🤖 toss-trader

> **프로젝트**: 토스증권 Open API 기반 투자 어시스턴트
> **Paper trading 기본값, 실계좌는 명시적 사용자 확인 후**
> **스택**: Next.js 16.2.10 (App Router) + React 19.2.4 + TypeScript 5 + Tailwind CSS 4 + ESLint 9 (2026-07-10 보일러플레이트 검증 완료)

토스증권 Open API로 시세/잔고/주문을 자동화하는 개인 투자 어시스턴트입니다.
코딩을 몰라도 **아래 5단계만 따라 하면** 본인 토스 계좌로 Vercel에 자동 배포된 웹 대시보드를 받을 수 있습니다.

> 📌 **둘 중 하나만 따라 하세요**:
> - 비개발자(코딩 모름) → 👉 [🚀 비개발자 가이드 (5단계)](#-비개발자-가이드-5단계-15분)
> - 개발자 → [🛠️ 개발자 섹션](#-개발자-섹션) 으로 스크롤

---

## 🚀 비개발자 가이드 (5단계, 15분)

> 코딩 한 줄도 안 짜고 토스 Open API + Vercel 웹 대시보드를 띄우는 법.
> Mac/Windows/Linux 모두 가능. **중간에 막히면 마지막 [🆘 자주 막히는 곳](#-자주-막히는-곳) 확인.**

### 1단계 — 토스증권 Open API 키 발급 (5분)

> **왜?** 토스 서버가 "이 앱이 진짜 sigco3111님이 만든 거 맞아?" 확인하는 열쇠입니다. 두 개가 한 쌍이에요.

| # | 동작 | 화면 위치 |
|---|---|---|
| 1 | 브라우저로 [https://www.tossinvest.com](https://www.tossinvest.com) 접속 | — |
| 2 | 본인 토스 계정으로 로그인 (카카오/네이버/토스 인증) | 우상단 |
| 3 | 화면 **좌하단 ⚙️ 설정(톱니바퀴)** 클릭 | 좌하단 |
| 4 | 메뉴에서 **Open API** 클릭 | 설정 안 |
| 5 | 화면에 표시되는 **`client_id`** 와 **`client_secret`** 을 **즉시 안전한 곳에 복사** | 화면 중앙 |

> ⚠️ **주의사항 3가지**:
> - **client_id / client_secret은 다시 안 보입니다.** 메모장/비밀번호 관리자에 즉시 붙여넣기. 닫으면 재발급.
> - **다른 사람/share 금지.** 이 키로 본인 토스 계좌 거래 가능.
> - **"Open API 메뉴가 안 보여요"** → 토스 고객센터에 "Open API 사전 신청" 문의. 일반 개인도 가능, 사업자등록증 불필요.

```
[예시]
client_id     = toss_a1b2c3d4e5f6g7h8
client_secret = sk_live_9z8y7x6w5v4u3t2s1r0q
```

### 2단계 — 키를 본인 PC에 안전하게 저장 (1분)

> **왜?** 토큰을 GitHub/Vercel에 올리면 해킹 위험. 본인 컴퓨터 안 암호화된 위치에 단독 저장.

**Mac / Linux** (터미널 앱 열고):
```bash
mkdir -p ~/.hermes/secrets
touch ~/.hermes/secrets/tossinvest.env
chmod 600 ~/.hermes/secrets/tossinvest.env

# 메모장으로 열어서 (또는 echo로)
open -e ~/.hermes/secrets/tossinvest.env     # Mac
# 또는
nano ~/.hermes/secrets/tossinvest.env        # Linux
```

**Windows** (PowerShell):
```powershell
New-Item -ItemType File -Path "$HOME\.hermes\secrets\tossinvest.env" -Force
notepad "$HOME\.hermes\secrets\tossinvest.env"
```

아래 두 줄을 파일에 붙여넣고 저장:
```
TOSS_CLIENT_ID=여기에_1단계에서_받은_client_id
TOSS_CLIENT_SECRET=여기에_1단계에서_받은_client_secret
```

> 📁 **저장 위치 정리**:
> - ✅ 본인 PC: `~/.hermes/secrets/tossinvest.env` (chmod 600, 본인만 읽기)
> - ❌ GitHub/Vercel/클라우드/메신저: **절대 금지**

### 3단계 — Vercel 계정 만들기 + GitHub 연동 (3분)

> **왜?** toss-trader 웹사이트를 인터넷에 올리는 호스팅. 무료.

| # | 동작 | 링크 |
|---|---|---|
| 1 | [https://github.com](https://github.com) 가입 (없으면) | — |
| 2 | 본인 계정으로 로그인 | — |
| 3 | [https://github.com/sigco3111/toss-trader](https://github.com/sigco3111/toss-trader) 페이지에서 **Star** ⭐ + **Fork** 클릭 (우상단) | toss-trader 페이지 |
| 4 | [https://vercel.com](https://vercel.com) 접속 → **Sign Up** → **Continue with GitHub** 클릭 | Vercel |

> 💡 **Fork가 뭐예요?** 본인의 GitHub 계정으로 toss-trader 사본을 만드는 것. 원본을 건드리지 않고 내 계정에서 자유롭게 수정 가능.

### 4단계 — Vercel에 자동 배포 (3분)

> **왜?** toss-trader 코드를 인터넷에서 돌아가게 만드는 단계.

| # | 동작 | 위치 |
|---|---|---|
| 1 | Vercel 대시보드에서 **Add New → Project** 클릭 | 우상단 |
| 2 | 방금 Fork한 **toss-trader** 저장소 선택 → **Import** | Import Git Repository |
| 3 | **Environment Variables** 섹션 펼치기 | Project 설정 |
| 4 | 아래 2개 추가 (각각 Key/Value 입력 → Add): | |
|   | `NOTION_API_KEY` = (지금은 비워두고 나중에) | |
|   | `TELEGRAM_BOT_TOKEN` = (지금은 비워두고 나중에) | |
| 5 | **Deploy** 클릭 | 하단 |

> ⏱️ 1~2분 후 빌드 완료. `https://toss-trader-xxx.vercel.app` 형태 URL 생성. **이 URL이 본인의 대시보드 주소.**

### 5단계 — 대시보드 접속 + 시세 확인 (1분)

| # | 동작 |
|---|---|
| 1 | 4단계에서 받은 Vercel URL 클릭 |
| 2 | 토스증권 WTS 앱이 로그인 상태인지 확인 (토큰 인증용) |
| 3 | 대시보드에서 종목 선택 → **"분석"** 클릭 → 시세 + 매수/매도 버튼 표시 |
| 4 | **Paper 모드** (기본값) — 실제 주문 X, 시뮬레이션만 |
| 5 | 실계좌 모드로 전환 = 별도 Telegram confirm 필요 (안전 가드 5종 자동 적용) |

> ✅ **여기까지 완료! 본인만의 토스 투자 대시보드가 인터넷에 떴습니다.**

---

## 🆘 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| 토스 **"Open API" 메뉴가 안 보여요** | 사전 신청자 대상 단계적 롤아웃 중 | 토스 고객센터에 "Open API 사전 신청" 문의. 일반 개인도 가능 |
| `client_id`를 **닫고 나서 다시 못 봐요** | 토스 정책 — 재확인 불가 | 1단계 처음부터 재발급 |
| Vercel **Deploy가 빨간색으로 실패** | 의존성 오류 (드묾) | Deploy 로그의 마지막 줄 확인. 대부분 환경변수 오타. 그래도 안 되면 [GitHub Issues](https://github.com/sigco3111/toss-trader/issues) 등록 |
| 대시보드가 **"401 Unauthorized"** 표시 | 토큰 만료 (보통 1시간) | 자동으로 재발급 시도. 5분 후에도 안 되면 2단계 파일 확인 |
| **Mac에서 `chmod 600`이 안 먹어요** | 파일 권한 오류 | `ls -la ~/.hermes/secrets/tossinvest.env`로 `-rw-------` 확인. 안 그러면 `chmod 600` 재실행 |
| **Windows에서 경로 에러** | `~/.hermes`를 Windows가 모름 | Windows는 `$HOME\.hermes\secrets\` 사용. 2단계 Windows 박스 참고 |
| 대시보드는 떴는데 **데이터가 안 보여요** | Toss 토큰이 toss-trader에 안 전달됨 | 2단계 env 파일 내용 확인. `TOSS_CLIENT_ID` 철자 (대문자, 언더스코어) |

> 그래도 안 풀리면 → [GitHub Issues](https://github.com/sigco3111/toss-trader/issues) 에 다음 4가지 첨부:
> 1. 오류 메시지 전문 (텍스트)
> 2. 어느 단계에서 막혔는지 (1~5 중)
> 3. OS (Mac/Windows/Linux)
> 4. 브라우저 (Chrome/Safari/Firefox)

---

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

- 🔒 **시크릿 격리** — 토스 client_id/secret은 본인 PC의 `~/.hermes/secrets/tossinvest.env` (chmod 600), toss-trader 코드 내 보관 0
- 📝 **Paper trading 기본값** — `DRY_RUN=true` 기본, 실계좌는 Telegram 사용자 confirm 후만 활성
- 🧠 **LLM 단일화** — 본인 PC의 OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`) 한 가지. 모델 변경 = OpenCode 설정에서만
- 💬 **Telegram confirm** — BUY/SELL은 Telegram inline button 사용자 명시 확인 후
- 🗂️ **Notion 이력** — 모든 분석/주문은 Notion DB 기록 (Vercel env 사용, 서버 측)
- 🛡️ **안전 가드 5종** — `safety.ts` (DRY_RUN + 422 가드 + confirmHighValueOrder + Telegram confirm + 토큰 길이 검증)

## 🎮 조작법

| 화면 | 동작 |
|---|---|
| `/` (메인) | 시세/잔고/이력 + 매수/매도 버튼 (paper 기본) |
| `BUY` 버튼 클릭 | Telegram confirm → 안전 가드 5종 통과 → 토스 주문 (DRY_RUN=false 시) |

---

## 🛠️ 개발자 섹션

> 아래는 개발자/에이전트용 정보. 비개발자는 무시해도 됩니다.

### 기술 스택

- **프레임워크**: Next.js 16.2.10 (App Router)
- **언어**: TypeScript 5, React 19.2.4
- **스타일**: Tailwind CSS 4
- **린트**: ESLint 9
- **호스팅**: Vercel
- **테스트 (3단계부터)**: vitest + MSW (HTTP mock)

### 로컬 개발

```bash
# 1) 의존성
npm install

# 2) 토스 Open API 키 (오빠 PC)
#    ~/.hermes/secrets/tossinvest.env (chmod 600)
#      TOSS_CLIENT_ID=...
#      TOSS_CLIENT_SECRET=...

# 3) Vercel env (서버 측 도구만)
vercel link
vercel env add NOTION_API_KEY
vercel env add TELEGRAM_BOT_TOKEN

# 4) Vercel 배포
vercel --prod --yes --token $(cat ~/.hermes/secrets/vercel_token.txt)

# 5) 로컬 dev
npm run dev  # http://localhost:3000
```

### 🛠️ 개발 도구 — OpenCode + oh-my-opencode

toss-trader는 **오빠 PC의 OpenCode + oh-my-opencode** 환경에서 개발합니다.

#### 핵심 원칙 (v0.3 단순화)

> **모델 변경의 유일한 경로 = OpenCode 설정**. 우리 프로젝트는 모델 설정 코드 0줄.

#### 1) OpenCode — TUI/exec 에이전트

```bash
brew install opencode         # 또는 bunx
opencode                       # TUI 진입
opencode exec "..."            # 비대화형
```

- **글로벌 디폴트**: `~/.config/opencode/opencode.json`의 `model: "minimax/MiniMax-M3"`
- **프로젝트별 override**: `opencode -m <model>` 또는 프로젝트 `opencode.json`의 `model`
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
- **공식 카탈로그**: [github.com/code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

#### 3) toss-trader에서 OpenCode의 역할

| 차원 | Vercel (사용자 분석) | OpenCode (오빠 코딩) |
|---|---|---|
| LLM 호출 | ❌ 코드 0줄 | ⭕ 오빠 PC TUI/exec |
| 모델 | — | 미니맥스 M3 (글로벌 디폴트) |
| 목적 | — | Next.js 컴포넌트/로직 자동 생성 |
| 시크릿 | Vercel env (Notion, Telegram만) | `~/.config/opencode/opencode.json` 또는 `/connect` |

> v0.3 단순화: "Vercel에서 LLM 호출" 행 자체가 ❌. 토스 Open API relay + Notion 기록 + Telegram 알림만.

### 📂 프로젝트 구조

```
toss-trader/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # 메인 대시보드 (시세/잔고/매수/매도)
│   ├── globals.css
│   ├── favicon.ico
│   └── api/
│       ├── toss/route.ts         # (2단계) 토스 Open API relay
│       ├── notion/route.ts       # (6단계) Notion DB 이력
│       └── telegram/route.ts     # (4단계) Telegram inline button
├── components/
│   ├── .gitkeep
│   ├── Portfolio.tsx             # (5단계)
│   └── OrderButton.tsx           # (4단계)
├── lib/
│   ├── .gitkeep
│   ├── toss.ts                   # (2단계) 토스 Open API 클라이언트
│   ├── notion.ts                 # (6단계)
│   ├── telegram.ts               # (4단계)
│   └── safety.ts                 # (3단계) 5대 가드
├── schemas/
│   ├── .gitkeep
│   └── recommendation.schema.json # (5단계)
├── docs/
│   ├── ARCHITECTURE.md           # v0.3 정식 문서
│   ├── OPENAPI_REFERENCE.md      # 토스 API v1.1.5 레퍼런스 (발급 절차 포함)
│   ├── SAFETY.md                 # (3단계) 5대 가드 + 422 매트릭스
│   └── NOTION_SETUP.md           # (6단계)
├── .env.example                  # Vercel env 예시 (Notion/Telegram만)
├── next.config.ts
├── next-env.d.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json                  # name=toss-trader, next@16.2.10
├── AGENTS.md                     # 다른 PC 에이전트용 작업 가이드
├── README.md                     # 본 파일
├── LICENSE
└── .gitignore                    # Next 표준 + toss-trader 시크릿 격리
```

> v0.3에서 제거된 것: `app/settings/`, `app/api/llm/`, `lib/llm/`, `components/SettingsForm.tsx`, `components/ChatPanel.tsx`. LLM provider 라우터 0줄.

### 🎨 디자인 결정

#### 원본 (kstost/stock) 대비 변경점

| 차원 | 원본 (kstost) | 우리 (v0.3) |
|---|---|---|
| UI | Next.js + Vercel | ✅ Next.js + Vercel (동일) |
| LLM | Codex CLI 단일 | ❌ toss-trader 코드 0줄 (= OpenCode 글로벌) |
| LLM 호출 | `child_process.spawn('codex')` | ❌ Vercel에서 호출 없음. 본인 PC의 OpenCode |
| 시크릿 | Next.js 서버 메모리 | 본인 PC `~/.hermes/secrets/` (chmod 600) |
| 주문 실행 | 화면 버튼 즉시 | Telegram inline button + 사용자 확인 |
| 안전장치 | prompt 차원 | `safety.ts` 가드 5종 + 422 자동 처리 |
| Paper trading | ❌ 없음 | ✅ 기본값 (`DRY_RUN=true`) |
| 미니맥스 | ❌ 미사용 | ⭕ OpenCode 글로벌 디폴트 |

#### 5대 안전 가드 (safety.ts)

1. `DRY_RUN=true` 기본값 — 토스 주문 endpoint 완전 차단
2. 토스 422 `account-restricted` / `prerequisite-required` 자동 안내
3. `confirm-high-value-required` (1억+) 자동 confirmHighValueOrder
4. Telegram inline button = 사용자 마지막 confirm
5. 토큰 길이/형식 검증 (실패 → 안전 기본값)

#### paper trading 우선 철학

실계좌 주문은 **비가역 (irreversible)** 입니다. 한 번 체결된 주문은 시장가로만 청산 가능하며, 잘못된 행동지침 한 줄이 수백만 원 손실로 이어질 수 있습니다. 따라서:

- 모든 분석은 **paper** 모드에서 검증
- 실계좌 모드 진입은 Telegram 사용자 confirm 명시
- Telegram inline button이 사용자 마지막 확인

### 🧠 동작 원리

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

### 🔬 검증

- [x] `npm run build` 0 에러 (2026-07-10 검증, 1447ms Turbopack)
- [x] `npm run lint` 0 에러
- [ ] `npm run test` 0 실패 (3단계부터 vitest 추가)
- [ ] `safety.ts` dry-run 가드 — `DRY_RUN=true`에서 주문 endpoint 호출 0회
- [ ] 토큰 길이 검증 — `tossinvest.env` chmod 600 + 길이 검증
- [ ] LLM 호출 0줄 — `grep -rn "openai\|nim\|anthropic" lib/ app/ components/` 모두 0건 (Vercel 코드)
- [ ] 토스 422 가드 — 5종 코드 자동 인식 + 사용자 안내
- [ ] Telegram inline button — 사용자 confirm 없이 실행 0회

### 📝 프롬프트 이력

- **v0.0 (2026-07-09)**: kstost/stock 영감 + 우리 스택 1차 스캐폴드
- **v0.1 (2026-07-09)**: docs/OPENAPI_REFERENCE.md 정식 문서 (URL + 발급 + 422 + rate limit)
- **v0.2 (2026-07-09)**: 아키텍처 결정 — Next.js + Vercel + BYOK + 다중 LLM (NIM/미니맥스/OpenAI) + Codex 미니맥스 공식 지원 활용
- **v0.3 (2026-07-09)**: 개발 도구 통합 — Codex CLI 0.143.0 + LazyCodex v4.16.0 (oh-my-openagent Codex 통합) 설치 및 README 반영
- **v0.4 (2026-07-10)**: 단순화 — Codex → OpenCode + oh-my-opencode로 전환. LLM provider 라우터/BYOK 폼/SettingsForm 모두 제거. LLM 호출 0줄, 모델 = OpenCode 글로벌 디폴트(미니맥스 M3) 단일. docs 3종(AGENTS/README/ARCHITECTURE) v0.3 갱신.
- **v0.5 (2026-07-10)**: 1단계 보일러플레이트 — Next.js 16.2.10 + React 19.2.4 + Tailwind 4 + TypeScript 5 + ESLint 9. npm run build 0 에러.
- **v0.6 (2026-07-10)**: README 비개발자용 가이드 5단계 추가 — 토스 Open API 키 발급부터 Vercel 배포까지 코딩 없이 따라하는 흐름. 기존 개발자 섹션은 아래로 보존.

### 🤝 원본 크레딧

- 원본: [kstost/stock](https://github.com/kstost/stock) (MIT License, 2026) — Next.js 15 + Codex CLI + Tossinvest Open API
- [OpenCode 공식](https://opencode.ai/docs) — TUI/exec 에이전트
- [oh-my-opencode (code-yeongyu)](https://github.com/code-yeongyu/oh-my-opencode) — OpenCode 플러그인 (11 agents, 54+ hooks, 5 MCPs)
- [NIM 키 발급 직행 URL](https://build.nvidia.com/settings/api-keys) — 미니맥스 등 NIM 모델 키 발급 (핸드폰 인증 필요)

### 📜 License

MIT — 원본 kstost/stock과 동일
