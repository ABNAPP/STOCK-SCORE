import type { IsmMarketProviderAdapter } from '../marketData/adapterInterface';
import type { IsmMarketProviderId } from '../marketData/types';
import type { ProviderKeyPool } from '../marketData/keyPool';

/** Pools + adapters for one tick (caller builds from `buildDefaultProviderKeyPools` / `defaultIsmMarketAdapters`). */
export type IsmFetchMarketDeps = {
  pools: Map<IsmMarketProviderId, ProviderKeyPool>;
  adapters: Record<IsmMarketProviderId, IsmMarketProviderAdapter>;
  /** Overrides `ISM_DEFAULT_DAILY_CALL_BUDGET` when set. */
  dailyCallBudgetLimit?: number;
};
