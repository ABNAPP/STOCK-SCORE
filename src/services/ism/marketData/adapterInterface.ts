import type {
  IsmDailyBar,
  IsmMarketDataResult,
  IsmMarketProviderId,
  IsmDataRequestMode,
  SymbolTranslationContext,
} from './types';

export interface IsmMarketProviderAdapter {
  readonly id: IsmMarketProviderId;

  fetchHistoricalDaily(
    apiKey: string,
    ctx: SymbolTranslationContext,
    from: string,
    to: string,
    mode: IsmDataRequestMode,
    signal?: AbortSignal
  ): Promise<IsmMarketDataResult<IsmDailyBar[]>>;

  fetchLatestDailyClose(
    apiKey: string,
    ctx: SymbolTranslationContext,
    mode: IsmDataRequestMode,
    signal?: AbortSignal
  ): Promise<IsmMarketDataResult<number>>;

  /** USD-based rates map (same convention as app currency cache: non-USD keys). */
  fetchUsdFxRates(
    apiKey: string,
    mode: IsmDataRequestMode,
    signal?: AbortSignal
  ): Promise<IsmMarketDataResult<Record<string, number>>>;
}
