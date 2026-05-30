/**
 * ISM fetch engine: bootstrap vs daily, per-symbol state, budgets, resume.
 */

import type { IsmMarketProviderId, IsmProviderAttemptMeta } from '../marketData/types';

export type HistoryBootstrapStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';

export interface IsmSymbolFetchState {
  symbolId: string;
  historyBootstrapStatus: HistoryBootstrapStatus;
  /** Cumulative calendar days successfully covered toward rolling window. */
  historyDaysFetched: number;
  lastHistoryFetchAttemptAt: number | null;
  lastHistoryFetchSuccessAt: number | null;
  lastDailyPriceFetchAt: number | null;
  /** Last provider that returned an outcome for this symbol (attempt). */
  priceProviderLastUsed: IsmMarketProviderId | null;
  /** Last successful provider/key fingerprint from provider layer. */
  priceProviderLastSuccess: IsmProviderAttemptMeta | null;
  fetchFailureCount: number;
  /**
   * Inclusive upper bound (ISO date) for the next backward history chunk.
   * Initialized to "today" on first attempt; moves backward after each success.
   */
  historyBootstrapNextChunkEnd: string | null;
}

export interface IsmFetchEngineState {
  schemaVersion: 1;
  /** Fingerprint of symbol universe (length + first/last id) to detect major ingest changes. */
  universeFingerprint: string;
  lastSavedAt: number;
  /** Calls counted against daily budget (bootstrap history chunks + daily closes + FX). */
  dailyCallBudgetUsed: number;
  /** Local calendar day (YYYY-MM-DD) for which dailyCallBudgetUsed applies. */
  dailyCallBudgetDay: string;
  /** Stable bootstrap processing order. */
  bootstrapOrderedSymbolIds: string[];
  /** Cursor into bootstrapOrderedSymbolIds (resume point). */
  bootstrapCursor: number;
  /** Cursor for daily latest-close passes (separate from bootstrap). */
  dailyCursor: number;
  perSymbol: Record<string, IsmSymbolFetchState>;
  lastFxFetchAt: number | null;
  /** Last successful FX provider/key (daily path resumes here). */
  fxLastSuccess: IsmProviderAttemptMeta | null;
}

export type IsmFetchStoppedReason =
  | 'budget_exhausted'
  | 'bootstrap_idle'
  | 'bootstrap_all_complete'
  | 'daily_idle';

export interface IsmBootstrapTickResult {
  state: IsmFetchEngineState;
  /** Provider HTTP history fetches (EODHD API) consumed in this tick. */
  callsConsumed: number;
  /** Chunks satisfied from value-insight-be `/eod-adjusted-daily` without provider API (debug / org policy). */
  firestoreCacheChunksServed: number;
  stoppedReason: IsmFetchStoppedReason;
  /** True when every symbol has history bootstrap complete or blocked. */
  bootstrapAllComplete: boolean;
}

export interface IsmDailyTickResult {
  state: IsmFetchEngineState;
  callsConsumed: number;
  stoppedReason: IsmFetchStoppedReason;
}
