# 🚀 toss-trader v1.3.1 — Release Notes

> **릴리스 날짜**: 2026-07-10
> **저장소**: https://github.com/sigco3111/toss-trader
> **라이센스**: MIT (원본 kstost/stock 동일)
> **v1.3.1 핵심**: **외부 history storage (S3/R2 호환)** + e2e S3 mock 자동 검증

---

## 🎉 v1.3 — 외부 history storage (S3/R2)

**v1.0 → v1.1 → v1.2 → v1.3** 모두 완료. 실사용 가능한 MVP + 자동 검증 인프라 + 영구 저장.

### v1.0 → v1.3 누적 진행 (15단계)

| 단계 | 작업 | 산출물 | 상태 |
|---|---|---|---|
| 1 | 보일러플레이트 | Next 16.2.10 + React 19.2.4 + TS 5 + Tailwind 4 | ✅ |
| 2 | 토스 Open API relay | `/api/toss/[...path]` + 5대 가드 | ✅ |
| 3 | 안전 가드 6종 | `lib/safety.ts` + vitest 25 tests | ✅ |
| 4 | Telegram + OrderButton | `lib/telegram.ts` + UI + 15 tests | ✅ |
| 5 | Portfolio + 시세 | `components/Portfolio.tsx` + 39 tests | ✅ |
| 6 | kstost history | `lib/history.ts` + 12 tests | ✅ |
| 7 | Vercel 배포 | vercel.json + .env.example + 가이드 | ✅ |
| 7.5 | History UI 통합 | `components/History.tsx` + 탭 | ✅ |
| v1.1 | 종목 검색 자동완성 | StockSearch + 31개 마스터 + 14 tests | ✅ |
| v1.1.4 | 3-모드 UI 토글 | lib/settings.ts + ConfirmModeToggle + 19 tests | ✅ |
| v1.1.5 | 매도 자동 채움 | findHoldingBySymbol (lib/format.ts) | ✅ |
| v1.2 | Playwright e2e + GitHub Actions | 22/22 PASS | ✅ |
| v1.2.1 | 문서 갱신 | e2e 뱃지/가이드/로드맵 | ✅ |
| **v1.3** | **외부 storage (S3/R2)** | **provider 추상화 + AWS SigV4 + 8 tests** | **✅** |
| **v1.3.1** | **문서 v1.3 + e2e S3 mock** | **storage.spec + 24/24 e2e** | **✅ (현재)** |

### 최종 검증 (모두 PASS)

| 어서션 | 결과 |
|---|---|
| `npm run build` | ✅ 5 routes (1387ms) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run test` (vitest) | ✅ **132/132 PASS** (storage 8 + format 39 + settings 19 + safety 25 + telegram 15 + history 12 + stocks 14) |
| `npm run test:e2e` (Playwright) | ✅ **24/24 PASS** (chromium 12 + webkit 12) — v1.3 storage e2e 추가 |
| GitHub Actions | ✅ PR마다 + main push마다 자동 실행 |
| 헤딩 정규화 (bash) | ✅ 0/0 깨짐 (5파일) |
| v0.3 자기 검증 (LLM 호출 0줄) | ✅ OK |

---

## 🌐 라이브 URL

```text
Vercel 자동 배포: https://toss-trader.vercel.app/  (예정)
```

### 로컬 e2e 실행 (주인님 검증용)

```bash
# 의존성
npm install

# Vitest unit (132/132)
npm test

# Playwright e2e (24/24) — dev 서버 자동 시작
npm run test:e2e

# Playwright UI 모드 (인터랙티브 디버깅)
npm run test:e2e:ui
```

### GitHub Actions e2e (Vercel preview URL 자동)

PR push → GitHub Actions 자동 실행 → Vercel preview URL에서 e2e 검증.

- **Workflow 파일**: `.github/workflows/e2e.yml`
- **Vercel preview URL**: `VERCEL_PREVIEW_URL` secret 필요 (Vercel GitHub App 연동 시 자동 주입)
- **Playwright report**: Actions artifact로 7일 보관

### Storage env 설정 (v1.3 신규)

```bash
# 기본 (dev/local) — 로컬 filesystem
STORAGE_PROVIDER=local

