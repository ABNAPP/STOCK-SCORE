/**
 * Key pool: one logical provider, multiple API keys (comma-separated env or array).
 * On failure, advance to next key; exhausted pool → caller tries next provider.
 */

import type { IsmMarketProviderId } from './types';

export function parseKeyPool(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function fingerprintKey(apiKey: string): string {
  if (apiKey.length <= 4) return '****';
  return `…${apiKey.slice(-4)}`;
}

/** Mutable cursor over a fixed key list. */
export class ProviderKeyPool {
  readonly providerId: IsmMarketProviderId;
  private readonly keys: readonly string[];
  private index = 0;

  constructor(providerId: IsmMarketProviderId, keys: readonly string[]) {
    this.providerId = providerId;
    this.keys = keys;
  }

  reset(): void {
    this.index = 0;
  }

  /** Start at a saved key index (e.g. last successful key for daily refresh). */
  resetToKeyIndex(i: number): void {
    if (this.keys.length === 0) {
      this.index = 0;
      return;
    }
    this.index = Math.max(0, Math.min(i, this.keys.length - 1));
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  /** Current key or null if pool exhausted. */
  currentKey(): string | null {
    if (this.index >= this.keys.length) return null;
    return this.keys[this.index] ?? null;
  }

  /** Advance after a failed attempt on current key. */
  advanceAfterFailure(): void {
    this.index += 1;
  }

  currentKeyIndex(): number {
    return Math.min(this.index, Math.max(0, this.keys.length - 1));
  }
}
