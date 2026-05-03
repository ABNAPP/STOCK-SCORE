/**
 * Sequential FX provider chain (USD-denominated rate maps).
 * Order: {@link ISM_FX_PROVIDER_CHAIN} (EODHD first; Marketstack omitted by ISM v1 spec).
 */

import type { IsmMarketProviderAdapter } from './adapterInterface';
import type {
  IsmDataRequestMode,
  IsmMarketDataResult,
  IsmMarketProviderId,
  IsmProviderAttemptMeta,
} from './types';
import { failedResult, metaBase } from './resultHelpers';
import type { ProviderKeyPool } from './keyPool';
import { stampKeyOnSuccess } from './stampMeta';
import { withPreferredFirst } from './providerPriority';

import { ISM_FX_PROVIDER_CHAIN } from './providerChainConfig';

export type IsmFxOrchestrateOptions = {
  resume?: IsmProviderAttemptMeta | null;
};

export async function fetchIsmUsdFxRatesWithFallback(
  mode: IsmDataRequestMode,
  pools: Map<IsmMarketProviderId, ProviderKeyPool>,
  adapters: Record<IsmMarketProviderId, IsmMarketProviderAdapter>,
  signal?: AbortSignal,
  options?: IsmFxOrchestrateOptions
): Promise<IsmMarketDataResult<Record<string, number>>> {
  const base = metaBase(mode);
  let last: IsmMarketDataResult<Record<string, number>> | null = null;
  const order = withPreferredFirst(ISM_FX_PROVIDER_CHAIN, options?.resume?.providerId);

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

      const raw = await adapter.fetchUsdFxRates(key, mode, signal);
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

  return last ?? failedResult(base, 'all_fx_providers_exhausted');
}
