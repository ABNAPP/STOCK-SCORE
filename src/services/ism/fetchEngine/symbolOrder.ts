import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import { ISM_BOOTSTRAP_TOP_MARKET_CAP_COUNT } from './constants';

function fingerprintUniverse(rows: ISMInstrumentIngest[]): string {
  if (rows.length === 0) return '0';
  return `${rows.length}:${rows[0]!.symbolId}:${rows[rows.length - 1]!.symbolId}`;
}

/**
 * Bootstrap priority:
 * 1) Top 30 by market cap (numeric, descending; nulls excluded from top band)
 * 2) Other "qualified" (no missing ticker/sector, no ticker parse review)
 * 3) Problem cases last
 */
export function computeBootstrapSymbolOrder(rows: ISMInstrumentIngest[]): {
  orderedSymbolIds: string[];
  fingerprint: string;
} {
  const fp = fingerprintUniverse(rows);
  const withCap = rows
    .filter((r) => r.marketCap !== null && r.marketCap !== undefined && Number.isFinite(r.marketCap))
    .sort((a, b) => (b.marketCap as number) - (a.marketCap as number));
  const top = withCap.slice(0, ISM_BOOTSTRAP_TOP_MARKET_CAP_COUNT).map((r) => r.symbolId);
  const topSet = new Set(top);

  const rest = rows.filter((r) => !topSet.has(r.symbolId));
  const qualified = rest
    .filter((r) => !r.quality.missingTicker && !r.quality.missingSector && !r.quality.tickerNeedsReview)
    .map((r) => r.symbolId);
  const qualSet = new Set(qualified);
  const problems = rest.filter((r) => !qualSet.has(r.symbolId)).map((r) => r.symbolId);

  const merged = [...top, ...qualified, ...problems];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return { orderedSymbolIds: ordered, fingerprint: fp };
}
