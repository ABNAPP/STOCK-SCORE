# Adjusted EOD cache — concise overview

## What it is

A **scheduled Cloud Function** (`eodAdjustedCacheNightly`) calls **EODHD** (`/api/eod/{SYMBOL.EXCHANGE}`), reads **`adjusted_close`** daily bars, and writes them to **Firestore** under **`eodAdjustedDaily/{eodSymbol}`** (e.g. `SPY.US`). A **`system/eodAdjustedCache`** doc tracks **generation** and last warm stats.

The **callable** `adminWarmEodAdjustedCache` runs the **same** job on demand (admin users only).

## Does it run on its own? Will it see the API key?

**Schedule — yes.** `eodAdjustedCacheNightly` is registered with a **cron**: **Monday–Friday** at **9:30 PM** **`America/New_York`**. Google **Cloud Scheduler** runs a job (name like `firebase-schedule-eodAdjustedCacheNightly-us-central1`) that triggers the function. You do not need to press anything for that; it repeats every eligible weekday as long as the project and APIs stay enabled.

**API key on scheduled runs — yes, if you deployed with it.** At **`firebase deploy`**, the CLI **loads `functions/.env`** and bakes those variables into the function’s **runtime config** (you’ll see *Loading environment variables from .env* in the deploy log). **Every** invocation—scheduled, manual test in console, or callable—uses that same environment, so `process.env.EODHD_API_KEY` is available on automatic runs.

**Caveat:** changing **`.env.local`** or **`functions/.env`** on disk does **not** update production until you run **`npm run functions:sync-env`** (or edit `functions/.env`) and **`firebase deploy --only functions`** again. Until then, the old key keeps running on the schedule.

## Why you see it in Firebase but not under “Cloud Functions” (GCP)

- **Firebase Console → Build → Functions** lists functions deployed by **Firebase CLI** for your project. That list is the source of truth for “did we deploy this?”
- **Google Cloud Console** navigation varies:
  - **1st gen** functions (this codebase uses **Node 20, v1**) appear under the **Cloud Functions** product for region **`us-central1`**. Some UI versions bury legacy functions or default to **Cloud Run** (where **2nd gen** functions show). If you only open **Cloud Run**, you may see **no** row for `eodAdjustedCacheNightly`.
  - **Cloud Scheduler** always shows a job like **`firebase-schedule-eodAdjustedCacheNightly-us-central1`**. That job only **triggers** the function on a schedule; it is **not** the function itself.

**Practical rule:** configure env and read logs from **Firebase → Functions** or **GCP → Cloud Functions** (not Scheduler, not Cloud Run) for the function named **`eodAdjustedCacheNightly`**, region **`us-central1`**.

## API key

- The function reads **`EODHD_API_KEY`** (or **`EODHD_API_TOKEN`**, or legacy **`functions.config().eodhd.key`**).
- **Recommended workflow:** keep **`VITE_EODHD_API_KEY`** in root **`.env.local`**, run **`npm run functions:sync-env`** (writes gitignored **`functions/.env`**), then **`firebase deploy --only functions`**. Predeploy runs the same sync.
- **Never** commit real keys. **`functions/.env`** is gitignored.

## Symbol list

Universe = **`SPY.US`** (benchmark) + every **`symbols/{id}`** doc with **`ism_symbol_schema_version == 1`** and a **`ticker_raw`**, mapped to EOD form (or **`eodhd_symbol`** when present), plus optional **`EOD_ADJUSTED_CACHE_SYMBOLS`** env and **`system/eodAdjustedSymbolUniverse`**.

## Verify it works

1. **`npm run test:eodhd-fetch`** — smoke test EODHD for **`SPY.US`** using **`functions/.env`** (no Firestore).
2. **Trigger the job:** Cloud Scheduler **Run now** on the `firebase-schedule-eodAdjustedCacheNightly-us-central1` job, or call **`adminWarmEodAdjustedCache`** from the app as admin.
3. **Firestore:** **`eodAdjustedDaily`** collection should appear with docs like **`SPY.US`** and a **`bars`** array.
4. **Logs:** **`npm run functions:log:eod`** or Firebase → Function → Logs; look for **`EODHD api_token resolved from …`** and **`warmed=N`**.

## Which companies have no cached prices?

Generate a Markdown table (excluded vs warm failed) from Firestore: **`npm run report:eod-gaps`** (needs **`gcloud auth application-default login`**). Output is written to [`eod-adjusted-cache-gaps.md`](./eod-adjusted-cache-gaps.md).

## Related files

| Topic | Location |
|--------|----------|
| Job implementation | `functions/src/eodAdjustedCache.ts` |
| Callable + exports | `functions/src/index.ts` |
| Sync key from `.env.local` | `scripts/sync-eodhd-to-functions.mjs` |
| Gap report (who lacks cache + reason) | `docs/eod-adjusted-cache-gaps.md`, `scripts/report-eod-cache-gaps.mjs` |
| EODHD / tickers detail | `docs/eodhd-tickers-and-providers.md` |
