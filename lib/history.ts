/**
 * lib/history.ts — toss-trader 이력 저장 facade (v1.3)
 *
 * v1.3: STORAGE_PROVIDER env로 local/s3 선택.
 *   - "local" (기본): LocalStorageProvider (kstost/stock 패턴, dev/local)
 *   - "s3": S3StorageProvider (AWS S3 / Cloudflare R2)
 *
 * facade 패턴: 기존 함수 시그니처 (writeHistory, listHistory 등) 유지.
 * 내부적으로 getStorage() provider에 위임.
 */

import type { HistoryRecord } from "./types";
import { getStorage } from "./storage";

export const TELEGRAM_CONFIRM_TTL_SEC = 300; // re-export from telegram.ts (back-compat)

export type { HistoryRecord } from "./types";

/**
 * 디렉토리 보장 (back-compat — 기존 export)
 * @deprecated v1.3: storage provider가 처리. 이 함수는 noop.
 */
export async function ensureHistoryDir(): Promise<void> {
  // v1.3: storage provider가 내부 처리. facade 유지만.
  await getStorage().checkAvailability();
}

/**
 * history 디렉토리 (back-compat)
 * @deprecated v1.3: storage provider 내부 경로
 */
export function getHistoryDir(): string {
  // v1.3: facade. local provider는 process.cwd()/history
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  return path.join(process.cwd(), "history");
}

/**
 * 가용성 확인 (3-state → back-compat + 4-state v1.3)
 */
export type HistoryAvailability = "available" | "readonly" | "disabled";

export async function checkHistoryAvailability(): Promise<HistoryAvailability> {
  return (await getStorage().checkAvailability()).availability;
}

// ─── writeHistory (back-compat facade) ──────────────────────
export async function writeHistory(record: HistoryRecord): Promise<string> {
  const result = await getStorage().save(record);
  if (!result.saved) {
    throw new Error(
      `History 저장 실패: ${result.message ?? result.availability}`
    );
  }
  return result.filename;
}

// ─── listHistory (back-compat facade) ──────────────────────
export async function listHistory(limit = 100): Promise<
  Array<{ file: string; record: HistoryRecord }>
> {
  const result = await getStorage().list({ limit });
  return result.records;
}

// ─── v1.3: storage-aware variants ──────────────────────
export async function listHistoryByKind(
  kind: HistoryRecord["kind"],
  limit = 100
): Promise<Array<{ file: string; record: HistoryRecord }>> {
  const result = await getStorage().list({ kind, limit });
  return result.records;
}

export async function listHistoryBySymbol(
  symbol: string,
  limit = 50
): Promise<Array<{ file: string; record: HistoryRecord }>> {
  const result = await getStorage().list({ symbol, limit });
  return result.records;
}

// ─── back-compat: 테스트용 _resetPendingStore ──────────────
export function _resetPendingStore(): void {
  // v1.3: history는 filesystem → 별도 reset 불필요
  // 호환성 위해 noop 함수로 유지
}
