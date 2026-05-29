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

Resolution lives in **`eodhdSymbolFromIsmSlugs`** ([`src/services/ism/marketData/eodhdExchangeResolve.ts`](../src/services/ism/marketData/eodhdExchangeResolve.ts)); `toEodhdSymbol` in [`symbolTranslate.ts`](../src/services/ism/marketData/symbolTranslate.ts) delegates to it.

- US-style exchanges (`nyse`, `nasdaq`, `amex`, `bats`, `otc`, `us`) → **`TICKER.US`**
- Unknown exchange → **`TICKER.US`** with note `eodhd_default_us_suffix`
- Swedish venues (`sto`, `ome`, `ngm`) → **`TICKER.ST`**
- Yahoo/sheet-style prefixes that differ from EODHD **`Code`** values → mapped in [`eodhdExchangeSlugAliases.ts`](../src/services/ism/marketData/eodhdExchangeSlugAliases.ts) (e.g. `lon`→`LSE`, `epa`→`PA`, `ams`→`AS`, `vie`→`VI`, `asx`→`AU`) with note `eodhd_slug_alias`
- If the exchange slug already matches an official EODHD code (case-insensitive), use the canonical spelling from [`eodhdExchangeGenerated.ts`](../src/services/ism/marketData/eodhdExchangeGenerated.ts)
- Otherwise → **`TICKER.{EXCHANGE}`** uppercased with note `eodhd_generic_exchange_suffix`

