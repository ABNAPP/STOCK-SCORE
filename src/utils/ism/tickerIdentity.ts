/**
 * ISM ticker parsing, normalization, and symbolId construction.
 * Scoped to ISM; does not alter sheet tickers or existing map keys elsewhere.
 */

import type { ParsedTickerParts } from '../../types/ismTickerIdentity';

/** v1: exchange prefix must be alphanumeric only (no aggressive MIC guessing). */
const EXCHANGE_PART_OK = /^[a-zA-Z0-9]+$/;

/**
 * Lowercase slug: runs of non [a-z0-9] become a single underscore; trim outer underscores.
 */
export function slugifySymbolSegment(input: string): string {
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

/**
 * Full parse: preserves raw, applies trim/colon rules, sets needsReview when ambiguous.
 */
export function parseTickerParts(rawTicker: string): ParsedTickerParts {
  const tickerRaw = rawTicker;
  const trimmed = rawTicker.trim();
  let needsReview = false;

  if (trimmed === '') {
    const { tickerNormalized, symbolId } = buildNormalizedAndSymbolId('unknown', 'empty');
    return {
      tickerRaw,
      tickerNormalized,
      symbolId,
      exchange: 'unknown',
      tickerSymbol: '',
      needsReview: true,
    };
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

  const effectiveExchangeSlug = hasExplicitExchange && exchangeSlugFinal !== 'unknown'
    ? exchangeSlugFinal
    : 'unknown';

  const symbolSlugFinal = symbolSlug.length > 0 ? symbolSlug : 'empty';
  if (symbolPart.length === 0) {
    needsReview = true;
  }

  const { tickerNormalized, symbolId } = buildNormalizedAndSymbolId(
    effectiveExchangeSlug,
    symbolSlugFinal
  );

  return {
    tickerRaw,
    tickerNormalized,
    symbolId,
    exchange: effectiveExchangeSlug,
    tickerSymbol: symbolPart,
    needsReview,
  };
}

/** Canonical internal normalized ticker string. */
export function normalizeTicker(rawTicker: string): string {
  return parseTickerParts(rawTicker).tickerNormalized;
}

/** Stable symbol id for maps and Firestore keys within ISM. */
export function buildSymbolId(rawTicker: string): string {
  return parseTickerParts(rawTicker).symbolId;
}

/** True when both raw strings resolve to the same symbolId. */
export function isSameIsmSymbol(rawA: string, rawB: string): boolean {
  return buildSymbolId(rawA) === buildSymbolId(rawB);
}

/**
 * Match DashBoard ticker vs ENTRY/EXIT ticker using the same ISM rules (e.g. plain `MMM` vs `NYSE:MMM`).
 * Equivalent to {@link isSameIsmSymbol} — both sides use {@link buildSymbolId}.
 */
export function matchDashBoardToEntryExit(dashBoardTicker: string, entryExitTicker: string): boolean {
  return isSameIsmSymbol(dashBoardTicker, entryExitTicker);
}

/** Alias for {@link isSameIsmSymbol} — legacy sheet tickers without exchange map under `unknown_*`. */
export function compareIsmToLegacyKey(rawIsm: string, legacyTicker: string): boolean {
  return isSameIsmSymbol(rawIsm, legacyTicker);
}
