# 📂 docs/ — toss-trader 문서

toss-trader의 정식 문서 (Git 추적). `OPENAPI_REFERENCE.md`는 1차 raw 자료에서 정제한 결과, `ARCHITECTURE.md`는 아키텍처 결정.

## 정식 문서 (Git 추적)

| 파일 | 단계 | 내용 |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 전 단계 | 아키텍처 결정 (v0.3/v0.4 단순화 반영) |
| [OPENAPI_REFERENCE.md](./OPENAPI_REFERENCE.md) | v0.1 (2026-07-09) | 토스증권 Open API v1.1.5 정식 레퍼런스 (URL, 발급 절차, 422 가드 10종, rate limit 16 그룹) |
| SAFETY.md | (예정) | 6대 안전 가드 + 422 매트릭스 |

## Raw 캐시 (로컬 전용, Git 추적 안 함)

- `raw/` 디렉토리 (.gitignore로 무시) — 2026-07-09에 수집한 토스 Open API 1차 자료 34개 파일 (1.0MB)
- 압축 / 삭제 방법은 `raw/README.md` 참조
- 정제본이 필요한 경우 `OPENAPI_REFERENCE.md`가 canonical

## 작업 위임 시

- 다른 PC 에이전트 → `AGENTS.md` 우선 + `ARCHITECTURE.md`로 큰 그림 파악 + `OPENAPI_REFERENCE.md`로 토스 API 명세 확인
- 정식 토스 API 변경 시 → `OPENAPI_REFERENCE.md` 업데이트 + `raw/`에서 새 자료 다운로드
