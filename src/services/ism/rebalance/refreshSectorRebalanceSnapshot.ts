/**
 * On-demand recompute + persist of the active weekly rebalance snapshot for one sector
 * (same motor path as `runWeeklyIsmSectorRebalances`, single sector).
 *
 * Merges value-insight-be EOD adjusted cache into fetch-engine slices for this run so row
 * qualification is not blocked solely by stale `historyDaysFetched` in Firestore.
 */

import type { User } from 'firebase/auth';
import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import { ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED } from '../../../types/ismSymbolDocument';
import { validateEntryExitValue } from '../../../utils/inputValidator';
import { getExchangeRate } from '../../currencyService';
import {
  tryReadAdjustedEodCachedRangeCalendarSpanDays,
  tryReadAdjustedEodDailyBarsInRange,
} from '../../eodAdjustedDataService';
import { loadActiveSectorRebalanceSnapshot } from '../dailySector/ismDailySectorFirestorePersistence';
import { alignIsmFetchEngineToIngest, loadOfficialIsmFetchEngineState } from '../fetchEngine';
import { ISM_HISTORY_TARGET_DAYS } from '../fetchEngine/constants';
import { addCalendarDays, daysInclusive, isoTodayUtc } from '../fetchEngine/dateUtils';
import { defaultSymbolState } from '../fetchEngine/stateHelpers';
import type { IsmFetchEngineState } from '../fetchEngine/types';
import {
  computeSectorRebalanceSnapshot,
  type PreviousSectorRebalanceMeta,
  type RebalanceRowInput,
} from './computeWeeklySectorRebalance';
import { persistValidatedSectorRebalanceSnapshot } from './ismRebalanceFirestorePersistence';
import { ismSectorIdFromName } from './sectorSlug';

function isoFromMillis(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function getLatestPriceDateBySymbolId(state: IsmFetchEngineState): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [symbolId, fetchState] of Object.entries(state.perSymbol)) {
    out[symbolId] = isoFromMillis(fetchState.lastHistoryFetchSuccessAt ?? fetchState.lastDailyPriceFetchAt);
  }
  return out;
}

function mergeLatestPriceDateBySymbolId(
  engineDates: Record<string, string | null>,
  sectorRows: ISMInstrumentIngest[],
  lastBarDateBySymbolId: Record<string, string | null>
): Record<string, string | null> {
  const out = { ...engineDates };
  for (const ingest of sectorRows) {
    const iso = lastBarDateBySymbolId[ingest.symbolId];
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const cur = out[ingest.symbolId];
    if (!cur || iso > cur) out[ingest.symbolId] = iso;
  }
  return out;
}

function mergeFetchEngineStateWithEodHistoryOverlay(
  state: IsmFetchEngineState,
  sectorRows: ISMInstrumentIngest[],
  overlayDaysBySymbolId: Record<string, number>
): IsmFetchEngineState {
  const perSymbol = { ...state.perSymbol };
  for (const ingest of sectorRows) {
    const id = ingest.symbolId;
    const extra = overlayDaysBySymbolId[id] ?? 0;
    const cur = perSymbol[id] ?? defaultSymbolState(id);
    perSymbol[id] = {
      ...cur,
      historyDaysFetched: Math.max(cur.historyDaysFetched ?? 0, extra),
    };
  }
  return { ...state, perSymbol };
}

async function buildUsdPerUnitByCurrencyForRows(rows: ISMInstrumentIngest[]): Promise<Map<string, number | null>> {
  const unique = new Set<string>();
  for (const row of rows) {
    const c = row.currency.trim().toUpperCase();
    if (!c) continue;
    if (!validateEntryExitValue('currency', c).isValid) continue;
    unique.add(c);
  }
  const out = new Map<string, number | null>();
  for (const c of unique) {
    if (c === 'USD') {
      out.set(c, 1);
      continue;
    }
    const fx = await getExchangeRate(c, 'USD');
    out.set(c, fx);
  }
  return out;
}

function buildPreviousMetaFromActiveSnapshot(snap: Record<string, unknown> | null): PreviousSectorRebalanceMeta | null {
  if (!snap) return null;
  const nd = snap.new_divisor;
  if (typeof nd !== 'number' || !Number.isFinite(nd) || nd <= 0) return null;
  const meta: PreviousSectorRebalanceMeta = { new_divisor: nd };
  const iopt = snap.index_open_post_rebalance_target;
  if (typeof iopt === 'number' && Number.isFinite(iopt)) {
    meta.index_open_post_rebalance_target = iopt;
  }
  const icp = snap.index_close_pre_rebalance;
  if (typeof icp === 'number' && Number.isFinite(icp)) {
    meta.index_close_pre_rebalance = icp;
  }
  const cons = snap.constituents;
  if (Array.isArray(cons)) {
    const pairs: { symbol_id: string; synthetic_shares: number }[] = [];
    for (const c of cons) {
      if (!c || typeof c !== 'object') continue;
      const r = c as Record<string, unknown>;
      const sid = r.symbol_id;
      const sh = r.synthetic_shares;
      if (typeof sid === 'string' && typeof sh === 'number' && Number.isFinite(sh)) {
        pairs.push({ symbol_id: sid, synthetic_shares: sh });
      }
    }
    if (pairs.length > 0) meta.constituents = pairs;
  }
  return meta;
}

