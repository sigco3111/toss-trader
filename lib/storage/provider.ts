/**
 * lib/storage/provider.ts — toss-trader StorageProvider 추상화 (v1.3)
 *
 * 영구 history 저장을 위한 storage provider 추상 인터페이스.
 * - LocalProvider: 기존 history.ts (로컬 JSON, kstost 패턴)
 * - S3Provider: AWS S3 / Cloudflare R2 (S3 호환 API)
 *
 * v1.3: Vercel serverless filesystem read-only 제약 극복.
 *        외부 storage 활성화 시 영구 history.
 */

import type { HistoryRecord } from "../types";

export type StorageAvailability = "available" | "readonly" | "disabled";

export interface ListOptions {
  kind?: HistoryRecord["kind"];
  symbol?: string;
  limit?: number;
}

export interface SaveResult {
  saved: boolean;
  filename: string;
  availability: StorageAvailability;
  message?: string;
}

export interface ListResult {
  records: Array<{ file: string; record: HistoryRecord }>;
  count: number;
  availability: StorageAvailability;
  message?: string;
}

export interface AvailabilityResult {
  availability: StorageAvailability;
  message?: string;
}

/**
 * StorageProvider 인터페이스 (모든 provider 구현 필수)
 */
export interface StorageProvider {
  /** provider 식별자 */
  readonly name: "local" | "s3";

  /** 가용성 확인 (available / readonly / disabled) */
  checkAvailability(): Promise<AvailabilityResult>;

  /** 1 record 저장 */
  save(record: HistoryRecord): Promise<SaveResult>;

  /** 목록 조회 (kind/symbol 필터 + limit) */
  list(options?: ListOptions): Promise<ListResult>;
}
