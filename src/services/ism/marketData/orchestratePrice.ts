/**
 * Sequential price/history provider chain (one provider, one key at a time).
 * Priority: EODHD → Alpha Vantage → Marketstack → Finnhub.
 */

import type { IsmMarketProviderAdapter } from './adapterInterface';
import type {
  IsmDailyBar,
  IsmDataRequestMode,
  IsmMarketDataResult,
  IsmMarketProviderId,
  IsmProviderAttemptMeta,
  SymbolTranslationContext,
} from './types';
import { failedResult, metaBase } from './resultHelpers';
import type { ProviderKeyPool } from './keyPool';
import { stampKeyOnSuccess } from './stampMeta';
import { withPreferredFirst } from './providerPriority';

const PRICE_PRIORITY: IsmMarketProviderId[] = ['eodhd', 'alpha_vantage', 'marketstack', 'finnhub'];

export type IsmPriceOrchestrateOptions = {
  /** Try this provider first; if it matches `resume`, start at `resume.keyIndex`. */
  resume?: IsmProviderAttemptMeta | null;
};

export async function fetchIsmHistoricalDailyWithFallback(
  ctx: SymbolTranslationContext,
  from: string,
  to: string,
  mode: IsmDataRequestMode,
  pools: Map<IsmMarketProviderId, ProviderKeyPool>,
  adapters: Record<IsmMarketProviderId, IsmMarketProviderAdapter>,
  signal?: AbortSignal,
  options?: IsmPriceOrchestrateOptions
): Promise<IsmMarketDataResult<IsmDailyBar[]>> {
  const base = metaBase(mode);
  let last: IsmMarketDataResult<IsmDailyBar[]> | null = null;
  const order = withPreferredFirst(PRICE_PRIORITY, options?.resume?.providerId);

  for (const providerId of order) {
    const adapter = adapters[providerId];
    const pool = pools.get(providerId);
    if (!adapter || !pool?.hasKeys()) continue;

    if (options?.resume && providerId === options.resume.providerId) {
      pool.resetToKeyIndex(options.resume.keyIndex);
    } else {
      pool.reset();
    }
    while (true) {
      const key = pool.currentKey();
      if (!key) break;

      const raw = await adapter.fetchHistoricalDaily(key, ctx, from, to, mode, signal);
      const stamped = stampKeyOnSuccess(raw, providerId, pool.currentKeyIndex(), key);
      last = stamped;

      if (stamped.outcome === 'valid') {
        return stamped;
      }
      if (stamped.outcome === 'invalid') {
        break;
      }
      pool.advanceAfterFailure();
    }
  }

  return last ?? failedResult(base, 'all_providers_exhausted');
}

export async function fetchIsmLatestDailyCloseWithFallback(
  ctx: SymbolTranslationContext,
  mode: IsmDataRequestMode,
  pools: Map<IsmMarketProviderId, ProviderKeyPool>,
  adapters: Record<IsmMarketProviderId, IsmMarketProviderAdapter>,
  signal?: AbortSignal,
  options?: IsmPriceOrchestrateOptions
): Promise<IsmMarketDataResult<number>> {
  const base = metaBase(mode);
  let last: IsmMarketDataResult<number> | null = null;
  const order = withPreferredFirst(PRICE_PRIORITY, options?.resume?.providerId);

  for (const providerId of order) {
    const adapter = adapters[providerId];
    const pool = pools.get(providerId);
    if (!adapter || !pool?.hasKeys()) continue;

    if (options?.resume && providerId === options.resume.providerId) {
      pool.resetToKeyIndex(options.resume.keyIndex);
    } else {
      pool.reset();
    }
    while (true) {
      const key = pool.currentKey();
      if (!key) break;

      const raw = await adapter.fetchLatestDailyClose(key, ctx, mode, signal);
      const stamped = stampKeyOnSuccess(raw, providerId, pool.currentKeyIndex(), key);
      last = stamped;

      if (stamped.outcome === 'valid') {
        return stamped;
      }
      if (stamped.outcome === 'invalid') {
        break;
      }
      pool.advanceAfterFailure();
    }
  }

  return last ?? failedResult(base, 'all_providers_exhausted');
}
