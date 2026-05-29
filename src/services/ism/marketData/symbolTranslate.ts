/**
 * Provider-specific symbol translation (v1: conservative MIC-style guesses only where documented).
 *
 * EODHD expects instruments as `CODE.EXCHANGE`, e.g. `AAPL.US`, `VOW3.ST`, `BP.LSE`, `EURUSD.FOREX`.
 * Unknown exchange defaults to `.US` here (see notes on returned symbol).
 *
 * @see https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis
 * @see https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours
 */

import type { IsmMarketProviderId, SymbolTranslationContext } from './types';
import { eodhdSymbolFromIsmSlugs } from './eodhdExchangeResolve';

function upperSymbol(slug: string): string {
  return slug.replace(/_/g, '-').toUpperCase();
}

/**
 * EODHD uses TICKER.EXCHANGE (e.g. AAPL.US, MC.PA). Exchange `Code` values follow
 * EODHD’s exchanges-list; Yahoo-style sheet prefixes are aliased in `eodhdExchangeSlugAliases.ts`.
 * Unknown exchange still defaults to `.US` (see `eodhdSymbolFromIsmSlugs`).
 */
export function toEodhdSymbol(ctx: SymbolTranslationContext): { symbol: string; notes: string[] } {
  return eodhdSymbolFromIsmSlugs(ctx.symbolSlug, ctx.exchangeSlug);
}

export function toAlphaVantageSymbol(ctx: SymbolTranslationContext): { symbol: string; notes: string[] } {
  const sym = upperSymbol(ctx.symbolSlug).replace(/-/g, '.');
  const notes: string[] = [];
  if (ctx.exchangeSlug === 'unknown') {
    notes.push('alpha_vantage_plain_ticker');
  }
  return { symbol: sym, notes };
}

/** Marketstack v1: `TICKER` only (exchange not encoded aggressively). */
export function toMarketstackSymbol(ctx: SymbolTranslationContext): { symbol: string; notes: string[] } {
  return { symbol: upperSymbol(ctx.symbolSlug), notes: [] };
}

/** Finnhub: US symbols often plain ticker; non-US may need exchange prefix — keep minimal v1. */
export function toFinnhubSymbol(ctx: SymbolTranslationContext): { symbol: string; notes: string[] } {
  const sym = upperSymbol(ctx.symbolSlug);
  const notes: string[] = [];
  if (ctx.exchangeSlug === 'unknown') {
    notes.push('finnhub_us_plain_ticker_assumption');
  }
  return { symbol: sym, notes };
}

export function translateForProvider(
  providerId: IsmMarketProviderId,
  ctx: SymbolTranslationContext
): { symbol: string; notes: string[] } {
  switch (providerId) {
    case 'eodhd':
      return toEodhdSymbol(ctx);
    case 'alpha_vantage':
      return toAlphaVantageSymbol(ctx);
    case 'marketstack':
      return toMarketstackSymbol(ctx);
    case 'finnhub':
      return toFinnhubSymbol(ctx);
    default:
      return { symbol: upperSymbol(ctx.symbolSlug), notes: ['unknown_provider'] };
  }
}
