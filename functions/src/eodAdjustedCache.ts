/**
 * EODHD-only adjusted daily EOD cache: GET /api/eod/{symbol}?from&to&period=d&fmt=json
 * Uses JSON `adjusted_close`; writes Firestore generation + per-symbol docs (Admin SDK).
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { eodSymbolFromTickerRaw } from './ismEodTranslate';

const EODHD_API_ORIGIN = 'https://eodhd.com/api';

/**
 * Exported Cloud Function name. In GCP, **Cloud Scheduler** shows a job like
 * `firebase-schedule-<name>-<region>` that only triggers this function; set env/secrets on the **function**, not the scheduler.
 */
export const EOD_ADJUSTED_CACHE_NIGHTLY_FUNCTION_NAME = 'eodAdjustedCacheNightly' as const;

/**
 * Explicit region so the deployed function name/location match the Firebase default and GCP Console navigation.
 * Set `EODHD_API_KEY` (or `firebase functions:config:set eodhd.key=...`) on this function in this region.
 */
export const EOD_ADJUSTED_CACHE_NIGHTLY_REGION = 'us-central1' as const;

export const EOD_ADJUSTED_CACHE_SCHEMA_VERSION = 1;

/** Firestore: generation + metadata */
export const SYSTEM_EOD_ADJUSTED_CACHE_DOC = 'system/eodAdjustedCache';
/** Optional merge list of `TICKER.EX` strings */
export const SYSTEM_EOD_ADJUSTED_SYMBOL_UNIVERSE_DOC = 'system/eodAdjustedSymbolUniverse';

export const COLLECTION_EOD_ADJUSTED_DAILY = 'eodAdjustedDaily';

/** Calendar lookback aligned with ISM posture window (5 calendar years). */
const LOOKBACK_CALENDAR_DAYS = 5 * 365;

export type EodAdjustedBar = { date: string; adjustedClose: number };

