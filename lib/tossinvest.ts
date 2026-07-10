import type { Currency, Market } from "@/lib/types";

const baseUrl = "https://openapi.tossinvest.com";

type ApiResult<T> = {
  result: T;
};

type Account = {
  accountNo: string;
  accountSeq: number;
  accountType: string;
};

export class TossinvestError extends Error {
  status: number | null;
  body: unknown;

  constructor(message: string, status: number | null, body: unknown) {
    super(message);
    this.name = "TossinvestError";
    this.status = status;
    this.body = body;
  }
}

// ─── Token cache ────────────────────────────────────────────────────────────
//
// The Open API's OAuth2 token is valid for a long time (typically 24h), so we
// cache it in memory keyed by the apiKey to avoid burning rate-limit on
// /oauth2/token every call. Concurrent callers share a single in-flight
// request to avoid stampeding the auth endpoint.

type CacheKey = string; // apiKey
type CachedToken = {
  token: string;
  expiresAt: number;
};
const tokenCache = new Map<CacheKey, CachedToken>();
const inflightToken = new Map<CacheKey, Promise<string>>();

// Refresh ~1h before the actual expiry to be safe.
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000;

async function fetchNewToken(apiKey: string, secretKey: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });

  const response = await fetch(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new TossinvestError(
      "Tossinvest token issuance failed",
      response.status,
      text ? JSON.parse(text) : null,
    );
  }
  const data = JSON.parse(text) as {
    access_token: string;
    expires_in: number;
  };
  return data.access_token;
}

export async function getAccessToken(
  apiKey: string,
  secretKey: string,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(apiKey);
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cached.token;
  }

  // Coalesce concurrent token requests for the same apiKey.
  const existing = inflightToken.get(apiKey);
  if (existing) return existing;

  const promise = fetchNewToken(apiKey, secretKey)
    .then((token) => {
      // Token lifetime is server-controlled; default to 24h if not provided.
      const lifetimeMs = 24 * 60 * 60 * 1000;
      tokenCache.set(apiKey, {
        token,
        expiresAt: now + lifetimeMs,
      });
      return token;
    })
    .finally(() => {
      inflightToken.delete(apiKey);
    });
  inflightToken.set(apiKey, promise);
  return promise;
}

// ─── Low-level fetch ────────────────────────────────────────────────────────

async function tossFetch<T>(
  path: string,
  init: RequestInit & { token?: string; accountSeq?: number } = {},
) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.accountSeq != null) {
    headers.set("X-Tossinvest-Account", String(init.accountSeq));
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : null;

  if (!response.ok) {
    throw new TossinvestError("Tossinvest API request failed", response.status, body);
  }

  return body as T;
}

// ─── High-level helpers (used by API routes and by lib/market-context) ─────

export async function getAccounts(token: string) {
  const response = await tossFetch<ApiResult<Account[]>>("/api/v1/accounts", {
    token,
  });
  return response.result;
}

export type TossAccount = Account;

/**
 * Issue a token, fetch the first available account, and return both. Throws if
 * no account is found.
 */
export async function authenticate(
  apiKey: string,
  secretKey: string,
): Promise<{ token: string; account: TossAccount }> {
  const token = await getAccessToken(apiKey, secretKey);
  const accounts = await getAccounts(token);
  const account = accounts[0];
  if (!account) {
    throw new TossinvestError("No account returned by Tossinvest API", 404, {
      error: "account-not-found",
    });
  }
  return { token, account };
}

/**
 * Authenticated fetch. Resolves the token via the cache and attaches both
 * the Bearer token and the X-Tossinvest-Account header.
 */
export async function tossFetchAuthed<T>(
  path: string,
  init: RequestInit & { apiKey: string; secretKey: string; accountSeq: number },
): Promise<T> {
  const token = await getAccessToken(init.apiKey, init.secretKey);
  const { apiKey: _apiKey, secretKey: _secretKey, accountSeq, ...rest } = init;
  void _apiKey;
  void _secretKey;
  return tossFetch<T>(path, { ...rest, token, accountSeq });
}

export async function createLimitOrder(input: {
  apiKey: string;
  secretKey: string;
  symbol: string;
  market: Market;
  side: "BUY" | "SELL";
  quantity: string;
  limitPrice: string;
  currency: Currency;
}) {
  const { token, account } = await authenticate(input.apiKey, input.secretKey);

  const clientOrderId = `agent-${Date.now().toString(36)}`.slice(0, 36);
  const body = {
    clientOrderId,
    symbol: input.symbol,
    side: input.side,
    orderType: "LIMIT",
    quantity: input.quantity,
    price: input.limitPrice,
    confirmHighValueOrder: false,
  };

  const response = await tossFetch<ApiResult<{ orderId: string }>>(
    "/api/v1/orders",
    {
      method: "POST",
      token,
      accountSeq: account.accountSeq,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  return {
    accountSeq: account.accountSeq,
    order: response.result,
    submitted: {
      clientOrderId,
      symbol: input.symbol,
      market: input.market,
      side: input.side,
      orderType: "LIMIT",
      quantity: input.quantity,
      price: input.limitPrice,
      currency: input.currency,
    },
  };
}
