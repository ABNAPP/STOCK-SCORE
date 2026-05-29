import { canonicalEodhdExchangeCode } from './eodhdExchangeGenerated';
import { ISM_EXCHANGE_SLUG_TO_EODHD_CODE } from './eodhdExchangeSlugAliases';

const US_EXCHANGES = new Set(['nyse', 'nasdaq', 'amex', 'bats', 'otc', 'us']);

function upperSymbol(slug: string): string {
  return slug.replace(/_/g, '-').toUpperCase();
}

/**
 * Builds EODHD `SYMBOL.EXCHANGE` from ISM symbol/exchange slugs (see `buildSymbolTranslationContext`).
 */
export function eodhdSymbolFromIsmSlugs(symbolSlug: string, exchangeSlug: string): { symbol: string; notes: string[] } {
  const sym = upperSymbol(symbolSlug);
  const notes: string[] = [];
  const ex = exchangeSlug.toLowerCase();

  if (ex === 'unknown') {
    notes.push('eodhd_default_us_suffix');
    return { symbol: `${sym}.US`, notes };
  }
  if (US_EXCHANGES.has(ex)) {
    return { symbol: `${sym}.US`, notes };
  }
  if (ex === 'sto' || ex === 'ome' || ex === 'ngm') {
    return { symbol: `${sym}.ST`, notes };
  }

  const aliasCode = ISM_EXCHANGE_SLUG_TO_EODHD_CODE[ex];
  if (aliasCode) {
    notes.push('eodhd_slug_alias');
    return { symbol: `${sym}.${aliasCode}`, notes };
  }

  const canon = canonicalEodhdExchangeCode(ex);
  if (canon) {
    return { symbol: `${sym}.${canon}`, notes };
  }

  notes.push('eodhd_generic_exchange_suffix');
  return { symbol: `${sym}.${ex.toUpperCase()}`, notes };
}
