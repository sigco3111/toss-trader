# 🚀 toss-trader v1.0 — Release Notes

> **릴리스 날짜**: 2026-07-10
> **저장소**: https://github.com/sigco3111/toss-trader
> **라이센스**: MIT (원본 kstost/stock 동일)

---

## 🎉 v1.0 — Initial Public Release

toss-trader는 토스증권 Open API + 다중 LLM을 활용한 개인 투자 어시스턴트입니다. **8단계 (1~7.5) 모두 완료** + **v0.3/v0.4 단순화** 적용 → 실사용 가능한 MVP.

### 한 줄 요약

> **Vercel 5분 배포 + 토스 Open API 키 1쌍 = 본인의 토스 투자 대시보드. LLM 분석은 본인 PC의 OpenCode 글로벌 디폴트(`minimax/MiniMax-M3`)가 처리. paper-trading 기본, Telegram confirm 게이트, kstost/stock 원본 history 방식.**

### 핵심 기능

| 기능 | 상태 | 단계 |
|---|---|---|
| Next.js 16.2.10 보일러플레이트 + Tailwind 4 + TS 5 | ✅ | 1 |
| 토스 Open API catch-all relay (`/api/toss/[...path]`) | ✅ | 2 |
| 6대 안전 가드 (DRY_RUN/TRADING_MODE/AMOUNT/HOURS/ACCOUNT/TELEGRAM + AUDIT) | ✅ | 3 |
| Telegram inline button confirm + OrderButton UI | ✅ | 4 |
| Portfolio (잔고 + 손익 + 10초 polling) | ✅ | 5 |
| kstost/stock 원본 history.ts (1 record = 1 JSON 파일) | ✅ | 6 |
| Vercel 배포 (vercel.json + .env.example + 가이드) | ✅ | 7 |
| History UI 탭 (Dashboard/History) | ✅ | 7.5 |

### 검증 (모두 PASS)

| 어서션 | 결과 |
|---|---|
| `npm run build` | ✅ 5 routes (1387ms Turbopack) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run test` | ✅ **81/81 PASS** (format 31 + safety 25 + telegram 13 + history 12) |
| 헤딩 정규화 (bash + python 2중) | ✅ 0/0 깨짐 (4파일) |
| v0.3 자기 검증 (LLM 호출 0줄) | ✅ OK |

---

## 🌐 라이브 URL

```text
Vercel 자동 배포: https://toss-trader.vercel.app/  (예정)
```

오빠가 fork → Vercel Import → env 2~3개 → Deploy로 본인만의 URL 발급.

---

## 📂 디렉토리 (v1.0)

```
toss-trader/  (40+ 파일)
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard / History 탭
│   ├── globals.css
│   ├── favicon.ico
│   └── api/
│       ├── toss/[...path]/route.ts    # 2단계: 토스 Open API relay
│       ├── telegram/send/route.ts     # 4단계: 주문 confirm 발송
│       ├── telegram/callback/route.ts # 4단계: Telegram webhook
│       └── history/route.ts           # 6단계: history GET/POST
├── components/
│   ├── Portfolio.tsx                  # 5단계
│   ├── OrderButton.tsx                # 4단계 + 6단계 (history write)
│   └── History.tsx                    # 7.5단계
├── lib/
│   ├── toss.ts                        # 2단계
│   ├── safety.ts                      # 3단계
│   ├── telegram.ts                    # 4단계
│   ├── history.ts                     # 6단계 (kstost 패턴)
│   ├── types.ts                       # 6단계
│   └── format.ts                      # 5단계
├── history/.gitkeep                   # 6단계
├── test/
│   ├── format.test.ts                 # 31 tests
│   ├── safety.test.ts                 # 25 tests
│   ├── telegram.test.ts               # 13 tests
│   └── history.test.ts                # 12 tests
├── docs/
│   ├── ARCHITECTURE.md                # v0.4
│   ├── OPENAPI_REFERENCE.md           # v0.1
│   └── SAFETY.md                      # (예정)
├── .env.example                       # 7단계 (TOSS_* / TELEGRAM_* / DRY_RUN)
├── vercel.json                        # 7단계 (nextjs + icn1 + maxDuration)
├── vitest.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
├── AGENTS.md
├── README.md
├── LICENSE                            # MIT
├── RELEASE_NOTES.md                   # 본 파일
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

## 🔄 업그레이드 가이드 (v0.9 → v1.0)

v1.0은 v0.9와 비교해서 **breaking change 없음**. 단순히 release notes 추가 + README 보강.

