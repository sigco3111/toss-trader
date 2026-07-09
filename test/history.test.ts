/**
 * test/history.test.ts — toss-trader 이력 저장 TDD (6단계, kstost 패턴)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import {
  writeHistory,
  listHistory,
  listHistoryByKind,
  listHistoryBySymbol,
  checkHistoryAvailability,
  getHistoryDir,
} from "@/lib/history";
import type { HistoryRecord, AnalysisHistoryRecord, OrderHistoryRecord, SnapshotHistoryRecord } from "@/lib/types";

// ─── 격리: 임시 디렉토리 사용 ─────────────────────────────────
import os from "node:os";

const TEST_DIR = path.join(os.tmpdir(), `toss-trader-test-${process.pid}-${Date.now()}`);

beforeEach(async () => {
  // process.cwd()를 임시 디렉토리로 변경
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  process.chdir(os.tmpdir());
  await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => undefined);
});

// ─── 팩토리 헬퍼 ──────────────────────────────────────────────
function makeAnalysis(epoch: number, symbol: string): AnalysisHistoryRecord {
  return {
    kind: "analysis",
    epochSeconds: epoch,
    createdAt: new Date(epoch * 1000).toISOString(),
    symbol,
    recommendation: {
      symbol,
      market: "KR",
      decision: { action: "BUY", confidence: 0.85, reason: "test" },
      order: { quantity: 10, limitPrice: 70000, currency: "KRW" },
      references: [],
    },
    rawAssistantMessage: "OpenCode 응답 (mock)",
  };
}

function makeOrder(epoch: number, symbol: string, side: "BUY" | "SELL" = "BUY"): OrderHistoryRecord {
  return {
    kind: "order",
    epochSeconds: epoch,
    createdAt: new Date(epoch * 1000).toISOString(),
    orderId: `order_${epoch}_${side}`,
    request: { symbol, side, quantity: 10, price: 70000, orderType: "LIMIT", telegramConfirmed: true },
    response: { ok: true, httpStatus: 200, body: { data: { mock: true } } },
  };
}

function makeSnapshot(epoch: number): SnapshotHistoryRecord {
  return {
    kind: "snapshot",
    epochSeconds: epoch,
    createdAt: new Date(epoch * 1000).toISOString(),
    accountSeq: 1,
    totalEval: 700000,
    totalInvested: 700000,
    totalPnL: 0,
    totalPnLRate: 0,
    holdings: [{ symbol: "005930", quantity: 10, avgPrice: 70000, currentPrice: 70000, pnl: 0, pnlRate: 0 }],
  };
}

// ─── writeHistory ────────────────────────────────────────────
describe("writeHistory", () => {
  it("analysis 기록 → history/<epoch>.json 파일 생성", async () => {
    const record = makeAnalysis(1752123456, "005930");
    const filename = await writeHistory(record);
    expect(filename).toBe("1752123456.json");
    const target = path.join(getHistoryDir(), filename);
    const content = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(content) as HistoryRecord;
    expect(parsed.kind).toBe("analysis");
    expect(parsed.symbol).toBe("005930");
  });

  it("order 기록 → 정상 저장", async () => {
    const record = makeOrder(1752123500, "005930", "SELL");
    const filename = await writeHistory(record);
    const content = await fs.readFile(path.join(getHistoryDir(), filename), "utf8");
    const parsed = JSON.parse(content) as HistoryRecord;
    expect(parsed.kind).toBe("order");
    expect(parsed.request.side).toBe("SELL");
  });

  it("snapshot 기록 → 정상 저장", async () => {
    const record = makeSnapshot(1752123600);
    const filename = await writeHistory(record);
    const content = await fs.readFile(path.join(getHistoryDir(), filename), "utf8");
    const parsed = JSON.parse(content) as HistoryRecord;
    expect(parsed.kind).toBe("snapshot");
    expect(parsed.totalEval).toBe(700000);
  });

  it("같은 epoch에 두 번 쓰기 → counter suffix", async () => {
    const a = makeAnalysis(1752123456, "005930");
    const b = makeOrder(1752123456, "000660");
    const fn1 = await writeHistory(a);
    const fn2 = await writeHistory(b);
    expect(fn1).toBe("1752123456.json");
    expect(fn2).toBe("1752123456-2.json");
  });

  it("시크릿 필드 (apiKey/secretKey) 자동 제거 안 됨 (v0.3: 호출자 책임)", async () => {
    // v0.3 단순화: 시크릿 격리는 호출자(API route/UI) 책임.
    // lib/history.ts는 단순 저장/조회. deep-clone + strip은 v0.5+ TODO.
    // 이 테스트는 "시크릿이 들어가 있어도 저장은 됨 (v0.3 의도)"을 확인.
    const dirty = {
      kind: "order" as const,
      epochSeconds: 1752123456,
      createdAt: new Date().toISOString(),
      orderId: "order_test",
      request: { symbol: "005930", side: "BUY" as const, quantity: 10, price: 70000, orderType: "LIMIT" as const, telegramConfirmed: true },
      response: { ok: true, httpStatus: 200, body: { apiKey: "sk-leak", secretKey: "ssn-leak" } },
    };
    const filename = await writeHistory(dirty);
    const content = await fs.readFile(path.join(getHistoryDir(), filename), "utf8");
    // v0.3: 시크릿 그대로 저장됨 (의도된 단순화). 호출자가 시크릿 빼야 함.
    expect(content).toContain("sk-leak");
    expect(content).toContain("ssn-leak");
  });
});

// ─── listHistory ────────────────────────────────────────────
describe("listHistory", () => {
  it("빈 디렉토리 → 빈 배열", async () => {
    const list = await listHistory();
    expect(list).toEqual([]);
  });

  it("오름차순 정렬 + 최근 limit개", async () => {
    await writeHistory(makeAnalysis(1000, "005930"));
    await writeHistory(makeAnalysis(2000, "005930"));
    await writeHistory(makeAnalysis(3000, "000660"));
    const list = await listHistory(2);
    expect(list).toHaveLength(2);
    expect(list[0]?.file).toBe("2000.json");
    expect(list[1]?.file).toBe("3000.json");
  });

  it("JSON 아닌 파일 (.txt 등) 무시", async () => {
    await writeHistory(makeAnalysis(1000, "005930"));
    await fs.writeFile(path.join(getHistoryDir(), "README.txt"), "ignore me");
    const list = await listHistory();
    expect(list).toHaveLength(1);
    expect(list[0]?.file).toBe("1000.json");
  });
});

// ─── listHistoryByKind ─────────────────────────────────────
describe("listHistoryByKind", () => {
  it("order만 필터링", async () => {
    await writeHistory(makeAnalysis(1000, "005930"));
    await writeHistory(makeOrder(2000, "005930"));
    await writeHistory(makeSnapshot(3000));
    const orders = await listHistoryByKind("order");
    expect(orders).toHaveLength(1);
    expect(orders[0]?.record.kind).toBe("order");
  });
});

// ─── listHistoryBySymbol ───────────────────────────────────
describe("listHistoryBySymbol", () => {
  it("005930 관련 기록만", async () => {
    await writeHistory(makeAnalysis(1000, "005930"));
    await writeHistory(makeOrder(2000, "005930", "BUY"));
    await writeHistory(makeAnalysis(3000, "000660"));
    await writeHistory(makeOrder(4000, "000660", "SELL"));
    const list = await listHistoryBySymbol("005930");
    expect(list).toHaveLength(2);
  });
});

// ─── checkHistoryAvailability ──────────────────────────────
describe("checkHistoryAvailability", () => {
  it("쓰기 가능 환경 → 'available'", async () => {
    const r = await checkHistoryAvailability();
    expect(r).toBe("available");
  });

  it("historyDir이 readonly (chmod 555) → 'readonly'", async () => {
    // 임시 디렉토리를 readonly로 만들고 그 안에서 테스트
    const RO_DIR = path.join(os.tmpdir(), `toss-trader-ro-${process.pid}`);
    await fs.rm(RO_DIR, { recursive: true, force: true });
    await fs.mkdir(RO_DIR, { recursive: true });
    await fs.chmod(RO_DIR, 0o555); // read+execute only
    process.chdir(RO_DIR);
    try {
      const r = await checkHistoryAvailability();
      expect(r).toBe("readonly");
    } finally {
      await fs.chmod(RO_DIR, 0o755);
      await fs.rm(RO_DIR, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
