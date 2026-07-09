/**
 * app/api/history/route.ts — toss-trader 이력 조회/기록 (6단계)
 *
 * GET: 이력 조회 (kind, symbol, limit 쿼리)
 * POST: 이력 기록 (OrderButton.executeOrder 성공/실패 시)
 *
 * kstost/stock 패턴 그대로 — 로컬 JSON 파일.
 * Vercel에서 readonly 시 silent return.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  writeHistory,
  listHistory,
  listHistoryByKind,
  listHistoryBySymbol,
  checkHistoryAvailability,
} from "@/lib/history";
import type { HistoryRecord } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as HistoryRecord["kind"] | null;
  const symbol = url.searchParams.get("symbol");
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Math.max(1, Math.min(1000, Number(limitStr))) : 100;

  const availability = await checkHistoryAvailability();
  if (availability === "readonly") {
    return NextResponse.json(
      {
        code: "history-readonly",
        message:
          "Vercel 등 read-only filesystem에서는 history 저장이 비활성화됩니다. dev/local 또는 외부 storage 필요.",
        availability,
        records: [],
      },
      { status: 200 }
    );
  }
  if (availability === "disabled") {
    return NextResponse.json(
      {
        code: "history-disabled",
        message: "filesystem 오류로 history 사용 불가",
        availability,
        records: [],
      },
      { status: 500 }
    );
  }

  let records: Array<{ file: string; record: HistoryRecord }>;
  if (kind) {
    records = await listHistoryByKind(kind, limit);
  } else if (symbol) {
    records = await listHistoryBySymbol(symbol, limit);
  } else {
    records = await listHistory(limit);
  }

  return NextResponse.json({
    availability,
    count: records.length,
    records,
    servedAt: new Date().toISOString(),
  });
}

interface PostBody {
  record: HistoryRecord;
}

function isValidPostBody(b: unknown): b is PostBody {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  const r = o.record;
  if (!r || typeof r !== "object") return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.kind === "string" &&
    (rec.kind === "analysis" || rec.kind === "order" || rec.kind === "snapshot") &&
    typeof rec.epochSeconds === "number" &&
    typeof rec.createdAt === "string"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "invalid-body", message: "JSON body 파싱 실패" },
      { status: 400 }
    );
  }

  if (!isValidPostBody(body)) {
    return NextResponse.json(
      { code: "invalid-record", message: "record.kind/epochSeconds/createdAt 필수 (analysis|order|snapshot)" },
      { status: 400 }
    );
  }

  const availability = await checkHistoryAvailability();
  if (availability !== "available") {
    return NextResponse.json(
      {
        code: `history-${availability}`,
        message: `Vercel/readonly filesystem: history 저장 비활성화. dev/local 또는 외부 storage 사용.`,
        availability,
        saved: false,
      },
      { status: 200 }
    );
  }

  try {
    const filename = await writeHistory(body.record);
    return NextResponse.json({
      availability,
      saved: true,
      filename,
      servedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        code: "history-write-failed",
        message: (e as Error).message ?? "Unknown error",
        saved: false,
      },
      { status: 500 }
    );
  }
}
