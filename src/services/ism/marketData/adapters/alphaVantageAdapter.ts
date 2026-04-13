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

export const alphaVantageAdapter: IsmMarketProviderAdapter = {
  id: 'alpha_vantage',

  async fetchHistoricalDaily(
    apiKey: string,
    ctx: SymbolTranslationContext,
    _from: string,
    _to: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<IsmDailyBar[]>> {
    const { symbol, notes } = translateForProvider('alpha_vantage', ctx);
    const base = metaBase(mode, notes);
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${encodeURIComponent(apiKey)}`;
    const parsed = await fetchJson<{
      'Time Series (Daily)'?: Record<string, Record<string, string>>;
      Note?: string;
      Information?: string;
    }>(url, signal);
    if (!parsed.ok || !parsed.body) {
      return failedResult(base, `http_${parsed.status}`, symbol);
    }
    if (parsed.body.Note || parsed.body.Information) {
      return invalidResult(base, 'rate_limit_or_info_message', symbol);
    }
    const series = parsed.body['Time Series (Daily)'];
    if (!series || typeof series !== 'object') {
      return invalidResult(base, 'missing_time_series', symbol);
    }
    const bars: IsmDailyBar[] = [];
    for (const [date, ohlc] of Object.entries(series)) {
      const close = parseFloat(ohlc['4. close'] ?? '');
      const open = parseFloat(ohlc['1. open'] ?? '');
      const high = parseFloat(ohlc['2. high'] ?? '');
      const low = parseFloat(ohlc['3. low'] ?? '');
      const vol = parseFloat(ohlc['5. volume'] ?? '');
      if (!Number.isFinite(close)) continue;
      bars.push({
        date,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close,
        volume: Number.isFinite(vol) ? vol : undefined,
      });
    }
    bars.sort((a, b) => a.date.localeCompare(b.date));
    const filtered = bars.filter((b) => b.date >= _from && b.date <= _to);
    const useBars = filtered.length > 0 ? filtered : bars;
    if (!isValidDailyBars(useBars)) {
      return invalidResult(base, 'empty_or_bad_ohlc', symbol);
    }
    return withSuccessMeta(base, 'alpha_vantage', 0, apiKey, symbol, useBars);
  },

  async fetchLatestDailyClose(
    apiKey: string,
    ctx: SymbolTranslationContext,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<number>> {
    const hist = await this.fetchHistoricalDaily(apiKey, ctx, '', '', mode, signal);
    if (hist.outcome !== 'valid' || !hist.data?.length) {
      return { outcome: hist.outcome, data: null, reason: hist.reason, meta: hist.meta };
    }
    const last = hist.data[hist.data.length - 1]!;
    const base = metaBase(mode, hist.meta.translationNotes);
    return withSuccessMeta(base, 'alpha_vantage', 0, apiKey, hist.meta.providerSymbol ?? '', last.close);
  },

  async fetchUsdFxRates(
    apiKey: string,
    mode: IsmDataRequestMode,
    signal
  ): Promise<IsmMarketDataResult<Record<string, number>>> {
    const base = metaBase(mode);
    const majors = ['EUR', 'SEK', 'GBP'];
    const rates: Record<string, number> = { USD: 1 };
    for (const ccy of majors) {
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=${ccy}&apikey=${encodeURIComponent(apiKey)}`;
      const parsed = await fetchJson<{
        'Realtime Currency Exchange Rate'?: { '5. Exchange Rate'?: string };
        Note?: string;
      }>(url, signal);
      if (!parsed.ok || !parsed.body || parsed.body.Note) break;
      const rateStr = parsed.body['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
      const rate = rateStr ? parseFloat(rateStr) : NaN;
      if (Number.isFinite(rate)) rates[ccy] = rate;
    }
    if (Object.keys(rates).length <= 1) {
      return invalidResult(base, 'fx_insufficient_pairs');
    }
    return withSuccessMeta(base, 'alpha_vantage', 0, apiKey, 'USD_FX', rates);
  },
};
