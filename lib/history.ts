/**
 * lib/history.ts — toss-trader 이력 저장 (6단계, kstost/stock 원본 방식)
 *
 * 영감: kstost/stock/lib/history.ts (MIT, 2026)
 * 차이 (v0.3 단순화):
 * 1. 시크릿 절대 저장 안 함 (apiKey/secretKey 제외)
 * 2. record.kind = "analysis" | "order" | "snapshot" (3종, kstost는 2종)
 * 3. process.cwd() + "history" 경로
 *
 * 저장 형식: history/<epochSeconds>.json (또는 <epochSeconds>-<counter>.json)
 * 1 record = 1 JSON file. 동시 초 충돌 시 counter suffix.
 *
 * Vercel 제약 (중요):
 * - Vercel serverless filesystem은 read-only + ephemeral
 * - writeHistory()는 Vercel에서 실패할 수 있음 (EACCES / EROFS)
 * - dev/local에서는 정상 작동
 * - 영구 저장 필요 시: S3 / R2 / 외부 storage 별도 구현 (v0.5+)
 *
 * 사용 예:
 *   await writeHistory({
 *     kind: "order",
 *     epochSeconds: Math.floor(Date.now() / 1000),
 *     createdAt: new Date().toISOString(),
 *     orderId: "order_abc123",
 *     request: { symbol: "005930", side: "BUY", quantity: 10, ... },
 *     response: { ok: true, httpStatus: 200, body: {...} },
 *   });
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { HistoryRecord } from "./types";

// ─── 경로 ──────────────────────────────────────────────────────
// 동적 계산 (테스트 격리 + Vercel cwd 변경 대응)
export function getHistoryDir(): string {
  return path.join(process.cwd(), "history");
}

// 하위 호환: 모듈 import 시점의 historyDir도 export (테스트가 직접 import 안 함)
export const historyDir = getHistoryDir();

// ─── 디렉토리 보장 ─────────────────────────────────────────────
export async function ensureHistoryDir(): Promise<void> {
  await fs.mkdir(getHistoryDir(), { recursive: true });
}

// ─── 기록 쓰기 (kstost 패턴 그대로) ───────────────────────────
export async function writeHistory(record: HistoryRecord): Promise<string> {
  await ensureHistoryDir();
  const base = `${record.epochSeconds}.json`;
  let filename = base;
  let counter = 2;

  while (true) {
    const target = path.join(getHistoryDir(), filename);
    try {
      await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, {
        flag: "wx", // exclusive create — 이미 있으면 EEXIST
      });
      return filename;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      // 같은 초에 다른 record → counter suffix
      filename = `${record.epochSeconds}-${counter}.json`;
      counter += 1;
    }
  }
}

// ─── 기록 조회 (kstost 패턴 그대로, limit 기본 100) ─────────
export async function listHistory(limit = 100): Promise<
  Array<{ file: string; record: HistoryRecord }>
> {
  await ensureHistoryDir();
  const files = await fs.readdir(getHistoryDir());
  const jsonFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b)) // epoch 기준 오름차순
    .slice(-limit); // 최근 limit개

  const records = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(getHistoryDir(), file), "utf8");
      return {
        file,
        record: JSON.parse(raw) as HistoryRecord,
      };
    })
  );

  return records;
}

// ─── 보조: kind 필터 ──────────────────────────────────────────
export async function listHistoryByKind(
  kind: HistoryRecord["kind"],
  limit = 100
): Promise<Array<{ file: string; record: HistoryRecord }>> {
  const all = await listHistory(limit * 5); // overshoot
  return all.filter((r) => r.record.kind === kind).slice(-limit);
}

// ─── 보조: 특정 symbol 필터 (order/analysis) ──────────────────
export async function listHistoryBySymbol(
  symbol: string,
  limit = 50
): Promise<Array<{ file: string; record: HistoryRecord }>> {
  const all = await listHistory(limit * 5);
  return all
    .filter((r) => {
      const rec = r.record;
      if (rec.kind === "analysis") return rec.symbol === symbol;
      if (rec.kind === "order") return rec.request.symbol === symbol;
      return false; // snapshot은 holdings에 포함 여부
    })
    .slice(-limit);
}

// ─── 보조: 환경별 가용성 체크 ────────────────────────────────
export type HistoryAvailability = "available" | "readonly" | "disabled";

/**
 * Vercel 같은 read-only filesystem에서 호출하면 "readonly",
 * fs 자체를 못 쓰면 "disabled", 정상 = "available".
 * UI에서 "이력 저장 가능 여부" 표시용.
 */
export async function checkHistoryAvailability(): Promise<HistoryAvailability> {
  try {
    await ensureHistoryDir();
    const testFile = path.join(getHistoryDir(), ".write-test");
    await fs.writeFile(testFile, "test", { flag: "wx" });
    await fs.unlink(testFile).catch(() => undefined);
    return "available";
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EROFS" || code === "EPERM") {
      return "readonly";
    }
    return "disabled";
  }
}