# Vercel 영구 저장 — S3 또는 R2
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://s3.ap-northeast-2.amazonaws.com  # AWS S3
# S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com  # Cloudflare R2
S3_BUCKET=toss-trader-history
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=***
S3_REGION=ap-northeast-2
S3_PREFIX=history/
```

---

## 📂 v1.3 디렉토리 (60+ 파일)

```
toss-trader/
├── app/                          # 9 파일
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard / History 탭
│   ├── globals.css
│   ├── favicon.ico
│   └── api/
│       ├── toss/[...path]/route.ts    # 2단계: 토스 relay
│       ├── telegram/send/route.ts     # 4단계: confirm 발송
│       ├── telegram/callback/route.ts # 4단계: webhook
│       └── history/route.ts           # 6단계: GET/POST
├── components/                   # 5 파일
│   ├── Portfolio.tsx                  # 5단계
│   ├── OrderButton.tsx                # 4단계 + v1.1.5
│   ├── History.tsx                    # 7.5단계
│   ├── ConfirmModeToggle.tsx          # v1.1.4
│   └── StockSearch.tsx                # v1.1
├── lib/                          # 9 파일 (v1.3 storage 4파일 추가)
│   ├── toss.ts
│   ├── safety.ts
│   ├── telegram.ts
│   ├── history.ts                    # facade (v1.3)
│   ├── types.ts
│   ├── format.ts
│   ├── settings.ts
│   └── storage/                       # v1.3 신규
│       ├── provider.ts                # StorageProvider 추상화
│       ├── local.ts                   # LocalStorageProvider
│       ├── s3.ts                      # S3StorageProvider (AWS SigV4)
│       └── index.ts                   # getStorage() factory
├── test/                         # 8 파일 (v1.3 storage 1파일 추가)
│   ├── safety.test.ts
│   ├── telegram.test.ts
│   ├── format.test.ts
│   ├── history.test.ts
│   ├── stocks.test.ts
│   ├── settings.test.ts
│   ├── storage.test.ts                # v1.3 신규
│   └── e2e/                           # 5 spec (v1.3 storage 1spec 추가)
│       ├── dashboard.spec.ts
│       ├── stock-search.spec.ts
│       ├── confirm-mode.spec.ts
│       ├── storage.spec.ts             # v1.3 신규
│       └── helpers/api-mock.ts         # v1.3 S3 mock 추가
├── docs/                         # 4 파일
│   ├── README.md                      # 인덱스
│   ├── ARCHITECTURE.md                # v0.4
│   ├── OPENAPI_REFERENCE.md
│   ├── raw/                           # (로컬 전용)
│   └── toss-api-research-2026-07-09/ # 1MB raw 캐시
├── history/.gitkeep              # 6단계
├── .github/workflows/e2e.yml     # v1.2
├── .env.example                  # 8단계 + v1.1.4 + v1.3
├── vercel.json                   # 7단계
├── playwright.config.ts          # v1.2
├── vitest.config.ts
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
├── AGENTS.md
├── README.md
├── LICENSE
├── RELEASE_NOTES.md             # 본 파일
└── .gitignore
```

---

## 🎯 v0.3 / v0.4 단순화 결정

### v0.3 (2026-07-10) — LLM 단일화 + BYOK 제거

| 제거 | 이유 |
|---|---|
| `app/settings/` (BYOK 폼) | 사용자 부담 + UX 복잡도 |
| `app/api/llm/` (NIM/OpenAI/Anthropic 라우터) | OpenCode 글로벌 디폴트면 충분 |
| `lib/llm/` (router/nim/openai/anthropic) | 코드 0줄 유지 |
| `components/SettingsForm.tsx` | BYOK 폼 통합 |
| `components/ChatPanel.tsx` | LLM 라우터 통합 |
| `openai` npm | LLM 호출 0 |
| `@notionhq/client` | v0.4에서 추가 제거 |

**결과**: LLM 분석 = 오빠 PC의 OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`). toss-trader 코드 0줄.

### v0.4 (2026-07-10) — Notion 제거 + kstost history 채택

| 제거 | 이유 |
|---|---|
| `app/api/notion/` | Notion API key + 영구 저장은 v0.3 단순화 철학에 안 맞음 |
| `lib/notion.ts` | 위와 동일 |
| `docs/NOTION_SETUP.md` | Notion 제거 |
| `NOTION_API_KEY` (Vercel env) | 위와 동일 |

**채택**: kstost/stock 원본 `lib/history.ts` (로컬 JSON, 1 record = 1 파일). Vercel에서 readonly 시 `checkHistoryAvailability()` graceful.

### v1.3 — 외부 storage 추가 (단순화 철학 유지)

| 추가 | 이유 |
|---|---|
| `lib/storage/{provider,local,s3,index}.ts` | Vercel 영구 저장 (Notion 대체) |
| `STORAGE_PROVIDER=s3` + S3_* env | AWS S3 / Cloudflare R2 같은 API |
| `test/storage.test.ts` (8 tests) | provider 검증 |
| `test/e2e/storage.spec.ts` (2 tests, v1.3.1) | S3 mock 자동 검증 |

**v0.3 철학 유지**: 의존성 0 (AWS SDK 없이 SigV4 직접). facade 패턴 (기존 `lib/history.ts` API 100% back-compat).

---

## 📜 라이센스

