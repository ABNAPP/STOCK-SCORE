/**
 * ISM market data & FX provider layer (client-side keys via existing `getApiKeys()` — same as currencyService).
 */

export type {
  IsmDailyBar,
  IsmDataRequestMode,
  IsmMarketDataMeta,
  IsmMarketDataOutcome,
  IsmMarketDataResult,
  IsmMarketProviderId,
  IsmProviderAttemptMeta,
  SymbolTranslationContext,
} from './types';

export { parseKeyPool, fingerprintKey, ProviderKeyPool } from './keyPool';
export { withPreferredFirst } from './providerPriority';
export { translateForProvider } from './symbolTranslate';
export { buildSymbolTranslationContext } from './translationContext';
export { defaultIsmMarketAdapters, buildDefaultProviderKeyPools } from './defaultRegistry';
export type { IsmPriceOrchestrateOptions } from './orchestratePrice';
export {
  fetchIsmHistoricalDailyWithFallback,
  fetchIsmLatestDailyCloseWithFallback,
} from './orchestratePrice';
export type { IsmFxOrchestrateOptions } from './orchestrateFx';
export { fetchIsmUsdFxRatesWithFallback } from './orchestrateFx';
export type { IsmMarketProviderAdapter } from './adapterInterface';
