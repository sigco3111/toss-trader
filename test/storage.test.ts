/**
 * test/storage.test.ts — toss-trader storage provider TDD (v1.3)
 *
 * LocalStorageProvider + S3StorageProvider 기본 동작.
 * - Local: 실제 filesystem (kstost/stock 패턴)
 * - S3: network 없으면 disabled (CI 등)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStorageProvider, S3StorageProvider } from "@/lib/storage";

describe("LocalStorageProvider", () => {
  let originalCwd: string;
  let testDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `toss-storage-test-${process.pid}-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("name === 'local'", () => {
    const p = new LocalStorageProvider();
    expect(p.name).toBe("local");
  });

  it("checkAvailability → 'available' (filesystem read-write)", async () => {
    const p = new LocalStorageProvider();
    const r = await p.checkAvailability();
    expect(r.availability).toBe("available");
  });

  it("save 1 record → 1 JSON 파일", async () => {
    const p = new LocalStorageProvider();
    const record = {
      kind: "order" as const,
      epochSeconds: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
      orderId: "order_test_1",
      request: { symbol: "005930", side: "BUY" as const, quantity: 10, price: 70000, orderType: "LIMIT" as const, telegramConfirmed: true },
      response: { ok: true, httpStatus: 200, body: { mock: true } },
    };
    const r = await p.save(record);
    expect(r.saved).toBe(true);
    expect(r.filename).toBe("1000.json");
    expect(r.availability).toBe("available");
    // 파일 존재 확인
    const content = await fs.readFile(path.join(testDir, "history", "1000.json"), "utf8");
    expect(JSON.parse(content).kind).toBe("order");
  });

  it("save 같은 epoch 두 번 → counter suffix", async () => {
    const p = new LocalStorageProvider();
    const rec = {
      kind: "order" as const,
      epochSeconds: 2000,
      createdAt: "",
      orderId: "a",
      request: { symbol: "005930", side: "BUY" as const, quantity: 1, price: 1, orderType: "LIMIT" as const, telegramConfirmed: true },
      response: { ok: true, httpStatus: 200, body: {} },
    };
    const r1 = await p.save(rec);
    const r2 = await p.save(rec);
    expect(r1.filename).toBe("2000.json");
    expect(r2.filename).toBe("2000-2.json");
  });

  it("list → 빈 배열 (filesystem 비어있음)", async () => {
    const p = new LocalStorageProvider();
    const r = await p.list();
    expect(r.records).toEqual([]);
    expect(r.count).toBe(0);
    expect(r.availability).toBe("available");
  });

  it("list → symbol/kind 필터", async () => {
    const p = new LocalStorageProvider();
    await p.save({
      kind: "order",
      epochSeconds: 3000,
      createdAt: "",
      orderId: "a",
      request: { symbol: "005930", side: "BUY", quantity: 1, price: 1, orderType: "LIMIT", telegramConfirmed: true },
      response: { ok: true, httpStatus: 200, body: {} },
    });
    await p.save({
      kind: "snapshot",
      epochSeconds: 3001,
      createdAt: "",
      accountSeq: 1,
      totalEval: 100,
      totalInvested: 100,
      totalPnL: 0,
      totalPnLRate: 0,
      holdings: [],
    });
    const orders = await p.list({ kind: "order" });
    expect(orders.records).toHaveLength(1);
    expect(orders.records[0]?.record.kind).toBe("order");
  });
});

describe("S3StorageProvider", () => {
  it("name === 's3'", () => {
    const p = new S3StorageProvider();
    expect(p.name).toBe("s3");
  });

  it("env 없음 → checkAvailability 'disabled' + 메시지", async () => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
    const p = new S3StorageProvider();
    const r = await p.checkAvailability();
    expect(r.availability).toBe("disabled");
    expect(r.message).toContain("S3 미설정");
  });
});
