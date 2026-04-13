import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import {
  buildSymbolTranslationContext,
  fetchIsmLatestDailyCloseWithFallback,
  fetchIsmUsdFxRatesWithFallback,
} from '../marketData';
import {
  ISM_DEFAULT_DAILY_CALL_BUDGET,
  ISM_DAILY_MAX_PRICE_FETCHES_PER_INVOCATION,
  ISM_FX_MIN_INTERVAL_MS,
} from './constants';
import type { IsmFetchMarketDeps } from './deps';
import { defaultSymbolState, ensureDailyBudgetWindow } from './stateHelpers';
import type { IsmDailyTickResult, IsmFetchEngineState, IsmSymbolFetchState } from './types';

function putSymbol(state: IsmFetchEngineState, id: string, sym: IsmSymbolFetchState): IsmFetchEngineState {
  return { ...state, perSymbol: { ...state.perSymbol, [id]: sym } };
}

function advanceDailyCursor(state: IsmFetchEngineState, n: number): IsmFetchEngineState {
  if (n === 0) return state;
  return { ...state, dailyCursor: (state.dailyCursor + 1) % n };
}

/**
 * Daily refresh: latest closes (no full history), optional FX when stale, resume provider/key per symbol.
 */
export async function tickIsmDaily(
  input: IsmFetchEngineState,
  ingestBySymbolId: Map<string, ISMInstrumentIngest>,
  deps: IsmFetchMarketDeps,
  signal?: AbortSignal
): Promise<IsmDailyTickResult> {
  let state = ensureDailyBudgetWindow(input);
  const limit = deps.dailyCallBudgetLimit ?? ISM_DEFAULT_DAILY_CALL_BUDGET;
  const ordered = state.bootstrapOrderedSymbolIds;
  const n = ordered.length;
  let callsConsumed = 0;

  if (n === 0) {
    return { state, callsConsumed: 0, stoppedReason: 'daily_idle' };
  }

  let priceFetches = 0;
  while (priceFetches < ISM_DAILY_MAX_PRICE_FETCHES_PER_INVOCATION && state.dailyCallBudgetUsed < limit) {
    const id = ordered[state.dailyCursor]!;
    const ingest = ingestBySymbolId.get(id);
    if (!ingest) {
      state = advanceDailyCursor(state, n);
      priceFetches++;
      continue;
    }

    const sym = state.perSymbol[id] ?? defaultSymbolState(id);
    const ctx = buildSymbolTranslationContext(ingest.tickerRaw);
    const res = await fetchIsmLatestDailyCloseWithFallback(
      ctx,
      'daily',
      deps.pools,
      deps.adapters,
      signal,
      { resume: sym.priceProviderLastSuccess }
    );

    callsConsumed += 1;
    priceFetches += 1;
    const now = Date.now();
    const nextSym: IsmSymbolFetchState = {
      ...sym,
      lastDailyPriceFetchAt: now,
      priceProviderLastUsed: res.meta.lastSuccess?.providerId ?? sym.priceProviderLastUsed,
      priceProviderLastSuccess: res.meta.lastSuccess ?? sym.priceProviderLastSuccess,
    };
    state = advanceDailyCursor(
      {
        ...putSymbol(state, id, nextSym),
        dailyCallBudgetUsed: state.dailyCallBudgetUsed + 1,
      },
      n
    );

    if (state.dailyCallBudgetUsed >= limit) {
      return { state, callsConsumed, stoppedReason: 'budget_exhausted' };
    }
  }

  const fxStale =
    state.lastFxFetchAt === null || Date.now() - state.lastFxFetchAt > ISM_FX_MIN_INTERVAL_MS;
  if (fxStale && state.dailyCallBudgetUsed < limit) {
    const fxRes = await fetchIsmUsdFxRatesWithFallback(
      'daily',
      deps.pools,
      deps.adapters,
      signal,
      { resume: state.fxLastSuccess }
    );
    callsConsumed += 1;
    state = { ...state, dailyCallBudgetUsed: state.dailyCallBudgetUsed + 1 };
    if (fxRes.outcome === 'valid') {
      state = {
        ...state,
        lastFxFetchAt: Date.now(),
        fxLastSuccess: fxRes.meta.lastSuccess ?? state.fxLastSuccess,
      };
    }
  }

  return {
    state,
    callsConsumed,
    stoppedReason: state.dailyCallBudgetUsed >= limit ? 'budget_exhausted' : 'daily_idle',
  };
}
