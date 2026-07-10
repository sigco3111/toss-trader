/**
 * lib/storage/local.ts — toss-trader LocalStorageProvider (v1.3)
 *
 * 기존 lib/history.ts 로직을 StorageProvider 인터페이스로 래핑.
 * 파일 시스템 기반 (kstost/stock 패턴):
 * - history/<epochSeconds>.json (1 record = 1 file)
 * - 충돌 시 -2, -3, ... counter suffix
 *
 * 동작 환경:
 * - dev/local: 정상 (filesystem read-write)
 * - Vercel: readonly 또는 disabled (filesystem read-only + ephemeral)
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { HistoryRecord } from "../types";
import type {
  StorageProvider,
  AvailabilityResult,
  SaveResult,
  ListResult,
  ListOptions,
} from "./provider";

function getHistoryDir(): string {
  return path.join(process.cwd(), "history");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(getHistoryDir(), { recursive: true });
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;

  async checkAvailability(): Promise<AvailabilityResult> {
    try {
      await ensureDir();
      const testFile = path.join(getHistoryDir(), ".write-test");
      await fs.writeFile(testFile, "test", { flag: "wx" });
      await fs.unlink(testFile).catch(() => undefined);
      return { availability: "available" };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EACCES" || code === "EROFS" || code === "EPERM") {
        return {
          availability: "readonly",
          message:
            "Vercel 등 read-only filesystem: history 저장 비활성화. dev/local 또는 외부 storage 필요.",
        };
      }
      return {
        availability: "disabled",
        message: `filesystem 오류로 history 사용 불가: ${(e as Error).message}`,
      };
    }
  }

  async save(record: HistoryRecord): Promise<SaveResult> {
    const availability = (await this.checkAvailability()).availability;
    if (availability !== "available") {
      return {
        saved: false,
        filename: "",
        availability,
      };
    }

    const base = `${record.epochSeconds}.json`;
    let filename = base;
    let counter = 2;
    while (true) {
      const target = path.join(getHistoryDir(), filename);
      try {
        await fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, {
          flag: "wx",
        });
        return { saved: true, filename, availability: "available" };
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") throw e;
        filename = `${record.epochSeconds}-${counter}.json`;
        counter += 1;
      }
    }
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const availability = (await this.checkAvailability()).availability;
    if (availability !== "available") {
      return { records: [], count: 0, availability };
    }
    const limit = options.limit ?? 100;
    const files = await fs.readdir(getHistoryDir());
    const jsonFiles = files
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .slice(-limit);

    const records = await Promise.all(
      jsonFiles.map(async (file) => {
        const raw = await fs.readFile(path.join(getHistoryDir(), file), "utf8");
        return { file, record: JSON.parse(raw) as HistoryRecord };
      })
    );

    let filtered = records;
    if (options.kind) {
      filtered = filtered.filter((r) => r.record.kind === options.kind);
    }
    if (options.symbol) {
      filtered = filtered.filter((r) => {
        const rec = r.record;
        if (rec.kind === "analysis") return rec.symbol === options.symbol;
        if (rec.kind === "order") return rec.request.symbol === options.symbol;
        return false;
      });
    }

    return { records: filtered, count: filtered.length, availability: "available" };
  }
}
