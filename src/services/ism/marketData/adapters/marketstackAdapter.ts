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

export const marketstackAdapter: IsmMarketProviderAdapter = {
  id: 'marketstack',

  async fetchHistoricalDaily(
    apiKey: string,
    ctx: SymbolTranslationContext,
    from: string,
    to: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<IsmDailyBar[]>> {
    const { symbol, notes } = translateForProvider('marketstack', ctx);
    const base = metaBase(mode, notes);
    const url =
      `https://api.marketstack.com/v1/eod` +
      `?access_key=${encodeURIComponent(apiKey)}` +
      `&symbols=${encodeURIComponent(symbol)}` +
      `&date_from=${encodeURIComponent(from)}` +
      `&date_to=${encodeURIComponent(to)}` +
      `&limit=1000`;
    const parsed = await fetchJson<{ data?: Array<Record<string, unknown>>; error?: { code?: string; message?: string } }>(
      url,
      signal
    );
    if (!parsed.ok || !parsed.body) {
      return failedResult(base, `http_${parsed.status}`, symbol);
    }
    if (parsed.body.error) {
      return invalidResult(base, parsed.body.error.message ?? 'provider_error', symbol);
    }
    const rows = parsed.body.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return invalidResult(base, 'no_rows', symbol);
    }
    const bars: IsmDailyBar[] = [];
    for (const row of rows) {
      const date = typeof row.date === 'string' ? row.date.slice(0, 10) : '';
      const close = Number(row.close);
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const volume = row.volume !== undefined ? Number(row.volume) : undefined;
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
    bars.sort((a, b) => a.date.localeCompare(b.date));
    if (!isValidDailyBars(bars)) {
      return invalidResult(base, 'empty_or_bad_ohlc', symbol);
    }
    return withSuccessMeta(base, 'marketstack', 0, apiKey, symbol, bars);
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
    return withSuccessMeta(base, 'marketstack', 0, apiKey, hist.meta.providerSymbol ?? '', last.close);
  },

  async fetchUsdFxRates(
    _apiKey: string,
    mode: IsmDataRequestMode,
    _signal
  ): Promise<IsmMarketDataResult<Record<string, number>>> {
    const base = metaBase(mode);
    return failedResult(base, 'fx_not_supported_on_marketstack');
  },
};
