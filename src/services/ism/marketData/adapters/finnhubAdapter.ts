import type { IsmMarketProviderAdapter } from '../adapterInterface';
import type { IsmDailyBar, IsmDataRequestMode, IsmMarketDataResult, SymbolTranslationContext } from '../types';
import { translateForProvider } from '../symbolTranslate';
import { failedResult, invalidResult, isValidDailyBars, metaBase, withSuccessMeta } from '../resultHelpers';

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: T | null }> {
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    const body = (await res.json()) as T;
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

export const finnhubAdapter: IsmMarketProviderAdapter = {
  id: 'finnhub',

  async fetchHistoricalDaily(
    apiKey: string,
    ctx: SymbolTranslationContext,
    from: string,
    to: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<IsmDailyBar[]>> {
    const { symbol, notes } = translateForProvider('finnhub', ctx);
    const base = metaBase(mode, notes);
    const fromSec = Math.floor(new Date(from).getTime() / 1000);
    const toSec = Math.floor(new Date(to).getTime() / 1000);
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromSec}&to=${toSec}&token=${encodeURIComponent(apiKey)}`;
    const parsed = await fetchJson<{ s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] }>(
      url,
      signal
    );
    if (!parsed.ok || !parsed.body) {
      return failedResult(base, `http_${parsed.status}`, symbol);
    }
    if (parsed.body.s === 'no_data') {
      return invalidResult(base, 'no_data', symbol);
    }
    const { t, o, h, l, c, v } = parsed.body;
    if (!Array.isArray(t) || !Array.isArray(c) || t.length === 0 || c.length === 0) {
      return invalidResult(base, 'malformed_candles', symbol);
    }
    const bars: IsmDailyBar[] = [];
    for (let i = 0; i < t.length; i += 1) {
      const ts = t[i]!;
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      const close = c[i]!;
      const open = o?.[i] ?? close;
      const high = h?.[i] ?? close;
      const low = l?.[i] ?? close;
      const volume = v?.[i];
      bars.push({
        date,
        open,
        high,
        low,
        close,
        volume: typeof volume === 'number' ? volume : undefined,
      });
    }
    bars.sort((a, b) => a.date.localeCompare(b.date));
    if (!isValidDailyBars(bars)) {
      return invalidResult(base, 'empty_or_bad_ohlc', symbol);
    }
    return withSuccessMeta(base, 'finnhub', 0, apiKey, symbol, bars);
  },

  async fetchLatestDailyClose(
    apiKey: string,
    ctx: SymbolTranslationContext,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<number>> {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hist = await this.fetchHistoricalDaily(apiKey, ctx, from, to, mode, signal);
    if (hist.outcome !== 'valid' || !hist.data?.length) {
      return { outcome: hist.outcome, data: null, reason: hist.reason, meta: hist.meta };
    }
    const last = hist.data[hist.data.length - 1]!;
    const base = metaBase(mode, hist.meta.translationNotes);
    return withSuccessMeta(base, 'finnhub', 0, apiKey, hist.meta.providerSymbol ?? '', last.close);
  },

  async fetchUsdFxRates(
    apiKey: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<Record<string, number>>> {
    const base = metaBase(mode);
    const url = `https://finnhub.io/api/v1/forex/rates?base=USD&token=${encodeURIComponent(apiKey)}`;
    const parsed = await fetchJson<{ quote?: Record<string, number> }>(url, signal);
    if (!parsed.ok || !parsed.body?.quote) {
      return failedResult(base, `http_${parsed.status}`);
    }
    const rates: Record<string, number> = { USD: 1 };
    for (const [ccy, value] of Object.entries(parsed.body.quote)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        rates[ccy] = value;
      }
    }
    if (Object.keys(rates).length <= 1) {
      return invalidResult(base, 'fx_empty');
    }
    return withSuccessMeta(base, 'finnhub', 0, apiKey, 'USD', rates);
  },
};
