/**
 * app/api/toss/[...path]/route.ts — 토스 Open API catch-all relay
 *
 * v0.3 단순화: toss-trader 코드 내 시크릿 보관 0. 토큰은 Vercel Edge Function
 * 런타임 env(TOSS_CLIENT_ID / TOSS_CLIENT_SECRET)에서만 로드.
 *
 * 사용 예시 (브라우저 → 이 relay → 토스):
 *   GET  /api/toss/api/v1/accounts         → 계좌 목록
 *   GET  /api/toss/api/v1/holdings?accountSeq=1   → 보유 종목
 *   GET  /api/toss/api/v1/prices?symbols=005930  → 시세
 *   POST /api/toss/api/v1/orders (DRY_RUN 시 423)
 *
 * safety.ts (3단계) 도입 시 이 route는 tossFetch() 호출 전에 safety.guardRequest() 한 번 더 통과.
 * 현재는 tossFetch() 내장 가드(DRY_RUN/422/429)만 사용.
 */

import { NextRequest, NextResponse } from "next/server";
import { tossFetch, TossError } from "@/lib/toss";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

function joinPath(path: string[]): string {
  return "/" + path.join("/");
}

function flattenQuery(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function handle(req: NextRequest, ctx: RouteContext, method: "GET" | "POST" | "PUT" | "DELETE"): Promise<NextResponse> {
  const { path } = await ctx.params;
  const tossPath = joinPath(path);
  const url = new URL(req.url);

  // ── body 파싱 (POST/PUT/DELETE만) ──
  let body: unknown = undefined;
  if (method !== "GET" && method !== "DELETE") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            code: "invalid-body",
            message: "JSON body 파싱 실패. Content-Type: application/json 확인.",
          },
          { status: 400 }
        );
      }
    }
  }

  // ── tossFetch 옵션 조립 ──
  const accountSeqHeader = req.headers.get("x-tossinvest-account");
  const accountSeq = accountSeqHeader ? Number(accountSeqHeader) : undefined;
  const confirmHighValue = req.headers.get("confirmhighvalueorder") === "true";
  const clientOrderId = req.headers.get("x-client-order-id") ?? undefined;

  try {
    const result = await tossFetch({
      method,
      path: tossPath,
      query: flattenQuery(url),
      body,
      accountSeq,
      confirmHighValue,
      clientOrderId,
    });

    return NextResponse.json(result, {
      headers: {
        "X-DRY-RUN": String(result.dryRun),
        "X-Served-At": result.servedAt,
      },
    });
  } catch (e) {
    if (e instanceof TossError) {
      return NextResponse.json(
        {
          code: e.body.code,
          message: e.body.message,
          fieldErrors: e.body.fieldErrors,
          servedAt: new Date().toISOString(),
        },
        { status: e.body.httpStatus }
      );
    }
    return NextResponse.json(
      {
        code: "internal-error",
        message: (e as Error).message ?? "Unknown error",
        servedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(req, ctx, "GET");
}
export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(req, ctx, "POST");
}
export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(req, ctx, "PUT");
}
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(req, ctx, "DELETE");
}
