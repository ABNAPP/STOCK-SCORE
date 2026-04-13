import type { IsmMarketProviderId } from './types';

/** Move `preferred` to the front if it exists in `base`; order otherwise unchanged. */
export function withPreferredFirst(
  base: readonly IsmMarketProviderId[],
  preferred: IsmMarketProviderId | null | undefined
): IsmMarketProviderId[] {
  if (!preferred || !base.includes(preferred)) return [...base];
  return [preferred, ...base.filter((p) => p !== preferred)];
}
