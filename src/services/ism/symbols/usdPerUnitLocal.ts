/**
 * USD value of one unit of local currency (same contract as {@link getExchangeRate} in currencyService).
 * Rates map: currency ISO code → units of that currency per 1 USD (app cache convention).
 */
export function usdPerUnitFromUsdBaseRates(
  localCurrencyTrimmed: string,
  rates: Record<string, number> | null | undefined
): number | null {
  const c = localCurrencyTrimmed.trim().toUpperCase();
  if (c === 'USD') return 1;
  if (!rates || !(c in rates)) return null;
  const unitsPerUsd = rates[c];
  if (!Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) return null;
  return 1 / unitsPerUsd;
}
