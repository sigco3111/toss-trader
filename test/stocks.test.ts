/**
 * test/stocks.test.ts — toss-trader 종목 마스터 + 검색 TDD
 */

import { describe, it, expect } from "vitest";
import { STOCK_MASTER, searchStocks, findBySymbol } from "@/lib/stocks";

describe("STOCK_MASTER", () => {
  it("최소 30개 종목 (KOSPI 시총 상위)", () => {
    expect(STOCK_MASTER.length).toBeGreaterThanOrEqual(30);
  });

  it("모든 종목 symbol이 unique", () => {
    const symbols = STOCK_MASTER.map((s) => s.symbol);
    const unique = new Set(symbols);
    expect(unique.size).toBe(symbols.length);
  });

  it("모든 종목에 name과 market 존재", () => {
    for (const s of STOCK_MASTER) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(["KR", "US"]).toContain(s.market);
    }
  });

  it("삼성전자 (005930) 포함", () => {
    expect(findBySymbol("005930")?.name).toBe("삼성전자");
  });
});

describe("searchStocks", () => {
  it("빈 query → 기본 10개", () => {
    const r = searchStocks("");
    expect(r).toHaveLength(10);
    expect(r[0]?.symbol).toBe("005930"); // 첫 번째 종목
  });

  it("정확한 symbol 매치 (005930) → 1개", () => {
    const r = searchStocks("005930");
    expect(r).toHaveLength(1);
    expect(r[0]?.name).toBe("삼성전자");
  });

  it("이름 prefix '삼성' → 삼성 계열 4개", () => {
    const r = searchStocks("삼성");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.name.startsWith("삼성"))).toBe(true);
  });

  it("이름 contains '하이닉스' → SK하이닉스", () => {
    const r = searchStocks("하이닉스");
    expect(r).toHaveLength(1);
    expect(r[0]?.name).toBe("SK하이닉스");
  });

  it("공백 trim + 소문자 정규화 (대소문자 무시)", () => {
    const a = searchStocks("NAVER");
    const b = searchStocks("naver");
    expect(a[0]?.symbol).toBe(b[0]?.symbol);
  });

  it("공백 trim ('  삼성  ' → '삼성')", () => {
    const r = searchStocks("  삼성  ");
    expect(r.length).toBeGreaterThan(0);
  });

  it("매칭 없음 → 빈 배열", () => {
    const r = searchStocks("없는종목XYZ");
    expect(r).toEqual([]);
  });

  it("limit 5 → 최대 5개", () => {
    const r = searchStocks("", 5);
    expect(r).toHaveLength(5);
  });
});

describe("findBySymbol", () => {
  it("005930 → 삼성전자", () => {
    expect(findBySymbol("005930")?.name).toBe("삼성전자");
  });

  it("없는 symbol → undefined", () => {
    expect(findBySymbol("999999")).toBeUndefined();
  });
});
