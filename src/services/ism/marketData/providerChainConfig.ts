/**
 * Single source of truth for ISM provider fallback order.
 *
 * **ISM market data is EODHD-only** (no Alpha Vantage / Marketstack / Finnhub fallbacks for this layer).
 * App-wide currency in `src/services/currencyService.ts` may still use other providers; that is separate.
 *
 * EODHD ticker format (official): `SYMBOL_NAME.EXCHANGE_CODE`, e.g. `AAPL.US`, `BP.LSE`,
 * `EURUSD.FOREX`, `BTC-USD.CC`. Exchange codes are listed via their Exchanges / exchange-symbol-list APIs.
 *
 * @see https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis
 * @see https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours
 */

import type { IsmMarketProviderId } from './types';

/** Equity EOD + latest close: EODHD only (ISM posture pipeline). */
export const ISM_PRICE_PROVIDER_CHAIN: readonly IsmMarketProviderId[] = ['eodhd'];

/** USD→major FX for ISM orchestration: EODHD only. */
export const ISM_FX_PROVIDER_CHAIN: readonly IsmMarketProviderId[] = ['eodhd'];
