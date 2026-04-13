import { parseTickerParts, slugifySymbolSegment } from '../../../utils/ism/tickerIdentity';
import type { SymbolTranslationContext } from './types';

/** Build translation context from a DashBoard ticker string (ISM parse + symbol slug). */
export function buildSymbolTranslationContext(tickerRaw: string): SymbolTranslationContext {
  const p = parseTickerParts(tickerRaw);
  const slug = slugifySymbolSegment(p.tickerSymbol);
  return {
    tickerRaw: p.tickerRaw,
    exchangeSlug: p.exchange,
    symbolSlug: slug.length > 0 ? slug : 'empty',
  };
}
