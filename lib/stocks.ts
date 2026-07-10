/**
 * lib/stocks.ts — toss-trader 정적 종목 마스터 (v1.1 → 2026-07-10 갱신)
 *
 * 토스 Open API는 종목 검색 endpoint 없음 (symbol 코드 정확 조회만).
 * → KOSPI 시가총액 상위 + KR/US 대형주 50개를 정적으로 보관.
 * → 클라이언트 사이드 fuzzy 검색 (서버 호출 0).
 *
 * 업데이트 시: 새 종목 추가만 하면 됨 (마이그레이션 불필요).
 */

export type Market = "KR" | "US";

export interface StockMaster {
  /** 토스 symbol (KR 6자리 숫자 / US 영문 티커) */
  symbol: string;
  /** 종목명 (한글 또는 영문) */
  name: string;
  market: Market;
}

// KOSPI 시가총액 상위 + 대형주 30개 (2026-07-09 기준)
export const STOCK_MASTER: StockMaster[] = [
  // ─── KOSPI 시가총액 상위 ───
  { symbol: "005930", name: "삼성전자", market: "KR" },
  { symbol: "000660", name: "SK하이닉스", market: "KR" },
  { symbol: "035420", name: "NAVER", market: "KR" },
  { symbol: "005490", name: "POSCO홀딩스", market: "KR" },
  { symbol: "051910", name: "LG화학", market: "KR" },
  { symbol: "006400", name: "삼성SDI", market: "KR" },
  { symbol: "028260", name: "삼성물산", market: "KR" },
  { symbol: "012330", name: "현대모비스", market: "KR" },
  { symbol: "005380", name: "현대차", market: "KR" },
  { symbol: "066570", name: "LG전자", market: "KR" },
  { symbol: "003550", name: "LG", market: "KR" },
  { symbol: "034730", name: "SK", market: "KR" },
  { symbol: "015760", name: "한국전력", market: "KR" },
  { symbol: "017670", name: "SK텔레콤", market: "KR" },
  { symbol: "030200", name: "KT", market: "KR" },
  { symbol: "032830", name: "삼성생명", market: "KR" },
  { symbol: "086790", name: "하나금융지주", market: "KR" },
  { symbol: "105560", name: "KB금융", market: "KR" },
  { symbol: "055550", name: "신한지주", market: "KR" },
  { symbol: "316140", name: "우리금융지주", market: "KR" },
  { symbol: "024110", name: "기업은행", market: "KR" },
  { symbol: "000810", name: "삼성화재", market: "KR" },
  { symbol: "002790", name: "아모레퍼시픽", market: "KR" },
  { symbol: "090430", name: "아모레G", market: "KR" },
  { symbol: "051900", name: "LG생활건강", market: "KR" },
  { symbol: "033780", name: "KT&G", market: "KR" },
  { symbol: "010130", name: "고려아연", market: "KR" },
  { symbol: "011170", name: "롯데케미칼", market: "KR" },
  { symbol: "009150", name: "삼성전기", market: "KR" },
  { symbol: "035720", name: "카카오", market: "KR" },
  { symbol: "000270", name: "기아", market: "KR" },

  // ─── US 대형주 (시총 상위 + 인기) ───
  { symbol: "AAPL", name: "Apple", market: "US" },
  { symbol: "MSFT", name: "Microsoft", market: "US" },
  { symbol: "NVDA", name: "NVIDIA", market: "US" },
  { symbol: "GOOGL", name: "Alphabet (Class A)", market: "US" },
  { symbol: "GOOG", name: "Alphabet (Class C)", market: "US" },
  { symbol: "AMZN", name: "Amazon", market: "US" },
  { symbol: "META", name: "Meta Platforms", market: "US" },
  { symbol: "TSLA", name: "Tesla", market: "US" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", market: "US" },
  { symbol: "JPM", name: "JPMorgan Chase", market: "US" },
  { symbol: "V", name: "Visa", market: "US" },
  { symbol: "JNJ", name: "Johnson & Johnson", market: "US" },
  { symbol: "WMT", name: "Walmart", market: "US" },
  { symbol: "PG", name: "Procter & Gamble", market: "US" },
  { symbol: "MA", name: "Mastercard", market: "US" },
  { symbol: "HD", name: "Home Depot", market: "US" },
  { symbol: "CVX", name: "Chevron", market: "US" },
  { symbol: "DIS", name: "Walt Disney", market: "US" },
  { symbol: "BAC", name: "Bank of America", market: "US" },
  { symbol: "NFLX", name: "Netflix", market: "US" },
];

// ─── 검색 함수 (fuzzy match) ──────────────────────────────────
/**
 * 종목 검색 (이름 or symbol)
 * - 입력 정규화: 공백 제거, 소문자, NFC
 * - symbol 정확 매치 > 이름 시작 매치 > 이름 부분 매치
 * - limit 기본 10
 * - marketFilter로 KR/US만 보이게 제한 가능
 */
export function searchStocks(
  query: string,
  limit = 10,
  marketFilter?: Market,
): StockMaster[] {
  const q = normalize(query);
  const candidates = marketFilter
    ? STOCK_MASTER.filter((s) => s.market === marketFilter)
    : STOCK_MASTER;

  if (!q) return candidates.slice(0, limit);

  // 1) symbol 정확 매치
  const exactSymbol = candidates.filter((s) => s.symbol === q);
  if (exactSymbol.length > 0) return exactSymbol;

  // 2) symbol 부분 매치 (티커 prefix 검색, 예: "NVD" → NVDA)
  const symbolContains = candidates.filter((s) =>
    s.symbol.toLowerCase().includes(q),
  );
  if (symbolContains.length > 0) return symbolContains.slice(0, limit);

  // 3) 이름 시작 매치 (prefix)
  const prefixMatch = candidates.filter((s) => normalize(s.name).startsWith(q));
  if (prefixMatch.length > 0) return prefixMatch.slice(0, limit);

  // 4) 이름 부분 매치 (contains)
  const containsMatch = candidates.filter((s) => normalize(s.name).includes(q));
  return containsMatch.slice(0, limit);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFC");
}

// ─── symbol로 찾기 (보너스) ──────────────────────────────────
export function findBySymbol(symbol: string): StockMaster | undefined {
  return STOCK_MASTER.find((s) => s.symbol === symbol);
}
