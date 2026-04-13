import type { IsmMarketProviderAdapter } from '../adapterInterface';
import type { IsmDailyBar, IsmDataRequestMode, IsmMarketDataResult, SymbolTranslationContext } from '../types';
import { translateForProvider } from '../symbolTranslate';
import { failedResult, invalidResult, isValidDailyBars, metaBase, withSuccessMeta } from '../resultHelpers';

const MAJOR_FX = ['EUR', 'SEK', 'GBP', 'CHF', 'NOK', 'DKK', 'AUD', 'CAD', 'JPY'];

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: T | null }> {
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    const body = (await res.json()) as T;
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null };
  }
}

export const eodhdAdapter: IsmMarketProviderAdapter = {
  id: 'eodhd',

  async fetchHistoricalDaily(
    apiKey: string,
    ctx: SymbolTranslationContext,
    from: string,
    to: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<IsmDailyBar[]>> {
    const { symbol, notes } = translateForProvider('eodhd', ctx);
    const base = metaBase(mode, notes);
    const url = `https://eodhistoricaldata.com/api/eod/${encodeURIComponent(symbol)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&api_token=${encodeURIComponent(apiKey)}&fmt=json`;
    const parsed = await fetchJson<unknown[]>(url, signal);
    if (!parsed.ok || !Array.isArray(parsed.body)) {
      return failedResult(base, `http_${parsed.status}`, symbol);
    }
    const bars: IsmDailyBar[] = [];
    for (const row of parsed.body) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === 'string' ? r.date : '';
      const open = Number(r.open);
      const high = Number(r.high);
      const low = Number(r.low);
      const close = Number(r.close);
      const volume = r.volume !== undefined ? Number(r.volume) : undefined;
      if (!date || !Number.isFinite(close)) continue;
      bars.push({
        date,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close,
        volume: Number.isFinite(volume) ? volume : undefined,
      });
    }
    if (!isValidDailyBars(bars)) {
      return invalidResult(base, 'empty_or_bad_ohlc', symbol);
    }
    return withSuccessMeta(base, 'eodhd', 0, apiKey, symbol, bars);
  },

  async fetchLatestDailyClose(
    apiKey: string,
    ctx: SymbolTranslationContext,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<number>> {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hist = await this.fetchHistoricalDaily(apiKey, ctx, from, to, mode, signal);
    if (hist.outcome !== 'valid' || !hist.data?.length) {
      return {
        outcome: hist.outcome,
        data: null,
        reason: hist.reason,
        meta: hist.meta,
      };
    }
    const last = hist.data[hist.data.length - 1]!;
    const base = metaBase(mode, hist.meta.translationNotes);
    return withSuccessMeta(base, 'eodhd', 0, apiKey, hist.meta.providerSymbol ?? '', last.close);
  },

  async fetchUsdFxRates(
    apiKey: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<Record<string, number>>> {
    const base = metaBase(mode);
    const rates: Record<string, number> = { USD: 1 };
    for (const ccy of MAJOR_FX) {
      const symbol = `USD${ccy}.FOREX`;
      const url = `https://eodhistoricaldata.com/api/real-time/${symbol}?api_token=${encodeURIComponent(apiKey)}&fmt=json`;
      const parsed = await fetchJson<{ close?: number; code?: string }>(url, signal);
      if (!parsed.ok || !parsed.body || typeof parsed.body.close !== 'number') {
        continue;
      }
      rates[ccy] = parsed.body.close;
    }
    if (Object.keys(rates).length <= 1) {
      return invalidResult(base, 'fx_insufficient_pairs');
    }
    return withSuccessMeta(base, 'eodhd', 0, apiKey, 'USD.*.FOREX', rates);
  },
};
