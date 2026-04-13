import { getApiKeys } from '../../../config/apiKeys';
import type { IsmMarketProviderId } from './types';
import { parseKeyPool, ProviderKeyPool } from './keyPool';
import type { IsmMarketProviderAdapter } from './adapterInterface';
import { eodhdAdapter } from './adapters/eodhdAdapter';
import { alphaVantageAdapter } from './adapters/alphaVantageAdapter';
import { marketstackAdapter } from './adapters/marketstackAdapter';
import { finnhubAdapter } from './adapters/finnhubAdapter';

/** Default adapter instances (ISM-local). */
export const defaultIsmMarketAdapters: Record<IsmMarketProviderId, IsmMarketProviderAdapter> = {
  eodhd: eodhdAdapter,
  alpha_vantage: alphaVantageAdapter,
  marketstack: marketstackAdapter,
  finnhub: finnhubAdapter,
};

/**
 * Key pools from existing app key config (`getApiKeys`).
 * Comma-separated values in one env var become multiple keys for the same provider.
 */
export function buildDefaultProviderKeyPools(): Map<IsmMarketProviderId, ProviderKeyPool> {
  const k = getApiKeys();
  const m = new Map<IsmMarketProviderId, ProviderKeyPool>();
  m.set('eodhd', new ProviderKeyPool('eodhd', parseKeyPool(k.eodhd)));
  m.set('alpha_vantage', new ProviderKeyPool('alpha_vantage', parseKeyPool(k.alphaVantage)));
  m.set('marketstack', new ProviderKeyPool('marketstack', parseKeyPool(k.marketstack)));
  m.set('finnhub', new ProviderKeyPool('finnhub', parseKeyPool(k.finnhub)));
  return m;
}