function addCalendarDays(isoYmd: string, deltaDays: number): string {
  const d = new Date(`${isoYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export type EodhdApiKeySource =
  | 'EODHD_API_KEY'
  | 'EODHD_API_TOKEN'
  | 'functions.config().eodhd.key'
  | 'functions.config().eodhd.api_key'
  | null;

/** Resolution order: env vars first, then legacy `firebase functions:config:set eodhd.*`. */
export function resolveEodhdApiKey(): { key: string | null; source: EodhdApiKeySource } {
  const k1 = process.env.EODHD_API_KEY;
  if (typeof k1 === 'string' && k1.trim()) return { key: k1.trim(), source: 'EODHD_API_KEY' };
  const k2 = process.env.EODHD_API_TOKEN;
  if (typeof k2 === 'string' && k2.trim()) return { key: k2.trim(), source: 'EODHD_API_TOKEN' };
  try {
    const cfg = functions.config();
    const ck = cfg?.eodhd?.key;
    if (typeof ck === 'string' && ck.trim()) return { key: ck.trim(), source: 'functions.config().eodhd.key' };
    const ca = cfg?.eodhd?.api_key;
    if (typeof ca === 'string' && ca.trim()) return { key: ca.trim(), source: 'functions.config().eodhd.api_key' };
  } catch {
    /* functions.config() unavailable in some test contexts */
  }
  return { key: null, source: null };
}

function parseSymbolListFromEnv(): string[] {
  const raw = process.env.EOD_ADJUSTED_CACHE_SYMBOLS;
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** ISM registry `symbols/{symbolId}` — same `ticker_raw` field used for ingest / posture. */
const ISM_SYMBOL_SCHEMA_VERSION = 1;

async function loadEodSymbolsFromIsmSymbolRegistry(db: admin.firestore.Firestore): Promise<string[]> {
  const set = new Set<string>();
  set.add(eodSymbolFromTickerRaw('SPY'));
  try {
    const snap = await db.collection('symbols').get();
    for (const doc of snap.docs) {
      const d = doc.data() as {
        ism_symbol_schema_version?: unknown;
        ticker_raw?: unknown;
      };
      if (d.ism_symbol_schema_version !== ISM_SYMBOL_SCHEMA_VERSION) continue;
      const tr = d.ticker_raw;
      if (typeof tr !== 'string' || !tr.trim()) continue;
      const trimmed = tr.trim();
      /** Same as gap report: derive from `ticker_raw` only so exchange-alias fixes apply without re-writing every symbol doc. */
      set.add(eodSymbolFromTickerRaw(trimmed));
    }
  } catch (e) {
    console.warn('eodAdjustedCache: symbols collection read failed', e);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

async function loadMergedSymbolList(db: admin.firestore.Firestore): Promise<string[]> {
  const fromRegistry = await loadEodSymbolsFromIsmSymbolRegistry(db);
  const fromEnv = parseSymbolListFromEnv();
  let fromFs: string[] = [];
  try {
    const snap = await db.doc(SYSTEM_EOD_ADJUSTED_SYMBOL_UNIVERSE_DOC).get();
    const data = snap.data() as { symbols?: unknown } | undefined;
    if (data && Array.isArray(data.symbols)) {
      fromFs = data.symbols.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim());
    }
  } catch (e) {
    console.warn('eodAdjustedCache: could not read symbol universe doc', e);
  }
  return [...new Set([...fromRegistry, ...fromEnv, ...fromFs])].sort((a, b) => a.localeCompare(b));
}

/** Avoid spamming logs when every parallel fetch returns the same auth error. */
let eodhdUnauthenticatedHintLogged = false;

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    const authText =
      typeof body === 'string' &&
      (/unauthenticated/i.test(body) || /invalid api token/i.test(body));
    if (authText && !eodhdUnauthenticatedHintLogged) {
      eodhdUnauthenticatedHintLogged = true;
      console.error(
        'eodAdjustedCache: EODHD rejected the API token (see response body). Set EODHD_API_KEY (or eodhd.key via firebase functions:config:set) on the deployed function and redeploy.'
      );
    }
    const ok = res.ok && !authText;
    return { ok, status: res.status, body };
  } catch (e) {
    console.error('eodAdjustedCache fetch error', e);
    return { ok: false, status: 0, body: null };
  }
}

export function parseAdjustedBarsFromEodJson(body: unknown): EodAdjustedBar[] {
  if (!Array.isArray(body)) return [];
  const out: EodAdjustedBar[] = [];
  for (const row of body) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const date = typeof r.date === 'string' ? r.date : '';
    const adjRaw = r.adjusted_close;
    const adj = typeof adjRaw === 'number' ? adjRaw : Number(adjRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(adj) || adj <= 0) continue;
    out.push({ date, adjustedClose: adj });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export async function fetchEodAdjustedBarsForSymbol(
  apiKey: string,
  eodSymbol: string,
  fromIso: string,
  toIso: string
): Promise<EodAdjustedBar[]> {
  const url = `${EODHD_API_ORIGIN}/eod/${encodeURIComponent(eodSymbol)}?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(
    toIso
  )}&period=d&fmt=json&api_token=${encodeURIComponent(apiKey)}`;
  const parsed = await fetchJson(url);
  if (!parsed.ok || !Array.isArray(parsed.body)) {
    console.warn(`eodAdjustedCache: bad response for ${eodSymbol}`, parsed.status);
    return [];
  }
  return parseAdjustedBarsFromEodJson(parsed.body);
}

/**
 * Increments global cache generation (invalidates client-visible rows with old generation).
 * Returns the new generation number.
 */
export async function bumpEodAdjustedCacheGeneration(db: admin.firestore.Firestore): Promise<number> {
  const ref = db.doc(SYSTEM_EOD_ADJUSTED_CACHE_DOC);
  const next = await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const cur = snap.exists && typeof snap.data()?.generation === 'number' ? (snap.data()!.generation as number) : 0;
    const gen = cur + 1;
    txn.set(
      ref,
      {
        generation: gen,
        schemaVersion: EOD_ADJUSTED_CACHE_SCHEMA_VERSION,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return gen;
  });
  return next;
}

export async function writeDailyCacheDoc(
  db: admin.firestore.Firestore,
  eodSymbol: string,
  generation: number,
  bars: EodAdjustedBar[],
  fromIso: string,
  toIso: string
): Promise<void> {
  const lastBarDate = bars.length > 0 ? bars[bars.length - 1]!.date : '';
  const ref = db.collection(COLLECTION_EOD_ADJUSTED_DAILY).doc(eodSymbol);
  await ref.set(
    {
      eodSymbol,
      schemaVersion: EOD_ADJUSTED_CACHE_SCHEMA_VERSION,
      generation,
      bars,
      range: { from: fromIso, to: toIso },
      lastBarDate,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

const WARM_BATCH = 8;

export async function warmEodAdjustedCacheForSymbols(
  db: admin.firestore.Firestore,
  apiKey: string,
  generation: number,
  symbols: string[]
): Promise<{ ok: string[]; failed: Array<{ symbol: string; reason: string }> }> {
  const toIso = new Date().toISOString().slice(0, 10);
  const fromIso = addCalendarDays(toIso, -(LOOKBACK_CALENDAR_DAYS - 1));
  const ok: string[] = [];
  const failed: Array<{ symbol: string; reason: string }> = [];

  for (let i = 0; i < symbols.length; i += WARM_BATCH) {
    const batch = symbols.slice(i, i + WARM_BATCH);
    await Promise.all(
      batch.map(async (eodSymbol) => {
        try {
          const bars = await fetchEodAdjustedBarsForSymbol(apiKey, eodSymbol, fromIso, toIso);
          if (bars.length === 0) {
            failed.push({ symbol: eodSymbol, reason: 'empty_or_http' });
            return;
          }
          await writeDailyCacheDoc(db, eodSymbol, generation, bars, fromIso, toIso);
          ok.push(eodSymbol);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failed.push({ symbol: eodSymbol, reason: msg });
        }
      })
    );
  }

  return { ok, failed };
}

/**
 * Full job: bump generation, then warm all configured symbols (env + Firestore universe).
 */
export async function runEodAdjustedCacheNightlyJob(): Promise<{
  generation: number;
  symbols: string[];
  warmed: string[];
  failed: Array<{ symbol: string; reason: string }>;
  skipped: boolean;
  skipReason?: string;
}> {
  const db = admin.firestore();
  const { key: apiKey, source: keySource } = resolveEodhdApiKey();
  if (!apiKey) {
    console.error(
      `eodAdjustedCache: no EODHD api_token (set EODHD_API_KEY on ${EOD_ADJUSTED_CACHE_NIGHTLY_FUNCTION_NAME}@${EOD_ADJUSTED_CACHE_NIGHTLY_REGION}, or: firebase functions:config:set eodhd.key="YOUR_TOKEN" then deploy)`
    );
    return { generation: 0, symbols: [], warmed: [], failed: [], skipped: true, skipReason: 'no_api_key' };
  }
  console.log(`eodAdjustedCache: EODHD api_token resolved from ${keySource}`);

  const symbols = await loadMergedSymbolList(db);
  if (symbols.length === 0) {
    console.warn('eodAdjustedCache: no symbols in EOD_ADJUSTED_CACHE_SYMBOLS or system/eodAdjustedSymbolUniverse');
    return { generation: 0, symbols: [], warmed: [], failed: [], skipped: true, skipReason: 'no_symbols' };
  }

  const generation = await bumpEodAdjustedCacheGeneration(db);
  const { ok, failed } = await warmEodAdjustedCacheForSymbols(db, apiKey, generation, symbols);
  console.log(`eodAdjustedCache: generation=${generation} warmed=${ok.length} failed=${failed.length}`);

  await db.doc(SYSTEM_EOD_ADJUSTED_CACHE_DOC).set(
    {
      lastWarmAt: admin.firestore.FieldValue.serverTimestamp(),
      lastWarmOkCount: ok.length,
      lastWarmFailedCount: failed.length,
    },
    { merge: true }
  );

  return { generation, symbols, warmed: ok, failed, skipped: false };
}

/** Weekday evenings after US cash close window (EODHD updates ~2–3h after close). */
export const eodAdjustedCacheNightly = functions
  .region(EOD_ADJUSTED_CACHE_NIGHTLY_REGION)
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('30 21 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async () => {
    await runEodAdjustedCacheNightlyJob();
  });
