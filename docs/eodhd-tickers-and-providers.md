# EODHD as primary market-data provider

ISM market-data layers use **EODHD only**: `ISM_PRICE_PROVIDER_CHAIN` and `ISM_FX_PROVIDER_CHAIN` in [`src/services/ism/marketData/providerChainConfig.ts`](src/services/ism/marketData/providerChainConfig.ts) contain **`['eodhd']`**—no Alpha Vantage / Marketstack / Finnhub fallback for ISM. Posture calculations pull **fresh** full-window EOD series via [`fetchPostureEodInputs.ts`](src/services/ism/dailySector/fetchPostureEodInputs.ts) each run. The global currency cache in [`currencyService.ts`](src/services/currencyService.ts) may still try other providers after EODHD.

Ensure **`VITE_EODHD_API_KEY`** is set (and optionally stored via your API keys UI / Firestore app config) so requests hit EODHD instead of falling through to other keys.

### Browser CORS (why Postman works but DevTools looked “red”)

Browsers block cross-origin reads unless the API sends permissive CORS headers; EODHD’s JSON API typically does not allow arbitrary web origins. Postman does not apply CORS. This app defaults to same-origin URLs under **`/eodhd-proxy/api`**, proxied to `https://eodhd.com` in **Vite dev** (`vite.config.ts`) and **Vercel** (`vercel.json`). See [`src/config/eodhdApi.ts`](../src/config/eodhdApi.ts).

## How EODHD identifies tickers (official)

Per [Quick start](https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis) and related docs:

- Symbols use **`SYMBOL_NAME.EXCHANGE_CODE`**, with a **dot** between local code and exchange.
- Examples from their documentation: US equities (`AAPL.US`), crypto (`BTC-USD.CC`), forex (`EURUSD.FOREX`).
- Exchange codes are not guessed from thin air: use the [Exchanges / exchange symbol list](https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours) APIs to resolve the correct suffix for a venue.

US-listed names often use the unified code **`US`** (covers NYSE, NASDAQ, ARCA, OTC, etc.) unless you need a venue-specific code.

## How this codebase builds EODHD symbols

Implementation: `toEodhdSymbol` in `src/services/ism/marketData/symbolTranslate.ts`.

- US-style exchanges (`nyse`, `nasdaq`, `amex`, `bats`, `otc`, `us`) → **`TICKER.US`**
- Unknown exchange → **`TICKER.US`** with translation note `eodhd_default_us_suffix`
- Swedish venues (`sto`, `ome`, `ngm`) → **`TICKER.ST`**
- `lse` → **`TICKER.LSE`**
- Anything else → **`TICKER.{EXCHANGE}`** uppercased with note `eodhd_generic_exchange_suffix`

HTTP usage for daily bars: `eodhdAdapter.ts` builds URLs from `EODHD_API_ORIGIN` (usually **`/eodhd-proxy/api`** in the SPA → forwarded to `https://eodhd.com/api`), e.g.:

`GET …/eod/{SYMBOL.EXCHANGE}?from=…&to=…&period=d&api_token=…&fmt=json` → upstream `https://eodhd.com/api/eod/...`

FX in that adapter uses real-time symbols like `USDSEK.FOREX`.

## Subscription / rate limits

Plan limits (daily quota, requests per minute) are enforced by **EODHD**, not hard-coded here. If your plan allows **~100,000 calls/day** and **~1,000/minute**, keep bulk jobs sequential or throttled so bursts do not trigger HTTP 429s; the ISM fetch engine’s behavior and batch sizes should stay within those operational bounds.

## Related files

| Concern | File |
|--------|------|
| Provider order (single source of truth) | `src/services/ism/marketData/providerChainConfig.ts` |
| EODHD HTTP adapter | `src/services/ism/marketData/adapters/eodhdAdapter.ts` |
| Symbol translation | `src/services/ism/marketData/symbolTranslate.ts` |
| App-wide FX rates cache | `src/services/currencyService.ts` |
| API base URL / CORS proxy | `src/config/eodhdApi.ts`, `vite.config.ts`, `vercel.json` |
| API key wiring | `src/config/apiKeys.ts`, `VITE_EODHD_API_KEY` |
