/**
 * Maps DashBoard / Yahoo-style exchange **prefixes** (slug before `:` in `tickerRaw`) to EODHD
 * `Code` values from https://eodhd.com/api/exchanges-list/ — they often differ (e.g. `lon` → LSE, `epa` → PA).
 *
 * Keep in sync with `functions/src/eodhdExchangeSlugAliases.ts` (copy on `npm run eodhd:sync-exchanges`).
 */
export const ISM_EXCHANGE_SLUG_TO_EODHD_CODE: Readonly<Record<string, string>> = {
  // London — Yahoo/sheets often use LON; EODHD uses LSE
  lon: 'LSE',
  lse: 'LSE',
  // Euronext Paris
  epa: 'PA',
  par: 'PA',
  // Euronext Amsterdam
  ams: 'AS',
  // Xetra (Germany)
  etr: 'XETRA',
  xetra: 'XETRA',
  // Italy — Borsa Italiana
  bit: 'MI',
  // Spain — Bolsa Madrid
  bme: 'MC',
  // Copenhagen
  cph: 'CO',
  // Helsinki
  hel: 'HE',
  // Toronto / TSX — Yahoo `TSE`
  tse: 'TO',
  tsx: 'TO',
  // SIX Swiss — Yahoo `SWX`
  swx: 'SW',
  // Australian Securities Exchange — Yahoo `ASX`
  asx: 'AU',
  // Vienna — Yahoo `VIE`; EODHD uses VI
  vie: 'VI',
};
