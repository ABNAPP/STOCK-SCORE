/**
 * Single source of truth for ISM provider fallback order.
 *
 * EODHD is the primary provider for historical EOD, latest close, and USD FX (when keys exist).
 * Fallbacks run only if EODHD returns no data / invalid symbol / missing API key.
 *
 * EODHD ticker format (official): `SYMBOL_NAME.EXCHANGE_CODE`, e.g. `AAPL.US`, `BP.LSE`,
 * `EURUSD.FOREX`, `BTC-USD.CC`. Exchange codes are listed via their Exchanges / exchange-symbol-list APIs.
 *
 * @see https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis
 * @see https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours
 */

import type { IsmMarketProviderId } from './types';

/** Equity EOD + latest close chain: EODHD → Alpha Vantage → Marketstack → Finnhub. */
export const ISM_PRICE_PROVIDER_CHAIN: readonly IsmMarketProviderId[] = [
  'eodhd',
  'alpha_vantage',
  'marketstack',
  'finnhub',
];

/**
 * USD→major FX for ISM orchestration (Marketstack omitted by ISM v1 FX spec).
 * Same priority idea: EODHD first.
 */
export const ISM_FX_PROVIDER_CHAIN: readonly IsmMarketProviderId[] = ['eodhd', 'alpha_vantage', 'finnhub'];
