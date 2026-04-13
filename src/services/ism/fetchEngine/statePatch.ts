import { ensureDailyBudgetWindow } from './stateHelpers';
import type { IsmFetchEngineState } from './types';

/** Normalize persisted / remote JSON into a safe in-memory engine state. */
export function patchLoadedIsmFetchEngineState(data: IsmFetchEngineState): IsmFetchEngineState {
  const ordered = Array.isArray(data.bootstrapOrderedSymbolIds) ? [...data.bootstrapOrderedSymbolIds] : [];
  const n = ordered.length;
  const clamp = (v: unknown) =>
    typeof v === 'number' && !Number.isNaN(v) ? Math.min(Math.max(v, 0), Math.max(0, n - 1)) : 0;
  return ensureDailyBudgetWindow({
    ...data,
    schemaVersion: 1,
    bootstrapOrderedSymbolIds: ordered,
    bootstrapCursor: clamp(data.bootstrapCursor),
    dailyCursor: clamp(data.dailyCursor),
    perSymbol: typeof data.perSymbol === 'object' && data.perSymbol ? data.perSymbol : {},
    fxLastSuccess: data.fxLastSuccess ?? null,
  });
}