async function buildSectorEodCacheSignals(rows: ISMInstrumentIngest[]): Promise<{
  overlayDaysBySymbolId: Record<string, number>;
  lastBarDateBySymbolId: Record<string, string | null>;
  lastCloseBySymbolId: Record<string, number | null>;
}> {
  const toIso = isoTodayUtc();
  const fromIso = addCalendarDays(toIso, -(ISM_HISTORY_TARGET_DAYS - 1));
  const overlayDaysBySymbolId: Record<string, number> = {};
  const lastBarDateBySymbolId: Record<string, string | null> = {};
  const lastCloseBySymbolId: Record<string, number | null> = {};

  await Promise.all(
    rows.map(async (ingest) => {
      let span = 0;
      let lastDate: string | null = null;
      let lastClose: number | null = null;

      const bars = await tryReadAdjustedEodDailyBarsInRange(ingest.tickerRaw, fromIso, toIso);
      if (bars && bars.length > 0) {
        span = daysInclusive(bars[0]!.date, bars[bars.length - 1]!.date);
        lastDate = bars[bars.length - 1]!.date;
        const c = bars[bars.length - 1]!.close;
        lastClose = Number.isFinite(c) && c > 0 ? c : null;
      }

      if (span < ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED) {
        const metaSpan = await tryReadAdjustedEodCachedRangeCalendarSpanDays(ingest.tickerRaw);
        if (metaSpan != null) span = Math.max(span, metaSpan);
      }

      overlayDaysBySymbolId[ingest.symbolId] = Math.min(span, ISM_HISTORY_TARGET_DAYS);
      lastBarDateBySymbolId[ingest.symbolId] = lastDate;
      lastCloseBySymbolId[ingest.symbolId] = lastClose;
    })
  );

  return { overlayDaysBySymbolId, lastBarDateBySymbolId, lastCloseBySymbolId };
}

/**
 * Recomputes the weekly sector rebalance snapshot for `sectorId` from current DashBoard ingest + official fetch engine,
 * then persists it as the active snapshot for `rebalanceDate` (today UTC) if validation passes.
 */
export async function refreshSectorRebalanceSnapshotOnDemand(
  user: User,
  sectorId: string,
  allIngestRows: ISMInstrumentIngest[],
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (!user) return { ok: false, errors: ['no_user'] };

  const sectorRows = allIngestRows.filter((r) => ismSectorIdFromName(r.sectorIsm) === sectorId);
  if (sectorRows.length === 0) return { ok: false, errors: ['no_ingest_rows_for_sector'] };

  const sectorName =
    sectorRows.map((r) => (typeof r.sectorIsm === 'string' ? r.sectorIsm.trim() : '')).find((s) => s.length > 0) ??
    sectorId;

  const loaded = await loadOfficialIsmFetchEngineState(user);
  let fetchEngineState = alignIsmFetchEngineToIngest(loaded, allIngestRows);

  const { overlayDaysBySymbolId, lastBarDateBySymbolId, lastCloseBySymbolId } =
    await buildSectorEodCacheSignals(sectorRows);
  fetchEngineState = mergeFetchEngineStateWithEodHistoryOverlay(fetchEngineState, sectorRows, overlayDaysBySymbolId);

  const usdPerUnitByCurrency = await buildUsdPerUnitByCurrencyForRows(sectorRows);
  const latestPriceDateBySymbolId = mergeLatestPriceDateBySymbolId(
    getLatestPriceDateBySymbolId(fetchEngineState),
    sectorRows,
    lastBarDateBySymbolId
  );

  const activeSnap = await loadActiveSectorRebalanceSnapshot(user, sectorId);
  const previous = buildPreviousMetaFromActiveSnapshot(activeSnap);

  const rowInputs: RebalanceRowInput[] = sectorRows.map((ingest) => {
    const cur = ingest.currency.trim().toUpperCase();
    const usd =
      ingest.currency.trim().length > 0 && validateEntryExitValue('currency', ingest.currency.trim()).isValid
        ? usdPerUnitByCurrency.get(cur) ?? null
        : null;
    return {
      ingest,
      hasEntryExitRow: getHasEntryExitRow(ingest.tickerRaw, ingest.companyName),
      usdPerUnitLocalCurrency: usd,
      fetchState: fetchEngineState.perSymbol[ingest.symbolId],
      latestPriceDateIso: latestPriceDateBySymbolId[ingest.symbolId] ?? null,
    };
  });

  const rebalanceDate = isoTodayUtc();
  const now = Date.now();
  const snapshot = computeSectorRebalanceSnapshot({
    sectorName,
    rows: rowInputs,
    rebalanceDate,
    rebalanceTimestampMs: now,
    marketCapSnapshotTimestampMs: now,
    priceSnapshotTimestampMs: now,
    fxSnapshotTimestampMs: now,
    fetchEngineState,
    previous,
    latestCloseBySymbolId: lastCloseBySymbolId,
  });

  const res = await persistValidatedSectorRebalanceSnapshot(user, sectorId, rebalanceDate, snapshot);
  return res.ok ? { ok: true } : { ok: false, errors: res.errors };
}
