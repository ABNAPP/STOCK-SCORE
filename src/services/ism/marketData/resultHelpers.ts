import type {
  IsmDailyBar,
  IsmDataRequestMode,
  IsmMarketDataMeta,
  IsmMarketDataResult,
} from './types';
import type { IsmMarketProviderId } from './types';
import { fingerprintKey } from './keyPool';

export function metaBase(
  requestMode: IsmDataRequestMode,
  translationNotes?: string[]
): IsmMarketDataMeta {
  return { requestMode, translationNotes: translationNotes ?? [] };
}

export function withSuccessMeta<T>(
  base: IsmMarketDataMeta,
  providerId: IsmMarketProviderId,
  keyIndex: number,
  apiKey: string,
  providerSymbol: string,
  data: T
): IsmMarketDataResult<T> {
  return {
    outcome: 'valid',
    data,
    meta: {
      ...base,
      providerSymbol,
      lastSuccess: {
        providerId,
        keyIndex,
        keyFingerprint: fingerprintKey(apiKey),
      },
    },
  };
}

export function invalidResult<T>(
  base: IsmMarketDataMeta,
  reason: string,
  providerSymbol?: string
): IsmMarketDataResult<T> {
  return {
    outcome: 'invalid',
    data: null,
    reason,
    meta: { ...base, providerSymbol },
  };
}

export function failedResult<T>(
  base: IsmMarketDataMeta,
  reason: string,
  providerSymbol?: string
): IsmMarketDataResult<T> {
  return {
    outcome: 'failed',
    data: null,
    reason,
    meta: { ...base, providerSymbol },
  };
}

export function isValidDailyBars(bars: IsmDailyBar[]): boolean {
  if (!Array.isArray(bars) || bars.length === 0) return false;
  return bars.every(
    (b) =>
      typeof b.date === 'string' &&
      Number.isFinite(b.close) &&
      b.close > 0 &&
      Number.isFinite(b.open) &&
      Number.isFinite(b.high) &&
      Number.isFinite(b.low)
  );
}
