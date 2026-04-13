import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import type { IsmFetchEngineState, IsmSymbolFetchState, HistoryBootstrapStatus } from './types';
import type { IsmMarketProviderId } from '../marketData/types';
import { computeBootstrapSymbolOrder } from './symbolOrder';

function localBudgetDayLabel(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Reset daily counter when the local calendar day changes. */
export function ensureDailyBudgetWindow(state: IsmFetchEngineState): IsmFetchEngineState {
  const today = localBudgetDayLabel();
  if (state.dailyCallBudgetDay === today) return state;
  return {
    ...state,
    dailyCallBudgetDay: today,
    dailyCallBudgetUsed: 0,
  };
}

export function defaultSymbolState(symbolId: string): IsmSymbolFetchState {
  return {
    symbolId,
    historyBootstrapStatus: 'not_started',
    historyDaysFetched: 0,
    lastHistoryFetchAttemptAt: null,
    lastHistoryFetchSuccessAt: null,
    lastDailyPriceFetchAt: null,
    priceProviderLastUsed: null,
    priceProviderLastSuccess: null,
    fetchFailureCount: 0,
    historyBootstrapNextChunkEnd: null,
  };
}

export function getOrCreateSymbolState(state: IsmFetchEngineState, symbolId: string): IsmSymbolFetchState {
  const existing = state.perSymbol[symbolId];
  if (existing) return existing;
  const created = defaultSymbolState(symbolId);
  state.perSymbol[symbolId] = created;
  return created;
}

export function createEmptyEngineState(
  orderedSymbolIds: string[],
  fingerprint: string
): IsmFetchEngineState {
  const perSymbol: Record<string, IsmSymbolFetchState> = {};
  for (const id of orderedSymbolIds) {
    perSymbol[id] = defaultSymbolState(id);
  }
  return {
    schemaVersion: 1,
    universeFingerprint: fingerprint,
    lastSavedAt: Date.now(),
    dailyCallBudgetUsed: 0,
    dailyCallBudgetDay: localBudgetDayLabel(),
    bootstrapOrderedSymbolIds: [...orderedSymbolIds],
    bootstrapCursor: 0,
    dailyCursor: 0,
    perSymbol,
    lastFxFetchAt: null,
    fxLastSuccess: null,
  };
}

export function mergeEngineStateWithUniverse(
  prev: IsmFetchEngineState | null,
  orderedSymbolIds: string[],
  fingerprint: string
): IsmFetchEngineState {
  if (!prev || prev.universeFingerprint !== fingerprint) {
    const next = createEmptyEngineState(orderedSymbolIds, fingerprint);
    if (!prev) return next;
    for (const id of orderedSymbolIds) {
      const old = prev.perSymbol[id];
      if (old) next.perSymbol[id] = { ...defaultSymbolState(id), ...old, symbolId: id };
    }
    next.dailyCallBudgetUsed = prev.dailyCallBudgetUsed;
    next.dailyCallBudgetDay = prev.dailyCallBudgetDay;
    const n = orderedSymbolIds.length;
    next.bootstrapCursor = n === 0 ? 0 : Math.min(prev.bootstrapCursor, n - 1);
    const prevDaily =
      typeof prev.dailyCursor === 'number' && !Number.isNaN(prev.dailyCursor) ? prev.dailyCursor : 0;
    next.dailyCursor = n === 0 ? 0 : Math.min(prevDaily, n - 1);
    next.lastFxFetchAt = prev.lastFxFetchAt;
    next.fxLastSuccess = prev.fxLastSuccess ?? null;
    return ensureDailyBudgetWindow(next);
  }
  const perSymbol = { ...prev.perSymbol };
  for (const id of orderedSymbolIds) {
    if (!perSymbol[id]) perSymbol[id] = defaultSymbolState(id);
  }
  const n = orderedSymbolIds.length;
  const prevDaily =
    typeof prev.dailyCursor === 'number' && !Number.isNaN(prev.dailyCursor) ? prev.dailyCursor : 0;
  return ensureDailyBudgetWindow({
    ...prev,
    bootstrapOrderedSymbolIds: [...orderedSymbolIds],
    perSymbol,
    bootstrapCursor: n === 0 ? 0 : Math.min(prev.bootstrapCursor, n - 1),
    dailyCursor: n === 0 ? 0 : Math.min(prevDaily, n - 1),
  });
}

export function setHistoryStatus(s: IsmSymbolFetchState, st: HistoryBootstrapStatus): IsmSymbolFetchState {
  return { ...s, historyBootstrapStatus: st };
}

export function recordProviderUsed(
  s: IsmSymbolFetchState,
  provider: IsmMarketProviderId | null
): IsmSymbolFetchState {
  return { ...s, priceProviderLastUsed: provider };
}

/** Align persisted engine state to current ingest universe (order + fingerprint). */
export function alignIsmFetchEngineToIngest(
  persisted: IsmFetchEngineState | null,
  rows: ISMInstrumentIngest[]
): IsmFetchEngineState {
  const { orderedSymbolIds, fingerprint } = computeBootstrapSymbolOrder(rows);
  return mergeEngineStateWithUniverse(persisted, orderedSymbolIds, fingerprint);
}
