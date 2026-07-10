"use client";

/**
 * components/StockSearch.tsx — 종목 검색 + 자동완성 dropdown
 *
 * 토스 Open API는 종목 검색 endpoint 없음 → 정적 마스터 (lib/stocks.ts 50개)
 * + 클라이언트 사이드 fuzzy 검색 (debounce 200ms).
 *
 * 동작:
 *   1. 사용자가 이름 또는 symbol 일부 입력
 *   2. 200ms debounce 후 `searchStocks()` 결과로 dropdown 표시
 *   3. 화살표/Enter/Escape로 키보드 네비
 *   4. 선택 시 onSelect(symbol, name, market) 호출 → 부모가 targetSymbol/targetMarket 갱신
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchStocks, type Market, type StockMaster } from "@/lib/stocks";

interface StockSearchProps {
  onSelect: (symbol: string, name: string, market: Market) => void;
  defaultSymbol?: string;
  defaultName?: string;
  /** KR/US 마켓 필터. 미지정 시 전체. */
  marketFilter?: Market;
}

export function StockSearch({
  onSelect,
  defaultSymbol = "005930",
  defaultName = "삼성전자",
  marketFilter,
}: StockSearchProps) {
  const [query, setQuery] = useState<string>(defaultName);
  const [results, setResults] = useState<StockMaster[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [highlight, setHighlight] = useState<number>(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced search (200ms) — only runs while the dropdown is logically open
  // or the user has typed something.
  useEffect(() => {
    const timer = setTimeout(() => {
      const r = searchStocks(query, 10, marketFilter);
      setResults(r);
      setHighlight(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, marketFilter]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (s: StockMaster) => {
      setQuery(s.name);
      setOpen(false);
      onSelect(s.symbol, s.name, s.market);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) handleSelect(results[highlight]);
      else setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (!open) {
      setOpen(true);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="stock-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="종목명 또는 symbol 입력 (예: 삼성전자, NVDA, 005930)"
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-card shadow-lg text-sm"
        >
          {results.map((s, i) => (
            <li
              key={s.symbol}
              role="option"
              aria-selected={i === highlight}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer border-b px-3 py-2 last:border-b-0 ${
                i === highlight
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{s.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {s.symbol}{" "}
                  <span className="ml-1 rounded border px-1 text-[10px]">
                    {s.market}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.length > 0 && results.length === 0 ? (
        <div
          role="status"
          className="absolute z-20 mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg"
        >
          &quot;{query}&quot;에 해당하는 종목이 마스터에 없습니다. 직접 symbol을
          입력해 시작할 수 있습니다.
        </div>
      ) : null}

      {/* Visually hidden hint for screen readers */}
      <span className="sr-only">
        종목 검색. 화살표 키로 결과 탐색, Enter로 선택, Escape로 닫기.
        {defaultSymbol ? ` 기본값: ${defaultName} (${defaultSymbol})` : ""}
      </span>
    </div>
  );
}
