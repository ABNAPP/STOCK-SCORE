/**
 * Chunked history backfill for fetch-engine **state only** (progress counters / resume).
 * ISM posture math (`computeDailySectorIndex`) uses `fetchPostureEodInputs` (cache first, optional EODHD).
 * Debug sync passes `bootstrapHistorySource: 'firestore_cache_only'` so this loop never hits providers.
 */
import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  fetchIsmHistoricalDailyWithFallback,
  buildSymbolTranslationContext,
  translateForProvider,
} from '../marketData';
import { metaBase, withSuccessMeta, isValidDailyBars, failedResult } from '../marketData/resultHelpers';
import type { IsmMarketDataResult, IsmDailyBar } from '../marketData/types';
import { tryReadAdjustedEodDailyBarsInRange } from '../../eodAdjustedDataService';
import {
  ISM_BOOTSTRAP_MAX_SYMBOLS_PER_INVOCATION,
  ISM_DEFAULT_DAILY_CALL_BUDGET,
  ISM_HISTORY_CHUNK_DAYS,
  ISM_HISTORY_TARGET_DAYS,
  ISM_MAX_HISTORY_FAILURES_BEFORE_BLOCK,
} from './constants';
import { addCalendarDays, daysInclusive, isoTodayUtc } from './dateUtils';
import type { IsmFetchMarketDeps } from './deps';
import { defaultSymbolState, ensureDailyBudgetWindow } from './stateHelpers';
import type { IsmBootstrapTickResult, IsmFetchEngineState, IsmSymbolFetchState } from './types';

function advanceBootstrapCursor(state: IsmFetchEngineState, n: number): IsmFetchEngineState {
  if (n === 0) return state;
  return { ...state, bootstrapCursor: (state.bootstrapCursor + 1) % n };
}

function allBootstrapComplete(state: IsmFetchEngineState, ordered: string[]): boolean {
  if (ordered.length === 0) return true;
  return ordered.every((id) => {
    const st = state.perSymbol[id]?.historyBootstrapStatus;
    return st === 'complete' || st === 'blocked';
  });
}

function putSymbol(state: IsmFetchEngineState, id: string, sym: IsmSymbolFetchState): IsmFetchEngineState {
  return { ...state, perSymbol: { ...state.perSymbol, [id]: sym } };
}

/**
 * One non-blocking bootstrap step: up to `ISM_BOOTSTRAP_MAX_SYMBOLS_PER_INVOCATION` history calls,
 * same-symbol resume via `historyBootstrapNextChunkEnd`, budget-aware stop.
 */
