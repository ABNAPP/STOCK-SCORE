/**
 * Mirrors ISM browser translation for EODHD (`buildSymbolTranslationContext` + `toEodhdSymbol`).
 * Keep in sync with `src/utils/ism/tickerIdentity.ts` and `src/services/ism/marketData/symbolTranslate.ts`.
 */

import { eodhdSymbolFromIsmSlugs } from './eodhdExchangeResolve';

const EXCHANGE_PART_OK = /^[a-zA-Z0-9]+$/;

function slugifySymbolSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function buildNormalizedAndSymbolId(exchangeSlug: string, symbolSlug: string): {
  tickerNormalized: string;
  symbolId: string;
} {
  const sym = symbolSlug.length > 0 ? symbolSlug : 'empty';
  const ex = exchangeSlug === 'unknown' ? 'unknown' : exchangeSlug;
  const tickerNormalized = `${ex}:${sym}`;
  const symbolId = ex === 'unknown' ? `unknown_${sym}` : `${ex}_${sym}`;
  return { tickerNormalized, symbolId };
}

/** Copied from `src/utils/ism/tickerIdentity.ts` `parseTickerParts` — must stay aligned. */
function parseTickerPartsMinimal(rawTicker: string): {
  tickerRaw: string;
  exchange: string;
  tickerSymbol: string;
} {
  const tickerRaw = rawTicker;
  const trimmed = rawTicker.trim();
  let needsReview = false;

  if (trimmed === '') {
    return { tickerRaw, exchange: 'unknown', tickerSymbol: '' };
  }

  const colonIdx = trimmed.indexOf(':');
  let exchangePart: string;
  let symbolPart: string;

  if (colonIdx === -1) {
    exchangePart = '';
    symbolPart = trimmed;
  } else {
    exchangePart = trimmed.slice(0, colonIdx).trim();
    symbolPart = trimmed.slice(colonIdx + 1).trim();
    if (symbolPart.includes(':')) {
      needsReview = true;
    }
    if (exchangePart === '' || symbolPart === '') {
      needsReview = true;
    }
  }

  const hasExplicitExchange = colonIdx !== -1 && exchangePart.length > 0;

  if (hasExplicitExchange && !EXCHANGE_PART_OK.test(exchangePart)) {
    needsReview = true;
  }

  const exchangeSlug = hasExplicitExchange ? slugifySymbolSegment(exchangePart) : 'unknown';
  const exchangeSlugFinal =
    hasExplicitExchange && exchangeSlug.length === 0 ? 'unknown' : exchangeSlug;

  if (hasExplicitExchange && exchangeSlugFinal === 'unknown') {
    needsReview = true;
  }

  const symbolSlug = slugifySymbolSegment(symbolPart);
  if (symbolPart.length > 0 && symbolSlug.length === 0) {
    needsReview = true;
  }

  const effectiveExchangeSlug =
    hasExplicitExchange && exchangeSlugFinal !== 'unknown' ? exchangeSlugFinal : 'unknown';

  const symbolSlugFinal = symbolSlug.length > 0 ? symbolSlug : 'empty';
  if (symbolPart.length === 0) {
    needsReview = true;
  }

  void needsReview;
  const { tickerNormalized, symbolId } = buildNormalizedAndSymbolId(
    effectiveExchangeSlug,
    symbolSlugFinal
  );
  void tickerNormalized;
  void symbolId;

  return {
    tickerRaw,
    exchange: effectiveExchangeSlug,
    tickerSymbol: symbolPart,
  };
}

type SymbolTranslationContext = { tickerRaw: string; exchangeSlug: string; symbolSlug: string };

function buildSymbolTranslationContext(tickerRaw: string): SymbolTranslationContext {
  const p = parseTickerPartsMinimal(tickerRaw);
  const slug = slugifySymbolSegment(p.tickerSymbol);
  return {
    tickerRaw: p.tickerRaw,
    exchangeSlug: p.exchange,
    symbolSlug: slug.length > 0 ? slug : 'empty',
  };
}

/** Same EOD string as browser `translateForProvider('eodhd', buildSymbolTranslationContext(tickerRaw)).symbol`. */
export function eodSymbolFromTickerRaw(tickerRaw: string): string {
  const ctx = buildSymbolTranslationContext(tickerRaw);
  return eodhdSymbolFromIsmSlugs(ctx.symbolSlug, ctx.exchangeSlug).symbol;
}
