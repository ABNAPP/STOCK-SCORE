import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ISMInstrumentIngest } from '../types/ismIngest';
import { getApiKeys } from '../config/apiKeys';
import { validateEntryExitValue } from '../utils/inputValidator';
import { getExchangeRate } from '../services/currencyService';
import { computeIsmRebalanceRowMetrics, type RebalanceRowInput } from '../services/ism/rebalance';
import { ismSectorIdFromName } from '../services/ism/rebalance/sectorSlug';
import { runWeeklyIsmSectorRebalances } from '../services/ism/rebalance/ismRebalanceFirestorePersistence';
import { syncIsmSymbolsFromIngest, loadIsmSymbolDoc } from '../services/ism/symbols';
import {
  alignIsmFetchEngineToIngest,
  loadOfficialIsmFetchEngineState,
  saveOfficialIsmFetchEngineState,
  tickIsmBootstrap,
  isoTodayUtc,
  addCalendarDays,
  type IsmFetchEngineState,
} from '../services/ism/fetchEngine';
import { runDailyIsmSectorIndex } from '../services/ism/dailySector/runDailyIsmSectorIndex';
import {
  fetchSectorIndexDailyInRange,
} from '../services/ism/dailySector/fetchSectorIndexDailySeries';
import {
  loadActiveSectorRebalanceSnapshot,
} from '../services/ism/dailySector/ismDailySectorFirestorePersistence';
import {
  buildDefaultProviderKeyPools,
  defaultIsmMarketAdapters,
  buildSymbolTranslationContext,
  translateForProvider,
} from '../services/ism/marketData';
import {
  collectConstituentFetchRefs,
  fetchConstituentCloseHistories,
  fetchEodCloseSeriesForTicker,
  ISM_POSTURE_EOD_FETCH_BATCH_SIZE,
  postureEodWindowFromTradeDate,
} from '../services/ism/dailySector/fetchPostureEodInputs';
import { tryReadAdjustedEodDailyBarsInRange } from '../services/eodAdjustedDataService';

type StepStatus = 'ok' | 'failed' | 'warn';

export type IsmDebugStepResult = {
  step: string;
  status: StepStatus;
  detail: string;
};

export type IsmProviderAttemptDebug = {
  provider: string;
  translatedSymbol: string;
  keyIndex: number | null;
  resultType: 'valid' | 'invalid' | 'failed';
  reason: string;
  dataPoints: number;
  firstDate: string | null;
  lastDate: string | null;
};

export type IsmMiningSymbolTrace = {
  companyName: string;
  tickerRaw: string;
  symbolId: string;
  providerAttemptOrder: string[];
  attempts: IsmProviderAttemptDebug[];
  firstStop: string;
  beforeHistoryDaysAvailable: number;
  afterHistoryDaysAvailable: number;
  beforeLatestPriceDate: string | null;
  afterLatestPriceDate: string | null;
};

export type IsmMiningDebugSummary = {
  dashboardRows: number;
  symbolIdReady: number;
  withCurrency: number;
  withMarketCapUsd: number;
  withHistoryDaysAvailable: number;
  historyDaysMin: number;
  historyDaysMedian: number;
  historyDaysMax: number;
  withLatestPriceDate: number;
  withSufficientHistory: number;
  dataReady: number;
  qualified: number;
  weeklySnapshotCreated: boolean;
  dailyDocCreated: boolean;
};

export type IsmDebugRunReport = {
  startedAt: string;
  finishedAt: string;
  bootstrapIterations: number;
  /** EODHD HTTP calls from bootstrap (always 0 when using Firestore cache only). */
  bootstrapProviderApiCalls: number;
  /** History chunks read from value-insight-be `/eod-adjusted-daily` during bootstrap. */
  bootstrapFirestoreCacheChunks: number;
  bootstrapStopReason: 'all_complete' | 'max_calls_reached' | 'no_progress';
  apiKeysStatus: {
    eodhd: boolean;
  };
  steps: IsmDebugStepResult[];
  miningSymbolTraces: IsmMiningSymbolTrace[];
  mining: IsmMiningDebugSummary;
};

export type UseIsmDebugSyncResult = {
  running: boolean;
  report: IsmDebugRunReport | null;
  error: string | null;
  runDebugSync: () => Promise<void>;
};