export async function tickIsmBootstrap(
  input: IsmFetchEngineState,
  ingestBySymbolId: Map<string, ISMInstrumentIngest>,
  deps: IsmFetchMarketDeps,
  signal?: AbortSignal
): Promise<IsmBootstrapTickResult> {
  let state = ensureDailyBudgetWindow(input);
  const limit = deps.dailyCallBudgetLimit ?? ISM_DEFAULT_DAILY_CALL_BUDGET;
  const ordered = state.bootstrapOrderedSymbolIds;
  const n = ordered.length;
  let callsConsumed = 0;
  let firestoreCacheChunksServed = 0;

  if (n === 0) {
    return {
      state,
      callsConsumed: 0,
      firestoreCacheChunksServed: 0,
      stoppedReason: 'bootstrap_idle',
      bootstrapAllComplete: true,
    };
  }

  if (allBootstrapComplete(state, ordered)) {
    return {
      state,
      callsConsumed: 0,
      firestoreCacheChunksServed: 0,
      stoppedReason: 'bootstrap_all_complete',
      bootstrapAllComplete: true,
    };
  }

  let fetchChunksThisInvocation = 0;
  let skipsWithoutFetch = 0;

  while (fetchChunksThisInvocation < ISM_BOOTSTRAP_MAX_SYMBOLS_PER_INVOCATION) {
    if (state.dailyCallBudgetUsed >= limit) {
      return {
        state,
        callsConsumed,
        firestoreCacheChunksServed,
        stoppedReason: 'budget_exhausted',
        bootstrapAllComplete: allBootstrapComplete(state, ordered),
      };
    }

    if (allBootstrapComplete(state, ordered)) {
      return {
        state,
        callsConsumed,
        firestoreCacheChunksServed,
        stoppedReason: 'bootstrap_all_complete',
        bootstrapAllComplete: true,
      };
    }

    const id = ordered[state.bootstrapCursor]!;
    const ingest = ingestBySymbolId.get(id);
    let sym = state.perSymbol[id] ?? defaultSymbolState(id);

    if (sym.historyBootstrapStatus === 'complete' || sym.historyBootstrapStatus === 'blocked') {
      state = advanceBootstrapCursor(state, n);
      skipsWithoutFetch++;
      if (skipsWithoutFetch >= n) break;
      continue;
    }

    if (!ingest) {
      state = advanceBootstrapCursor(state, n);
      skipsWithoutFetch++;
      if (skipsWithoutFetch >= n) break;
      continue;
    }

    skipsWithoutFetch = 0;

    if (sym.historyBootstrapStatus === 'not_started') {
      sym = { ...sym, historyBootstrapStatus: 'in_progress' };
      state = putSymbol(state, id, sym);
    }

    const today = isoTodayUtc();
    const horizonOldest = addCalendarDays(today, -(ISM_HISTORY_TARGET_DAYS - 1));
    const nextEnd = sym.historyBootstrapNextChunkEnd ?? today;

    if (nextEnd < horizonOldest) {
      sym = { ...sym, historyBootstrapStatus: 'complete' };
      state = advanceBootstrapCursor(putSymbol(state, id, sym), n);
      continue;
    }

    const from = addCalendarDays(nextEnd, -(ISM_HISTORY_CHUNK_DAYS - 1));
    const fromClamped = from < horizonOldest ? horizonOldest : from;
    const to = nextEnd;

    if (fromClamped > to) {
      sym = { ...sym, historyBootstrapStatus: 'complete' };
      state = advanceBootstrapCursor(putSymbol(state, id, sym), n);
      continue;
    }

    if (state.dailyCallBudgetUsed >= limit) {
      return {
        state,
        callsConsumed,
        firestoreCacheChunksServed,
        stoppedReason: 'budget_exhausted',
        bootstrapAllComplete: allBootstrapComplete(state, ordered),
      };
    }

    const now = Date.now();
    sym = { ...sym, lastHistoryFetchAttemptAt: now };
    state = putSymbol(state, id, sym);

    const ctx = buildSymbolTranslationContext(ingest.tickerRaw);
    const providerSymbol = translateForProvider('eodhd', ctx).symbol;

    let res: IsmMarketDataResult<IsmDailyBar[]>;
    if (deps.bootstrapHistorySource === 'firestore_cache_only') {
      const bars = await tryReadAdjustedEodDailyBarsInRange(ingest.tickerRaw, fromClamped, to);
      const base = metaBase('bootstrap', ['backend_eod_adjusted_daily']);
      if (bars != null && isValidDailyBars(bars)) {
        res = withSuccessMeta(base, 'eodhd', 0, 'backend', providerSymbol, bars);
        firestoreCacheChunksServed += 1;
      } else {
        res = failedResult(base, 'backend_cache_miss', providerSymbol);
      }
    } else {
      res = await fetchIsmHistoricalDailyWithFallback(
        ctx,
        fromClamped,
        to,
        'bootstrap',
        deps.pools,
        deps.adapters,
        signal,
        { resume: sym.priceProviderLastSuccess }
      );
      callsConsumed += 1;
      state = { ...state, dailyCallBudgetUsed: state.dailyCallBudgetUsed + 1 };
    }

    fetchChunksThisInvocation += 1;

    if (res.outcome === 'valid') {
      const addedDays = daysInclusive(fromClamped, to);
      const nextChunkEnd = addCalendarDays(fromClamped, -1);
      sym = {
        ...sym,
        historyDaysFetched: sym.historyDaysFetched + addedDays,
        lastHistoryFetchSuccessAt: now,
        historyBootstrapNextChunkEnd: nextChunkEnd,
        fetchFailureCount: 0,
        priceProviderLastSuccess: res.meta.lastSuccess ?? sym.priceProviderLastSuccess,
        priceProviderLastUsed: res.meta.lastSuccess?.providerId ?? sym.priceProviderLastUsed,
      };
      const done =
        nextChunkEnd < horizonOldest || sym.historyDaysFetched >= ISM_HISTORY_TARGET_DAYS;
      if (done) {
        sym = { ...sym, historyBootstrapStatus: 'complete' };
        state = advanceBootstrapCursor(putSymbol(state, id, sym), n);
      } else {
        state = putSymbol(state, id, sym);
      }
    } else {
      const fails = sym.fetchFailureCount + 1;
      const blocked = fails >= ISM_MAX_HISTORY_FAILURES_BEFORE_BLOCK;
      sym = {
        ...sym,
        fetchFailureCount: fails,
        historyBootstrapStatus: blocked ? 'blocked' : sym.historyBootstrapStatus,
        priceProviderLastUsed: res.meta.lastSuccess?.providerId ?? sym.priceProviderLastUsed,
      };
      state = putSymbol(state, id, sym);
      if (blocked) {
        state = advanceBootstrapCursor(state, n);
      }
    }

    if (state.dailyCallBudgetUsed >= limit) {
      return {
        state,
        callsConsumed,
        firestoreCacheChunksServed,
        stoppedReason: 'budget_exhausted',
        bootstrapAllComplete: allBootstrapComplete(state, ordered),
      };
    }
  }

  const bootstrapAllComplete = allBootstrapComplete(state, ordered);
  return {
    state,
    callsConsumed,
    firestoreCacheChunksServed,
    stoppedReason: bootstrapAllComplete
      ? 'bootstrap_all_complete'
      : state.dailyCallBudgetUsed >= limit
        ? 'budget_exhausted'
        : 'bootstrap_idle',
    bootstrapAllComplete,
  };
}
