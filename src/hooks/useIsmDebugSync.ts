import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ISMInstrumentIngest } from '../types/ismIngest';
import { getApiKeys } from '../config/apiKeys';
import { ismSectorIdFromName } from '../services/ism/rebalance/sectorSlug';
import { addCalendarDays } from '../services/ism/fetchEngine';
import {
  buildSymbolTranslationContext,
  translateForProvider,
} from '../services/ism/marketData';
import { tryReadAdjustedEodDailyBarsInRange } from '../services/eodAdjustedDataService';
import {
  fetchEodAdjustedDaily,
  fetchIsmSectorDetailFromApi,
  fetchIsmSymbolFromApi,
  postIsmDailyIndexRunAll,
  postIsmRebalanceRunAll,
  postIsmSymbolsSync,
} from '../services/valueInsightClient';

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
  bootstrapProviderApiCalls: number;
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

function isoTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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

function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00.000Z`);
  const to = new Date(`${toIso}T12:00:00.000Z`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

async function traceMiningEodFirestoreWindow(
  ingest: ISMInstrumentIngest,
  fromIso: string,
  toIso: string
): Promise<{ attempts: IsmProviderAttemptDebug[]; firstStop: string; historyDays: number; lastDate: string | null }> {
  const ctx = buildSymbolTranslationContext(ingest.tickerRaw);
  const translated = translateForProvider('eodhd', ctx).symbol;
  const bars = await tryReadAdjustedEodDailyBarsInRange(ingest.tickerRaw, fromIso, toIso);
  if (bars && bars.length > 0) {
    const historyDays = calendarDaysBetween(bars[0]!.date, bars[bars.length - 1]!.date);
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
      historyDays,
      lastDate: bars[bars.length - 1]!.date,
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
    historyDays: 0,
    lastDate: null,
  };
}

function emptyMiningSummary(): IsmMiningDebugSummary {
  return {
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
  };
}

export function useIsmDebugSync(
  user: User | null,
  ingestRows: ISMInstrumentIngest[]
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

    const miningRows = ingestRows.filter((r) => ismSectorIdFromName(r.sectorIsm) === 'mining');
    const miningTop5 = miningRows.slice(0, 5);
    let weeklyMiningCreated = false;
    let dailyMiningCreated = false;
    let bootstrapFirestoreCacheChunks = 0;

    const apiKeys = getApiKeys();
    const apiKeysStatus = { eodhd: Boolean(apiKeys.eodhd?.trim()) };

    try {
      try {
        const syncRes = await postIsmSymbolsSync(user);

        let miningDocsReadable = 0;
        for (const row of miningRows) {
          try {
            await fetchIsmSymbolFromApi(row.symbolId);
            miningDocsReadable += 1;
          } catch {
            // missing or unreadable
          }
        }
        steps.push({
          step: 'postIsmSymbolsSync',
          status: syncRes.ok ? 'ok' : 'warn',
          detail:
            miningRows.length > 0
              ? `symbols synced=${String(syncRes.syncedCount ?? syncRes.ok)}; readable Mining docs: ${miningDocsReadable}/${miningRows.length}`
              : `symbols synced=${String(syncRes.syncedCount ?? syncRes.ok)}; no Mining rows in ingest`,
        });
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'postIsmSymbolsSync',
          status: 'failed',
          detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
        });
      }

      try {
        const eodWarm = await fetchEodAdjustedDaily({ includeBars: true });
        bootstrapFirestoreCacheChunks =
          (eodWarm.cacheHitCount ?? 0) +
          (eodWarm.staleCacheCount ?? 0) +
          (eodWarm.fetchQueuedCount ?? 0);
        steps.push({
          step: 'warmEodAdjustedDaily',
          status: 'ok',
          detail: `cacheHit=${eodWarm.cacheHitCount ?? 0}, fetchQueued=${eodWarm.fetchQueuedCount ?? 0}, eodhdApiCalls=${eodWarm.eodhdApiCalls ?? 0}`,
        });
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'warmEodAdjustedDaily',
          status: 'warn',
          detail: msg,
        });
      }

      try {
        const rebalanceRes = await postIsmRebalanceRunAll(user);
        const miningStep = rebalanceRes.steps?.find((s) => s.step === 'persistRebalanceSnapshot');
        weeklyMiningCreated = rebalanceRes.ok;
        steps.push({
          step: 'postIsmRebalanceRunAll',
          status: rebalanceRes.ok ? 'ok' : 'warn',
          detail: rebalanceRes.ok
            ? `ok=${String(rebalanceRes.ok)}${rebalanceRes.errors?.length ? ` errors=${rebalanceRes.errors.join(' | ')}` : ''}`
            : rebalanceRes.errors?.join(' | ') ?? 'rebalance failed',
        });
        if (miningStep) {
          steps.push({ step: 'backendRebalanceDetail', status: miningStep.status, detail: miningStep.detail });
        }
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'postIsmRebalanceRunAll',
          status: 'failed',
          detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
        });
      }

      try {
        const dailyRes = await postIsmDailyIndexRunAll(user);
        dailyMiningCreated = dailyRes.ok;
        steps.push({
          step: 'postIsmDailyIndexRunAll',
          status: dailyRes.ok ? 'ok' : 'warn',
          detail: dailyRes.steps?.find((s) => s.step === 'runAllDailyIndex')?.detail ?? String(dailyRes.ok),
        });
      } catch (e) {
        const msg = errorMessage(e);
        steps.push({
          step: 'postIsmDailyIndexRunAll',
          status: 'failed',
          detail: `${msg}${permissionHint(msg) ? ` ${permissionHint(msg)}` : ''}`,
        });
      }

      try {
        const miningDetail = await fetchIsmSectorDetailFromApi('mining');
        weeklyMiningCreated = weeklyMiningCreated && (miningDetail.constituents?.length ?? 0) > 0;
        dailyMiningCreated = dailyMiningCreated && !miningDetail.missingDailyDoc;
        steps.push({
          step: 'verifyMiningSectorDetail',
          status: 'ok',
          detail: `constituents=${miningDetail.constituents?.length ?? 0}, missingDailyDoc=${String(miningDetail.missingDailyDoc)}`,
        });
      } catch (e) {
        steps.push({
          step: 'verifyMiningSectorDetail',
          status: 'warn',
          detail: errorMessage(e),
        });
      }

      const traceFrom = addCalendarDays(isoTodayUtc(), -89);
      const traceTo = isoTodayUtc();
      const miningSymbolTraces: IsmMiningSymbolTrace[] = [];
      const historyValues: number[] = [];

      for (const row of miningTop5) {
        const traced = await traceMiningEodFirestoreWindow(row, traceFrom, traceTo);
        historyValues.push(traced.historyDays);
        miningSymbolTraces.push({
          companyName: row.companyName,
          tickerRaw: row.tickerRaw,
          symbolId: row.symbolId,
          providerAttemptOrder: ['eodhd'],
          attempts: traced.attempts,
          firstStop: traced.firstStop,
          beforeHistoryDaysAvailable: 0,
          afterHistoryDaysAvailable: traced.historyDays,
          beforeLatestPriceDate: null,
          afterLatestPriceDate: traced.lastDate,
        });
      }

      const withSufficientHistory = historyValues.filter((d) => d >= 300).length;
      const withHistory = historyValues.filter((d) => d > 0).length;
      const withLatestPriceDate = miningSymbolTraces.filter((t) => t.afterLatestPriceDate != null).length;

      setReport({
        startedAt,
        finishedAt: new Date().toISOString(),
        bootstrapIterations: 0,
        bootstrapProviderApiCalls: 0,
        bootstrapFirestoreCacheChunks,
        bootstrapStopReason: 'all_complete',
        apiKeysStatus,
        steps,
        miningSymbolTraces,
        mining: {
          dashboardRows: miningRows.length,
          symbolIdReady: miningRows.filter(
            (r) => !r.quality.missingTicker && !r.quality.tickerNeedsReview && r.symbolId.trim().length > 0
          ).length,
          withCurrency: miningRows.filter((r) => !r.quality.missingCurrency).length,
          withMarketCapUsd: miningRows.filter((r) => r.marketCap != null && r.marketCap > 0).length,
          withHistoryDaysAvailable: withHistory,
          historyDaysMin: historyValues.length > 0 ? Math.min(...historyValues) : 0,
          historyDaysMedian: median(historyValues),
          historyDaysMax: historyValues.length > 0 ? Math.max(...historyValues) : 0,
          withLatestPriceDate,
          withSufficientHistory,
          dataReady: miningRows.filter((r) => !r.quality.missingTicker && !r.quality.missingCurrency).length,
          qualified: 0,
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
        mining: emptyMiningSummary(),
        bootstrapIterations: 0,
        bootstrapProviderApiCalls: 0,
        bootstrapFirestoreCacheChunks,
        bootstrapStopReason: 'no_progress',
        apiKeysStatus,
        miningSymbolTraces: [],
      });
    } finally {
      setRunning(false);
    }
  }, [ingestRows, running, user]);

  return { running, report, error, runDebugSync };
}