function permissionHint(message: string): string | null {
  if (/permission|insufficient/i.test(message)) {
    return 'Possible Firestore rules/permission block.';
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isoFromMillis(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

async function buildUsdPerUnitByCurrency(rows: ISMInstrumentIngest[]): Promise<Map<string, number | null>> {
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

function getLatestPriceDateBySymbolId(state: IsmFetchEngineState): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [symbolId, fetchState] of Object.entries(state.perSymbol)) {
    out[symbolId] = isoFromMillis(fetchState.lastHistoryFetchSuccessAt ?? fetchState.lastDailyPriceFetchAt);
  }
  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 1000) / 1000;
  }
  return sorted[mid];
}

async function traceMiningEodFirestoreWindow(
  ingest: ISMInstrumentIngest,
  fromIso: string,
  toIso: string
): Promise<{ attempts: IsmProviderAttemptDebug[]; firstStop: string }> {
  const ctx = buildSymbolTranslationContext(ingest.tickerRaw);
  const translated = translateForProvider('eodhd', ctx).symbol;
  const bars = await tryReadAdjustedEodDailyBarsInRange(ingest.tickerRaw, fromIso, toIso);
  if (bars && bars.length > 0) {
    return {
      attempts: [
        {
          provider: 'eodhd',
          translatedSymbol: translated,
          keyIndex: null,
          resultType: 'valid',
          reason: 'firestore_eod_adjusted_daily',
          dataPoints: bars.length,
          firstDate: bars[0]!.date,
          lastDate: bars[bars.length - 1]!.date,
        },
      ],
      firstStop: 'firestore_cache_valid',
    };
  }
  return {
    attempts: [
      {
        provider: 'eodhd',
        translatedSymbol: translated,
        keyIndex: null,
        resultType: 'failed',
        reason: 'firestore_cache_miss',
        dataPoints: 0,
        firstDate: null,
        lastDate: null,
      },
    ],
    firstStop: 'no_firestore_cache',
  };
}