Regenerate official codes from [`GET …/api/exchanges-list/`](https://eodhd.com/api/exchanges-list/) (same token as other EODHD calls):

`npm run eodhd:sync-exchanges`

That refreshes `eodhdExchangeGenerated.ts` in both the SPA **and** [`functions/src/`](../functions/src/) (and copies the resolver helpers used by [`functions/src/ismEodTranslate.ts`](../functions/src/ismEodTranslate.ts)).

HTTP usage for daily bars: `eodhdAdapter.ts` builds URLs from `EODHD_API_ORIGIN` (usually **`/eodhd-proxy/api`** in the SPA → forwarded to `https://eodhd.com/api`), e.g.:

`GET …/eod/{SYMBOL.EXCHANGE}?from=…&to=…&period=d&api_token=…&fmt=json` → upstream `https://eodhd.com/api/eod/...`

FX in that adapter uses real-time symbols like `USDSEK.FOREX`.

## Subscription / rate limits

Plan limits (daily quota, requests per minute) are enforced by **EODHD**, not hard-coded here. If your plan allows **~100,000 calls/day** and **~1,000/minute**, keep bulk jobs sequential or throttled so bursts do not trigger HTTP 429s; the ISM fetch engine’s behavior and batch sizes should stay within those operational bounds.

## Adjusted vs raw OHLC (same EOD API)

Per [End-of-Day Historical Stock Market Data API](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes), the **`/api/eod/{symbol}`** JSON rows include:

- **`open`, `high`, `low`, `close`:** not adjusted to splits/dividends (raw).
- **`adjusted_close`:** adjusted to **both** splits and dividends (use this when you want a comparable “total return” price series).

Optional scalars from the **same** endpoint: `filter=last_close` returns the latest raw close as a single JSON number. For the latest **adjusted** value, use a short `from`/`to` window and read the last row’s `adjusted_close` (still one EOD API call).

The SPA’s [`eodhdAdapter.ts`](../src/services/ism/marketData/adapters/eodhdAdapter.ts) maps **`close` from `adjusted_close` when present**, so browser EOD paths align with adjusted series.

## Server-side adjusted EOD cache (Firestore)

Cloud Functions (see [`functions/src/eodAdjustedCache.ts`](../functions/src/eodAdjustedCache.ts)):

- **Writes only** via the Admin SDK: `GET https://eodhd.com/api/eod/{SYMBOL.EXCHANGE}?from&to&period=d&fmt=json&api_token=…` — same EOD endpoint as the app; no other market-data APIs.
- **Collections:**
  - `system/eodAdjustedCache` — `{ generation: number, schemaVersion, updatedAt }`. Bumping `generation` invalidates all per-symbol rows in O(1).
  - `eodAdjustedDaily/{eodSymbol}` — `{ eodSymbol, generation, schemaVersion, bars: [{ date, adjustedClose }], range, lastBarDate, fetchedAt }`.
- **Symbol universe (same rules as ISM posture tickers):** **`SPY`** (benchmark) plus every `ticker_raw` on Firestore **`symbols/{symbolId}`** docs with `ism_symbol_schema_version == 1`, translated to EOD form (same as [`eodAdjustedCacheSymbols.ts`](../src/services/ism/dailySector/eodAdjustedCacheSymbols.ts) / Functions [`ismEodTranslate.ts`](../functions/src/ismEodTranslate.ts)). Optional extras: comma-separated **`EOD_ADJUSTED_CACHE_SYMBOLS`** (Functions env) and **`system/eodAdjustedSymbolUniverse`** (`symbols: string[]`).
- **Schedule:** `eodAdjustedCacheNightly` runs **Monday–Friday** at **9:30 PM `America/New_York`**, increments `generation`, then **warms** the merged symbol list via EODHD only.
- **GCP names:** The code exports **`eodAdjustedCacheNightly`** in region **`us-central1`**. **Cloud Scheduler** lists a job such as **`firebase-schedule-eodAdjustedCacheNightly-us-central1`**; that job only triggers Pub/Sub — the workload runs in **Cloud Functions** under the same base name and region. Set the EODHD token on the **function** (Runtime → Environment variables), not on the scheduler job.

ISM posture reads this cache first when generation matches and the requested date window is covered; otherwise it falls back to the live EODHD proxy path.

**Smoke test (no GCP credentials):** from the repo root, `npm run test:eodhd-fetch` calls EODHD for `SPY.US` using `functions/.env` (synced from `.env.local`). This validates the token only; writing `eodAdjustedDaily` still requires running the deployed function (Scheduler **Run now** or admin callable `adminWarmEodAdjustedCache`).

**API key (server):** the job resolves the token in this order: `EODHD_API_KEY` → `EODHD_API_TOKEN` → `firebase functions:config:set eodhd.key` / `eodhd.api_key`. **Recommended:** keep **`VITE_EODHD_API_KEY`** in root **`.env.local`**, run **`npm run functions:sync-env`** (writes gitignored **`functions/.env`**), then **`firebase deploy --only functions`** — predeploy runs the same sync. Alternatively set `EODHD_API_KEY` in Console on **`eodAdjustedCacheNightly`** (`us-central1`). Do not use `VITE_*` in Functions. Logs include one line per run: `EODHD api_token resolved from <source>` when a key is found.

**EODHD lag:** US majors are typically updated ~2–3 hours after the close; some symbols (e.g. certain funds, OTC) may update the next morning—see EODHD’s own “End Of Day Historical Prices Update Time” section.

## Related files

| Concern | File |
|--------|------|
| Provider order (single source of truth) | `src/services/ism/marketData/providerChainConfig.ts` |
| EODHD HTTP adapter | `src/services/ism/marketData/adapters/eodhdAdapter.ts` |
| Symbol translation | `src/services/ism/marketData/symbolTranslate.ts` |
| App-wide FX rates cache | `src/services/currencyService.ts` |
| API base URL / CORS proxy | `src/config/eodhdApi.ts`, `vite.config.ts`, `vercel.json` |
| API key wiring | `src/config/apiKeys.ts`, `VITE_EODHD_API_KEY` |
| Adjusted EOD Firestore cache (Functions) | `functions/src/eodAdjustedCache.ts` |
| Client read of adjusted cache (ISM posture) | `src/services/ism/dailySector/eodAdjustedFirestoreCache.ts` |
