/**
 * lib/toss.ts — 토스증권 Open API 클라이언트
 *
 * v0.3 단순화: toss-trader 코드 내 시크릿 보관 0. 토큰은 Vercel Edge Function 런타임
 * 환경에서만 사용. OAuth 토큰은 1시간 캐시 (1 client = 1 token, refresh 없음).
 *
 * 책임:
 * 1. OAuth Client Credentials 토큰 발급 + 메모리 캐시
 * 2. GET/POST/DELETE 공통 fetch wrapper (DRY_RUN 가드 + 422/429 처리)
 * 3. 에러 envelope 정규화 (toss-trader 메타 추가)
 *
 * 5대 안전 가드 (toss-trader 표준):
 * 1. DRY_RUN=true 기본값 (POST /api/v1/orders 차단)
 * 2. 422 자동 인식 (account-restricted / prerequisite-required / confirm-high-value-required 등)
 * 3. 429 Retry-After 우선 + 지수 백오프 (1s → 2s → 4s, max 3회)
 * 4. 토큰 길이 검증 (없으면 즉시 throw)
 * 5. toss-trader envelope에 servedAt/dryRun/rateLimit 메타 추가
 */

// ─── 환경변수 ──────────────────────────────────────────────────────
const TOSS_API_BASE = "https://openapi.tossinvest.com";
const TOSS_TOKEN_ENDPOINT = `${TOSS_API_BASE}/oauth2/token`;

function getClientId(): string {
  const id = process.env.TOSS_CLIENT_ID;
  if (!id || id.length < 8) {
    throw new Error("TOSS_CLIENT_ID 누락 또는 너무 짧음 (8자 이상 필요)");
  }
  return id;
}

function getClientSecret(): string {
  const secret = process.env.TOSS_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("TOSS_CLIENT_SECRET 누락 또는 너무 짧음 (16자 이상 필요)");
  }
  return secret;
}

export function isDryRun(): boolean {
  return process.env.DRY_RUN !== "false"; // 기본값 true
}

// ─── OAuth 토큰 캐시 (모듈 스코프, 1시간 TTL) ──────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55분 (보수적으로 1시간 미만)

async function fetchAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: getClientId(),
    client_secret: getClientSecret(),
  });

  const res = await fetch(TOSS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new TossError({
      code: `token-${res.status}`,
      message: `OAuth 토큰 발급 실패: ${res.status} ${res.statusText}`,
      httpStatus: res.status,
    });
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new TossError({
      code: "token-malformed",
      message: "OAuth 응답에 access_token 없음",
      httpStatus: 502,
    });
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + TOKEN_TTL_MS,
  };

  return data.access_token;
}

// ─── 422/429 안전 가드 ─────────────────────────────────────────────
const ORDER_PATHS = [
  "/api/v1/orders",
  "/api/v1/conditional-orders",
];

function isOrderEndpoint(path: string): boolean {
  return ORDER_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

const RETRY_AFTER_FALLBACK_MS = 1000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// ─── TossError ─────────────────────────────────────────────────────
export interface TossErrorBody {
  code: string;
  message: string;
  httpStatus: number;
  fieldErrors?: Array<{ field: string; reason: string }>;
  docsUrl?: string;
}

export class TossError extends Error {
  body: TossErrorBody;
  constructor(body: TossErrorBody) {
    super(body.message);
    this.name = "TossError";
    this.body = body;
  }
}

// ─── 422 → 사용자 친화 메시지 매핑 ─────────────────────────────────
const CODE_422_MESSAGES: Record<string, string> = {
  "account-restricted":
    "이 계좌는 주문이 제한되어 있습니다 (연금/종합매매 등). toss-trader가 자동으로 paper 모드로 전환합니다.",
  "prerequisite-required":
    "토스 앱에서 약관 동의 / 위험 고지가 필요합니다. 토스 고객센터에 문의하세요.",
  "confirm-high-value-required":
    "1억+ 주문은 confirmHighValueOrder=true 헤더가 필요합니다. toss-trader가 자동 설정합니다.",
  "insufficient-buying-power":
    "매수 가능 금액이 부족합니다.",
  "order-hours-closed":
    "장이 마감되었습니다. 사전 시장 캘린더로 확인하세요.",
  "stock-restricted":
    "거래 제한 종목입니다. 종목 경고(warnings)를 사전 조회하세요.",
  "price-out-of-range":
    "상/하한가 범위를 벗어났습니다. price-limits를 사전 조회하세요.",
  "insufficient-sellable-quantity":
    "매도 가능 수량이 부족합니다. sellable-quantity를 사전 조회하세요.",
  "order-limit-exceeded":
    "주문 설정 한도를 초과했습니다.",
  "idempotency-key-conflict":
    "동일 clientOrderId가 다른 내용으로 재요청되었습니다. toss-trader가 새 clientOrderId로 재시도합니다.",
};

// ─── sleep (429 backoff) ────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── main fetch wrapper ────────────────────────────────────────────
export interface TossFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // e.g. "/api/v1/holdings"
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  accountSeq?: number; // X-Tossinvest-Account 헤더 (계좌 endpoint 필수)
  confirmHighValue?: boolean; // 1억+ 주문 자동 설정
  clientOrderId?: string; // 멱등성 키
}

