import { describe, it, expect } from 'vitest';
import { patchLoadedIsmFetchEngineState } from '../statePatch';
import type { IsmFetchEngineState } from '../types';

describe('patchLoadedIsmFetchEngineState', () => {
  it('clamps cursors and fills defaults', () => {
    const raw = {
      schemaVersion: 1,
      universeFingerprint: 'fp',
      lastSavedAt: 0,
      dailyCallBudgetUsed: 0,
      dailyCallBudgetDay: '2099-01-01',
      bootstrapOrderedSymbolIds: ['a', 'b'],
      bootstrapCursor: 99,
      dailyCursor: -3,
      perSymbol: {},
      lastFxFetchAt: null,
      fxLastSuccess: null,
    } as unknown as IsmFetchEngineState;
    const out = patchLoadedIsmFetchEngineState(raw);
    expect(out.bootstrapCursor).toBe(1);
    expect(out.dailyCursor).toBe(0);
    expect(out.perSymbol).toEqual({});
  });
});