export function useIsmDebugSync(
  user: User | null,
  ingestRows: ISMInstrumentIngest[],
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean
): UseIsmDebugSyncResult {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<IsmDebugRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDebugSync = useCallback(async () => {
    if (!user || running) return;

    const steps: IsmDebugStepResult[] = [];
    const startedAt = new Date().toISOString();
    setRunning(true);
    setError(null);
    setReport(null);

    try {
      const miningRows = ingestRows.filter((r) => ismSectorIdFromName(r.sectorIsm) === 'mining');
      let weeklyMiningCreated = false;
      let dailyMiningCreated = false;
      const DEBUG_MAX_BOOTSTRAP_ITERATIONS = 40;
      const DEBUG_MAX_NO_PROGRESS_ITERATIONS = 2;
      /** Normal motor uses a 60-call/day cap on `dailyCallBudgetUsed`; kept high for any provider-mode bootstrap. Debug bootstrap uses Firestore only and does not consume this budget. */
      const DEBUG_BOOTSTRAP_DAILY_CALL_BUDGET_LIMIT = 50_000;
      const apiKeys = getApiKeys();
      const apiKeysStatus = {
        eodhd: Boolean(apiKeys.eodhd?.trim()),
      };
      const postureEodOpts = { cacheOnly: true } as const;

      // 1) syncIsmSymbolsFromIngest
      try {
        await syncIsmSymbolsFromIngest(user, ingestRows, {
          fetchEngineState: null,
          getHasEntryExitRow,
          top30IncludedSymbolIds: null,
          latestPriceDateIso: null,
          usdBaseRates: null,
        });

        let miningDocsReadable = 0;
        for (const row of miningRows) {
          const doc = await loadIsmSymbolDoc(user, row.symbolId);
          if (doc) miningDocsReadable += 1;
        }
        const msg =
          miningRows.length > 0
            ? `symbols synced; readable Mining docs: ${miningDocsReadable}/${miningRows.length}`
            : 'symbols synced; no Mining rows in ingest';
        steps.push({ step: 'syncIsmSymbolsFromIngest', status: 'ok', detail: msg });
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'syncIsmSymbolsFromIngest',
          status: 'failed',
          detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
        });
      }

      // 2) loadOfficialIsmFetchEngineState
      const loadedState = await loadOfficialIsmFetchEngineState(user);
      const alignedState = alignIsmFetchEngineToIngest(loadedState, ingestRows);
      steps.push({
        step: 'loadOfficialIsmFetchEngineState',
        status: 'ok',
        detail: loadedState
          ? `loaded existing state with ${Object.keys(loadedState.perSymbol).length} symbols`
          : 'no existing state; created aligned in-memory state',
      });

      // 3) tickIsmBootstrap (debug loop)
      const ingestBySymbolId = new Map<string, ISMInstrumentIngest>(
        ingestRows.map((r) => [r.symbolId, r])
      );
      const miningTop5 = miningRows.slice(0, 5);
      const miningBeforeState = new Map(
        miningTop5.map((r) => [
          r.symbolId,
          {
            history: alignedState.perSymbol[r.symbolId]?.historyDaysFetched ?? 0,
            latest: isoFromMillis(alignedState.perSymbol[r.symbolId]?.lastHistoryFetchSuccessAt ?? null),
          },
        ])
      );
      let bootstrapState = alignedState;
      let bootstrapIterations = 0;
      let bootstrapProviderApiCalls = 0;
      let bootstrapFirestoreCacheChunks = 0;
      let noProgressIterations = 0;
      let bootstrapAllComplete = false;
      let bootstrapStopReason: IsmDebugRunReport['bootstrapStopReason'] = 'max_calls_reached';
      let lastTickStoppedReason = '';

      while (bootstrapIterations < DEBUG_MAX_BOOTSTRAP_ITERATIONS) {
        const beforeTotalHistory = Object.values(bootstrapState.perSymbol).reduce(
          (sum, s) => sum + (s.historyDaysFetched ?? 0),
          0
        );
        const beforeSuccess = Object.values(bootstrapState.perSymbol).filter(
          (s) => (s.lastHistoryFetchSuccessAt ?? 0) > 0
        ).length;

        const res = await tickIsmBootstrap(
          bootstrapState,
          ingestBySymbolId,
          {
            pools: buildDefaultProviderKeyPools(),
            adapters: defaultIsmMarketAdapters,
            dailyCallBudgetLimit: DEBUG_BOOTSTRAP_DAILY_CALL_BUDGET_LIMIT,
            bootstrapHistorySource: 'firestore_cache_only',
          }
        );

        lastTickStoppedReason = res.stoppedReason;
        bootstrapIterations += 1;
        bootstrapProviderApiCalls += res.callsConsumed;
        bootstrapFirestoreCacheChunks += res.firestoreCacheChunksServed;
        bootstrapState = res.state;
        bootstrapAllComplete = res.bootstrapAllComplete;

        const afterTotalHistory = Object.values(bootstrapState.perSymbol).reduce(
          (sum, s) => sum + (s.historyDaysFetched ?? 0),
          0
        );
        const afterSuccess = Object.values(bootstrapState.perSymbol).filter(
          (s) => (s.lastHistoryFetchSuccessAt ?? 0) > 0
        ).length;

        const progressed =
          afterTotalHistory > beforeTotalHistory ||
          afterSuccess > beforeSuccess ||
          res.callsConsumed > 0 ||
          res.firestoreCacheChunksServed > 0;

        if (!progressed) {
          noProgressIterations += 1;
        } else {
          noProgressIterations = 0;
        }

        if (bootstrapAllComplete) {
          bootstrapStopReason = 'all_complete';
          break;
        }
        if (noProgressIterations >= DEBUG_MAX_NO_PROGRESS_ITERATIONS) {
          bootstrapStopReason = 'no_progress';
          break;
        }
      }

      if (!bootstrapAllComplete && bootstrapStopReason !== 'no_progress') {
        bootstrapStopReason = 'max_calls_reached';
      }

      steps.push({
        step: 'tickIsmBootstrap',
        status: 'ok',
        detail: `iterations=${bootstrapIterations}, providerApiCalls=${bootstrapProviderApiCalls}, firestoreChunks=${bootstrapFirestoreCacheChunks}, stop=${bootstrapStopReason}, lastTick=${lastTickStoppedReason}, budgetLimit=${String(DEBUG_BOOTSTRAP_DAILY_CALL_BUDGET_LIMIT)}, allComplete=${String(bootstrapAllComplete)}`,
      });

      // 4) saveOfficialIsmFetchEngineState
      let stateAfterSave = bootstrapState;
      try {
        await saveOfficialIsmFetchEngineState(user, bootstrapState);
        const reloaded = await loadOfficialIsmFetchEngineState(user);
        stateAfterSave = reloaded ?? bootstrapState;
        const persisted =
          reloaded != null &&
          typeof reloaded.lastSavedAt === 'number' &&
          reloaded.lastSavedAt >= bootstrapState.lastSavedAt;
        steps.push({
          step: 'saveOfficialIsmFetchEngineState',
          status: persisted ? 'ok' : 'warn',
          detail: persisted
            ? 'engine state saved and reloaded'
            : 'save call completed but persisted state could not be confirmed (possible permission/rules block)',
        });
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'saveOfficialIsmFetchEngineState',
          status: 'failed',
          detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
        });
      }

      const usdPerUnitByCurrency = await buildUsdPerUnitByCurrency(ingestRows);
      const latestPriceDateBySymbolId = getLatestPriceDateBySymbolId(stateAfterSave);

      // 5) runWeeklyIsmSectorRebalances
      const weeklyResults = await runWeeklyIsmSectorRebalances(user, {
        rows: ingestRows,
        rebalanceDate: isoTodayUtc(),
        rebalanceTimestampMs: Date.now(),
        marketCapSnapshotTimestampMs: Date.now(),
        priceSnapshotTimestampMs: Date.now(),
        fxSnapshotTimestampMs: Date.now(),
        getHasEntryExitRow,
        usdPerUnitByCurrency,
        fetchEngineState: stateAfterSave,
        latestPriceDateBySymbolId,
        previousBySectorId: new Map(),
      });
      const miningWeekly = weeklyResults.find((x) => x.sector_id === 'mining');
      weeklyMiningCreated = Boolean(miningWeekly?.persisted);
      steps.push({
        step: 'runWeeklyIsmSectorRebalances',
        status: weeklyResults.some((x) => !x.persisted) ? 'warn' : 'ok',
        detail: miningWeekly
          ? `Mining persisted=${String(miningWeekly.persisted)}${miningWeekly.errors?.length ? ` errors=${miningWeekly.errors.join(' | ')}` : ''}`
          : 'Mining sector not present in weekly run result',
      });

      // 6) runDailyIsmSectorIndex for sectors with active snapshot (backend EOD cache only in debug)
      const bySector = new Map<string, ISMInstrumentIngest[]>();
      for (const row of ingestRows) {
        const sectorId = ismSectorIdFromName(row.sectorIsm);
        const bucket = bySector.get(sectorId) ?? [];
        bucket.push(row);
        bySector.set(sectorId, bucket);
      }

      const dayTo = isoTodayUtc();
      const { fromIso: postureFromIso, toIso: postureToIso } = postureEodWindowFromTradeDate(dayTo);

      let spyHistory: number[] = [];
      let activeSectorCount = 0;
      let dailyOkCount = 0;

      spyHistory = await fetchEodCloseSeriesForTicker(
        'SPY',
        postureFromIso,
        postureToIso,
        undefined,
        postureEodOpts
      );
      if (spyHistory.length === 0) {
        steps.push({
          step: 'runDailyIsmSectorIndex',
          status: 'warn',
          detail:
            'SPY window empty in value-insight-be EOD cache (debug sync uses /eod-adjusted-daily only).',
        });
      }

      for (const [sectorId, sectorRows] of bySector.entries()) {
        let activeSnapshot: Record<string, unknown> | null = null;
        try {
          activeSnapshot = await loadActiveSectorRebalanceSnapshot(user, sectorId);
        } catch (e) {
          const msg = errorMessage(e);
          if (sectorId === 'mining') {
            steps.push({
              step: 'loadActiveSectorRebalanceSnapshot[mining]',
              status: 'failed',
              detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
            });
          }
          continue;
        }
        if (!activeSnapshot) continue;
        activeSectorCount += 1;

        const rowsForDaily: RebalanceRowInput[] = sectorRows.map((ingest) => {
          const c = ingest.currency.trim().toUpperCase();
          return {
            ingest,
            hasEntryExitRow: getHasEntryExitRow(ingest.tickerRaw, ingest.companyName),
            usdPerUnitLocalCurrency: c ? (usdPerUnitByCurrency.get(c) ?? null) : null,
            fetchState: stateAfterSave.perSymbol[ingest.symbolId] ?? null,
            latestPriceDateIso: latestPriceDateBySymbolId[ingest.symbolId] ?? null,
          };
        });

        const latestCloseBySymbolId: Record<string, number | null | undefined> = {};
        const constituentHistoryBySymbolId: Record<string, number[]> = {};
        const ingestBySymbolId = new Map(sectorRows.map((r) => [r.symbolId, r]));
        const cons = Array.isArray(activeSnapshot.constituents)
          ? activeSnapshot.constituents
          : [];

        const refs = collectConstituentFetchRefs(cons, ingestBySymbolId);
        const fetchedHistories = await fetchConstituentCloseHistories(
          refs,
          postureFromIso,
          postureToIso,
          ISM_POSTURE_EOD_FETCH_BATCH_SIZE,
          undefined,
          postureEodOpts
        );

        for (const item of cons) {
          if (!item || typeof item !== 'object') continue;
          const row = item as Record<string, unknown>;
          if (typeof row.symbol_id !== 'string') continue;
          const symbolId = row.symbol_id;
          const ingest = ingestBySymbolId.get(symbolId);
          const fallbackLastClose =
            typeof row.last_close === 'number' && Number.isFinite(row.last_close)
              ? row.last_close
              : null;

          if (!ingest) {
            latestCloseBySymbolId[symbolId] = fallbackLastClose;
            constituentHistoryBySymbolId[symbolId] =
              fallbackLastClose != null ? [fallbackLastClose] : [];
            continue;
          }

          const hist = fetchedHistories[symbolId] ?? [];
          const lastClose = hist.length > 0 ? hist[hist.length - 1]! : fallbackLastClose;
          latestCloseBySymbolId[symbolId] = lastClose ?? undefined;
          constituentHistoryBySymbolId[symbolId] =
            hist.length > 0 ? hist : fallbackLastClose != null ? [fallbackLastClose] : [];
        }

        const sectorSeriesDocs = await fetchSectorIndexDailyInRange(
          sectorId,
          postureFromIso,
          addCalendarDays(dayTo, -1)
        );
        const sectorIndexHistory = sectorSeriesDocs
          .map((d) => d.index_value)
          .filter((x): x is number => x != null && Number.isFinite(x) && x > 0);

        if (
          sectorIndexHistory.length === 0 &&
          typeof activeSnapshot.index_open_post_rebalance_target === 'number' &&
          Number.isFinite(activeSnapshot.index_open_post_rebalance_target) &&
          activeSnapshot.index_open_post_rebalance_target > 0
        ) {
          sectorIndexHistory.push(activeSnapshot.index_open_post_rebalance_target);
        }

        try {
          const daily = await runDailyIsmSectorIndex({
            user,
            sectorId,
            tradeDate: dayTo,
            rows: rowsForDaily,
            latestCloseBySymbolId,
            spy_close_history: spyHistory,
            sector_index_history: sectorIndexHistory,
            constituent_close_history_by_symbol_id: constituentHistoryBySymbolId,
            price_snapshot_timestamp_ms: Date.now(),
            fx_snapshot_timestamp_ms: Date.now(),
          });
          if (daily.ok) {
            dailyOkCount += 1;
            if (sectorId === 'mining') dailyMiningCreated = true;
          }
          if (!daily.ok && sectorId === 'mining') {
            steps.push({
              step: 'runDailyIsmSectorIndex[mining]',
              status: 'warn',
              detail: `Mining daily failed: ${daily.error}`,
            });
          }
        } catch (e) {
          const msg = errorMessage(e);
          if (sectorId === 'mining') {
            steps.push({
              step: 'runDailyIsmSectorIndex[mining]',
              status: 'failed',
              detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
            });
          }
        }
      }

      steps.push({
        step: 'runDailyIsmSectorIndex',
        status: dailyOkCount > 0 ? 'ok' : activeSectorCount > 0 ? 'warn' : 'ok',
        detail: `activeSnapshots=${activeSectorCount}, dailyOk=${dailyOkCount}`,
      });

      const miningMetrics = miningRows.map((r) =>
        computeIsmRebalanceRowMetrics({
          ingest: r,
          hasEntryExitRow: getHasEntryExitRow(r.tickerRaw, r.companyName),
          usdPerUnitLocalCurrency: r.currency
            ? (usdPerUnitByCurrency.get(r.currency.trim().toUpperCase()) ?? null)
            : null,
          fetchState: stateAfterSave.perSymbol[r.symbolId] ?? null,
          latestPriceDateIso: latestPriceDateBySymbolId[r.symbolId] ?? null,
        })
      );
      const historyValues = miningMetrics.map((m) => m.historyDaysAvailable);
      const dataReadyCount = miningMetrics.filter(
        (m) => m.identityOk && m.currencyReady && m.hasPriceSignal
      ).length;
      const traceFrom = addCalendarDays(isoTodayUtc(), -89);
      const traceTo = isoTodayUtc();
      const miningSymbolTraces: IsmMiningSymbolTrace[] = [];
      for (const row of miningTop5) {
        const traced = await traceMiningEodFirestoreWindow(row, traceFrom, traceTo);
        const before = miningBeforeState.get(row.symbolId) ?? { history: 0, latest: null };
        const afterHistory = stateAfterSave.perSymbol[row.symbolId]?.historyDaysFetched ?? 0;
        const afterLatest = isoFromMillis(stateAfterSave.perSymbol[row.symbolId]?.lastHistoryFetchSuccessAt ?? null);
        const hasValidAttempt = traced.attempts.some((a) => a.resultType === 'valid');
        const stop =
          hasValidAttempt && afterHistory === before.history && !afterLatest
            ? 'valid_firestore_cache_but_fetch_state_not_advanced_for_symbol_in_this_run'
            : traced.firstStop;
        miningSymbolTraces.push({
          companyName: row.companyName,
          tickerRaw: row.tickerRaw,
          symbolId: row.symbolId,
          providerAttemptOrder: ['eodhd'],
          attempts: traced.attempts,
          firstStop: stop,
          beforeHistoryDaysAvailable: before.history,
          afterHistoryDaysAvailable: afterHistory,
          beforeLatestPriceDate: before.latest,
          afterLatestPriceDate: afterLatest,
        });
      }

      setReport({
        startedAt,
        finishedAt: new Date().toISOString(),
        bootstrapIterations,
        bootstrapProviderApiCalls,
        bootstrapFirestoreCacheChunks,
        bootstrapStopReason,
        apiKeysStatus,
        steps,
        miningSymbolTraces,
        mining: {
          dashboardRows: miningRows.length,
          symbolIdReady: miningRows.filter(
            (r) => !r.quality.missingTicker && !r.quality.tickerNeedsReview && r.symbolId.trim().length > 0
          ).length,
          withCurrency: miningRows.filter((r) => !r.quality.missingCurrency).length,
          withMarketCapUsd: miningMetrics.filter((m) => m.marketCapUsd != null).length,
          withHistoryDaysAvailable: miningMetrics.filter((m) => m.historyDaysAvailable > 0).length,
          historyDaysMin: historyValues.length > 0 ? Math.min(...historyValues) : 0,
          historyDaysMedian: median(historyValues),
          historyDaysMax: historyValues.length > 0 ? Math.max(...historyValues) : 0,
          withLatestPriceDate: miningMetrics.filter((m) => m.latestPriceDate != null).length,
          withSufficientHistory: miningMetrics.filter((m) => m.hasSufficientHistory).length,
          dataReady: dataReadyCount,
          qualified: miningMetrics.filter((m) => m.qualified).length,
          weeklySnapshotCreated: weeklyMiningCreated,
          dailyDocCreated: dailyMiningCreated,
        },
      });
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      setReport({
        startedAt,
        finishedAt: new Date().toISOString(),
        steps: [
          ...steps,
          {
            step: 'debug-run',
            status: 'failed',
            detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
          },
        ],
        mining: {
          dashboardRows: 0,
          symbolIdReady: 0,
          withCurrency: 0,
          withMarketCapUsd: 0,
          withHistoryDaysAvailable: 0,
          historyDaysMin: 0,
          historyDaysMedian: 0,
          historyDaysMax: 0,
          withLatestPriceDate: 0,
          withSufficientHistory: 0,
          dataReady: 0,
          qualified: 0,
          weeklySnapshotCreated: false,
          dailyDocCreated: false,
        },
        bootstrapIterations: 0,
        bootstrapProviderApiCalls: 0,
        bootstrapFirestoreCacheChunks: 0,
        bootstrapStopReason: 'no_progress',
        apiKeysStatus: {
          eodhd: false,
        },
        miningSymbolTraces: [],
      });
    } finally {
      setRunning(false);
    }
  }, [getHasEntryExitRow, ingestRows, running, user]);

  return { running, report, error, runDebugSync };
}
