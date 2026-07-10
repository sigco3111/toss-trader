/**
 * lib/storage/index.ts — toss-trader storage provider factory (v1.3)
 *
 * STORAGE_PROVIDER env:
 * - "local" (기본): LocalStorageProvider (kstost/stock 패턴, dev/local)
 * - "s3": S3StorageProvider (AWS S3 / Cloudflare R2)
 *
 * 사용 예:
 *   import { getStorage } from "@/lib/storage";
 *   const storage = getStorage();
 *   const result = await storage.save(record);
 */

import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./provider";

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "s3") {
    cached = new S3StorageProvider();
  } else {
    cached = new LocalStorageProvider();
  }
  return cached;
}

/** provider 강제 교체 (테스트용) */
export function _setStorage(provider: StorageProvider | null): void {
  cached = provider;
}

export type { StorageProvider, StorageAvailability } from "./provider";
export { LocalStorageProvider } from "./local";
export { S3StorageProvider } from "./s3";