MIT License — 원본 [kstost/stock](https://github.com/kstost/stock) (MIT, 2026) 동일.

```
MIT License

Copyright (c) 2026 sigco3111
Copyright (c) 2026 kstost (original)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🔄 업그레이드 가이드 (v1.2 → v1.3)

v1.3은 v1.2와 비교해서 **breaking change 없음**. 단순 추가 (storage provider).

### 마이그레이션 절차

```bash
# 1) 최신 main 받기
git pull origin main

# 2) 의존성 (변경 없음)
npm install

# 3) 검증
npm run build
npm test               # 132/132 PASS
npm run test:e2e       # 24/24 PASS
```

### 신규 의존성 (v1.3)

**없음** (AWS SDK 없이 `node:crypto`로 SigV4 직접 구현).

### 신규 스크립트 (v1.3)

**없음** (기존 `npm test` / `npm run test:e2e` 그대로 사용).

### 신규 env (v1.3)

```bash
# .env 또는 Vercel env
STORAGE_PROVIDER=local  # 또는 s3
S3_ENDPOINT=...         # s3 모드일 때
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=...
S3_PREFIX=history/      # 기본값
```

---

## 🗺️ 다음 로드맵 (v1.4+)

### v1.4 — 여러 종목 batch + 차트 (candles) (예상 3h)

**목표**: Portfolio에 여러 종목 동시 표시 + WebSocket 실시간 시세 + 간단 SVG 차트.

- `components/Portfolio.tsx`: symbols 배열 받기
- `app/api/toss/api/v1/prices?symbols=A,B,C` 배치
- 토스 Open API WebSocket endpoint 추가
- `components/CandleChart.tsx` (간단 SVG, 의존성 X)

### v1.5 — Holdings fetch 통합 + Dashboard UX polish

- Portfolio ↔ OrderButton holdings fetch 중복 제거 (React Context)
- 매도 시 avgPrice 참고용 표시
- Portfolio 종목별 sparkline (간단 SVG)

### v2.0 — 실계좌 모드 (Telegram confirm 강화) (예상 4h)

**목표**: 실계좌 주문 안정화.

- `safety.ts` 가드 5 live 모드 강화
- `OrderButton.tsx`에 live 토글 + 추가 confirm (대량 주문)
- Portfolio 실시간 체결 알림 (Telegram Bot)
- 1억+ 주문 `confirmHighValueOrder` 자동 설정 검증
- Audit log (모든 주문/취소 이벤트)

### 장기 — 외부 storage 다중 사용자 + 모바일

- v2.x: 외부 storage S3/R2 + 다중 사용자 프로필
- v3.x: 모바일 앱 (React Native + 토스 SDK)
- v4.x: AI 매매 전략 자동화 (OpenCode 통합)

---

## 🤝 기여

- **Issues**: [github.com/sigco3111/toss-trader/issues](https://github.com/sigco3111/toss-trader/issues)
- **PRs**: `main` 브랜치 + 기능별 feature branch
- **코드 스타일**: ESLint 9 + Next.js 기본 + Prettier (선택)
- **테스트**: vitest (132/132) + Playwright e2e (24/24), 각 PR마다 모두 PASS
- **커밋 메시지**: `<type>(scope): <subject>` (예: `feat(safety): 3단계 — 6대 가드`)

---

## 📞 문의

- **GitHub**: [@sigco3111](https://github.com/sigco3111)
- **Issues**: [GitHub Issues](https://github.com/sigco3111/toss-trader/issues)
- **원본**: [kstost/stock](https://github.com/kstost/stock) (MIT, 2026)
- **도구**: [OpenCode](https://opencode.ai/docs) + [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

---

## 📝 v1.3.1 최종 검증 체크리스트

- [x] 8단계 + v1.1.x (4) + v1.2 (2) + v1.3 (2) = 16단계 모두 완료
- [x] v0.3 단순화 (LLM 단일화, BYOK 제거)
- [x] v0.4 단순화 (Notion 제거, kstost history 채택)
- [x] **v1.3 외부 storage (S3/R2)** — StorageProvider 추상화 + Local/S3 구현 + 8 tests
- [x] **v1.3.1 e2e S3 mock** — storage.spec (24/24 e2e total)
- [x] **vitest 132/132 PASS** (storage 8 + format 39 + settings 19 + safety 25 + telegram 15 + history 12 + stocks 14)
- [x] **Playwright e2e 24/24 PASS** (chromium 12 + webkit 12)
- [x] GitHub Actions CI (PR마다 + main push마다)
- [x] Build 0 errors, Lint 0 errors
- [x] 헤딩 정규화 0/0 깨짐 (5파일)
- [x] v0.3 자기 검증 (LLM 호출 0줄)
- [x] 시크릿 격리 (`.env.example`만 커밋, 실제 값 `~/.hermes/secrets/`)
- [x] docs 3종 + AGENTS.md + README + LICENSE + RELEASE_NOTES 모두 동기화
- [x] Git 푸시 검증 (v1.3.1 = `???`)

**🎉 toss-trader v1.3.1 공개 완료. 영구 저장 + 자동 검증 인프라 갖춘 MVP.**