export interface TossFetchResult<T = unknown> {
  data: T;
  servedAt: string;
  dryRun: boolean;
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    reset: number | null;
  };
}

export async function tossFetch<T = unknown>(
  opts: TossFetchOptions
): Promise<TossFetchResult<T>> {
  const method = opts.method ?? "GET";
  const dryRun = isDryRun();

  // ── 안전 가드 1: DRY_RUN + POST → 즉시 차단 ──
  if (
    dryRun &&
    (method === "POST" || method === "PUT" || method === "DELETE") &&
    isOrderEndpoint(opts.path)
  ) {
    throw new TossError({
      code: "dry-run-blocked",
      message: `paper 모드(DRY_RUN=true)에서 주문 endpoint 호출 차단됨: ${method} ${opts.path}. 실계좌는 DRY_RUN=false + Telegram 사용자 confirm 필요.`,
      httpStatus: 423, // 423 Locked (WebDAV) — 의도적 차단 표시
    });
  }

  // ── 안전 가드 5: 토큰 길이 검증 (재진입 시 throw 가능성) ──
  getClientId();
  getClientSecret();

  const token = await fetchAccessToken();

  // ── URL 조립 ──
  const url = new URL(`${TOSS_API_BASE}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  // ── 헤더 조립 ──
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.accountSeq !== undefined) {
    headers["X-Tossinvest-Account"] = String(opts.accountSeq);
  }
  if (opts.confirmHighValue) {
    headers["confirmHighValueOrder"] = "true";
  }
  if (opts.clientOrderId) {
    headers["X-Client-Order-Id"] = opts.clientOrderId;
  }

  // ── 재시도 루프 (429/5xx) ──
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });
    } catch (e) {
      lastError = e;
      // 네트워크 오류 → 짧은 백오프
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_AFTER_FALLBACK_MS * 2 ** attempt);
        continue;
      }
      throw new TossError({
        code: "network-error",
        message: `네트워크 오류: ${(e as Error).message}`,
        httpStatus: 503,
      });
    }

    // ── 성공 ──
    if (res.ok) {
      const data = (await res.json()) as T;
      return {
        data,
        servedAt: new Date().toISOString(),
        dryRun,
        rateLimit: {
          limit: numberOrNull(res.headers.get("X-RateLimit-Limit")),
          remaining: numberOrNull(res.headers.get("X-RateLimit-Remaining")),
          reset: numberOrNull(res.headers.get("X-RateLimit-Reset")),
        },
      };
    }

    // ── 401: 토큰 재발급 후 1회 재시도 ──
    if (res.status === 401 && attempt === 0) {
      cachedToken = null; // 강제 재발급
      continue;
    }

    // ── 429/5xx: Retry-After 우선 + 지수 백오프 ──
    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter
        ? Math.max(parseFloat(retryAfter) * 1000, 100)
        : RETRY_AFTER_FALLBACK_MS * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    // ── 422: 사용자 친화 메시지 + 즉시 throw (재시도 안 함) ──
    if (res.status === 422) {
      const errBody = await safeJson(res);
      const code = (errBody as { code?: string })?.code ?? "unknown-422";
      const friendlyMessage = CODE_422_MESSAGES[code] ?? code;
      throw new TossError({
        code,
        message: `[422 ${code}] ${friendlyMessage}`,
        httpStatus: 422,
        fieldErrors: (errBody as { fieldErrors?: TossErrorBody["fieldErrors"] })
          ?.fieldErrors,
      });
    }

    // ── 기타: 즉시 throw ──
    const errBody = await safeJson(res);
    throw new TossError({
      code: (errBody as { code?: string })?.code ?? `http-${res.status}`,
      message:
        (errBody as { message?: string })?.message ??
        `${res.status} ${res.statusText}`,
      httpStatus: res.status,
    });
  }

  // 재시도 소진
  throw (
    lastError ??
    new TossError({
      code: "retry-exhausted",
      message: "최대 재시도 횟수 초과",
      httpStatus: 504,
    })
  );
}

function numberOrNull(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