### 0.5.x → 1.0 변경점

| 항목 | 0.5.x | 1.0 |
|---|---|---|
| `app/page.tsx` | Dashboard만 (Portfolio + OrderButton) | + History 탭 |
| `components/History.tsx` | 없음 | 신규 (5초 polling, kind/limit 필터) |
| `app/api/history/route.ts` | 단순 GET/POST | + availability 3-state |
| `OrderButton.tsx` | history write (silent) | + try/catch 명시 |
| `RELEASE_NOTES.md` | 없음 | 신규 (v1.0) |
| `vercel.json` | 있음 | + functions maxDuration 명시 |
| `.env.example` | 있음 | + TELEGRAM_CONFIRM_TTL_SEC 추가 |

### 마이그레이션 절차

```bash
# 1) 최신 main 받기
git pull origin main

# 2) 의존성 확인 (변경 없음)
npm install

# 3) 빌드 + 테스트 그린 확인
npm run build
npm run test

# 4) (선택) Vercel 자동 배포 — main push 트리거
git push origin main
```

---

## 🗺️ 다음 로드맵 (v1.1+)

### v1.1 — e2e 테스트 (Playwright)

- **목표**: Vercel preview URL 자동 검증
- **범위**: Portfolio fetch / OrderButton 클릭 / History 표시 / 422 가드 / 5xx 재시도
- **도구**: Playwright + GitHub Actions (PR마다 자동)
- **예상**: 1.5시간

### v1.2 — 여러 종목 batch + 실시간 WebSocket

- **목표**: Portfolio에 여러 종목 동시 표시 + WebSocket 실시간 시세
- **범위**: 
  - `components/Portfolio.tsx` symbols 배열 받기
  - `app/api/toss/api/v1/prices?symbols=A,B,C` 배치
  - 토스 Open API WebSocket endpoint 추가
- **예상**: 3시간

### v1.3 — 외부 history storage (S3/R2)

- **목표**: Vercel readonly 제약 극복 (영구 이력)
- **범위**:
  - `lib/storage/s3.ts` (또는 r2)
  - `lib/history.ts`에서 `STORAGE_PROVIDER` env 분기
  - `checkHistoryAvailability()` → "external" 4-state 추가
- **예상**: 2시간

### v2.0 — 실계좌 모드 (Telegram confirm 강화)

- **목표**: 실계좌 주문 (paper → live 전환)
- **범위**:
  - `safety.ts` 가드 5 + 가드 6 (live 모드 Telegram confirm 강화)
  - `OrderButton.tsx`에 live 토글 + 추가 confirm
  - Portfolio에 실시간 체결 알림
- **전제**: 1억+ 주문 `confirmHighValueOrder` 자동 설정 검증 (현재 가드 3)
- **예상**: 4시간

---

## 🤝 기여

- **Issues**: [github.com/sigco3111/toss-trader/issues](https://github.com/sigco3111/toss-trader/issues)
- **PRs**: `main` 브랜치 + 기능별 feature branch
- **코드 스타일**: ESLint 9 + Next.js 기본 + Prettier (선택)
- **테스트**: vitest, 각 PR마다 `npm run test` 81/81 그린 유지
- **커밋 메시지**: `<type>(scope): <subject>` (예: `feat(safety): 3단계 — 6대 가드`)

---

## 📞 문의

- **GitHub**: [@sigco3111](https://github.com/sigco3111)
- **Issues**: [GitHub Issues](https://github.com/sigco3111/toss-trader/issues)
- **원본**: [kstost/stock](https://github.com/kstost/stock) (MIT, 2026)
- **도구**: [OpenCode](https://opencode.ai/docs) + [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

---

## 📝 v1.0 최종 검증 체크리스트

- [x] 8단계 (1~7.5) 모두 완료
- [x] v0.3 단순화 (LLM 단일화, BYOK 제거)
- [x] v0.4 단순화 (Notion 제거, kstost history 채택)
- [x] 81/81 tests PASS (format 31 + safety 25 + telegram 13 + history 12)
- [x] Build 0 errors, Lint 0 errors
- [x] 헤딩 정규화 0/0 깨짐 (4파일)
- [x] v0.3 자기 검증 (LLM 호출 0줄)
- [x] 시크릿 격리 (`.env.example`만 커밋, 실제 값 `~/.hermes/secrets/`)
- [x] docs 3종 + AGENTS.md + README + LICENSE + RELEASE_NOTES 모두 동기화
- [x] Git 푸시 검증

**🎉 toss-trader v1.0 공개 완료.**
