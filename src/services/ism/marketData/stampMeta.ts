import type { IsmMarketDataResult, IsmMarketProviderId } from './types';
import { fingerprintKey } from './keyPool';

/** Attach successful key metadata after a valid provider response. */
export function stampKeyOnSuccess<T>(
  result: IsmMarketDataResult<T>,
  providerId: IsmMarketProviderId,
  keyIndex: number,
  apiKey: string
): IsmMarketDataResult<T> {
  if (result.outcome !== 'valid') return result;
  return {
    ...result,
    meta: {
      ...result.meta,
      lastSuccess: {
        providerId,
        keyIndex,
        keyFingerprint: fingerprintKey(apiKey),
      },
    },
  };
}
