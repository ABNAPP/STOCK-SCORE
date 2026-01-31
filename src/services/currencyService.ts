/**
 * Currency Service with Multi-API Fallback
 *
 * Tries multiple APIs in priority order:
 * 1. EODHD
 * 2. MarketStack
 * 3. FINNHUB
 * 4. Alpha Vantage
 * 5. ExchangeRate-API (fallback, no key)
 * Rates are cached in Firestore (15 hours TTL) to minimize requests.
 */

import { getApiKeys } from '../config/apiKeys';
import { getCachedData, setCachedData } from './firestoreCacheService';
import { CACHE_KEYS } from './cacheKeys';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 15 * 60 * 60 * 1000; // 15 hours

interface CurrencyRatesData {
  rates: Record<string, number>;
  source: string;
}

/**
 * Get exchange rate from one currency to USD.
 * E.g. getExchangeRate('SEK', 'USD') returns how many USD per 1 SEK.
 *
 * @param fromCurrency - ISO 4217 code (e.g. 'SEK', 'EUR')
 * @param toCurrency - Target currency, default 'USD'
 * @returns Rate to multiply with amount in fromCurrency to get USD, or null if unavailable
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<number | null> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return 1;
  }

  try {
    const rates = await getRatesWithFallback();
    if (!rates) return null;

    // API returns rates FROM USD to other currencies (e.g. rates.SEK = SEK per 1 USD)
    // So USD per 1 SEK = 1 / rates.SEK
    if (to === 'USD' && from in rates) {
      const usdPerUnit = 1 / rates[from];
      return isFinite(usdPerUnit) ? usdPerUnit : null;
    }
    if (from === 'USD' && to in rates) {
      return isFinite(rates[to]) ? rates[to] : null;
    }
    if (from in rates) {
      const usdPerUnit = 1 / rates[from];
      return isFinite(usdPerUnit) ? usdPerUnit : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Force refresh the currency rates cache by fetching from APIs and writing to Firestore.
 * Call before getExchangeRate when fresh rates are needed (e.g. every 15 minutes in Personal Portfolio).
 */
export async function refreshCurrencyRatesCache(): Promise<void> {
  await getRatesWithFallback(true);
}

/**
 * Try APIs in priority order until one succeeds
 */
async function getRatesWithFallback(forceRefresh?: boolean): Promise<Record<string, number> | null> {
  if (!forceRefresh) {
    const cached = await getCachedRates();
    if (cached) return cached.rates;
  }

  const apiKeys = getApiKeys();

  if (apiKeys.eodhd) {
    const rates = await fetchEODHDRates(apiKeys.eodhd);
    if (rates) {
      const merged = await mergeMissingMajorCurrencies(rates);
      await setCachedRates(merged, 'eodhd');
      return merged;
    }
  }

  if (apiKeys.marketstack) {
    const rates = await fetchMarketStackRates(apiKeys.marketstack);
    if (rates) {
      const merged = await mergeMissingMajorCurrencies(rates);
      await setCachedRates(merged, 'marketstack');
      return merged;
    }
  }

  if (apiKeys.finnhub) {
    const rates = await fetchFinnhubRates(apiKeys.finnhub);
    if (rates) {
      const merged = await mergeMissingMajorCurrencies(rates);
      await setCachedRates(merged, 'finnhub');
      return merged;
    }
  }

  if (apiKeys.alphaVantage) {
    const rates = await fetchAlphaVantageRates(apiKeys.alphaVantage);
    if (rates) {
      const merged = await mergeMissingMajorCurrencies(rates);
      await setCachedRates(merged, 'alphavantage');
      return merged;
    }
  }

  const rates = await fetchExchangeRateAPIRates();
  if (rates) {
    await setCachedRates(rates, 'exchangerate-api');
    return rates;
  }

  return null;
}

/** Major currencies to fetch from USD for APIs that only support single-pair */
const MAJOR_CURRENCIES = ['EUR', 'SEK', 'GBP', 'CHF', 'NOK', 'DKK', 'AUD', 'CAD', 'JPY'];

/**
 * Merge missing major currencies from the free API into rates.
 * Ensures we always have SEK and other major currencies even if the primary API omits them.
 */
async function mergeMissingMajorCurrencies(
  rates: Record<string, number>
): Promise<Record<string, number>> {
  const missing = MAJOR_CURRENCIES.filter((ccy) => !(ccy in rates));
  if (missing.length === 0) return rates;
  const fallback = await fetchExchangeRateAPIRates();
  if (!fallback) return rates;
  const merged = { ...rates };
  for (const ccy of missing) {
    if (ccy in fallback && typeof fallback[ccy] === 'number') {
      merged[ccy] = fallback[ccy];
    }
  }
  return merged;
}

async function getCachedRates(): Promise<CurrencyRatesData | null> {
  return getCachedData<CurrencyRatesData>(CACHE_KEYS.CURRENCY_RATES_USD);
}

async function setCachedRates(rates: Record<string, number>, source: string): Promise<void> {
  try {
    const data: CurrencyRatesData = { rates, source };
    await setCachedData(CACHE_KEYS.CURRENCY_RATES_USD, data, CACHE_TTL_MS);
  } catch {
    // Cache write failed (e.g. permission); API response still used for current call
  }
}

async function fetchEODHDRates(apiKey: string): Promise<Record<string, number> | null> {
  try {
    // EODHD real-time: one symbol per request, e.g. USDEUR.FOREX
    const symbols = MAJOR_CURRENCIES.map((c) => `USD${c}.FOREX`);
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const url = `https://eodhistoricaldata.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { close?: number; code?: string };
        const close = data?.close;
        const code = data?.code?.replace('USD', '') || symbol.replace('USD', '').replace('.FOREX', '');
        if (typeof close === 'number' && code) return { code, rate: close };
        return null;
      })
    );
    const rates: Record<string, number> = { USD: 1 };
    for (const r of results) {
      if (r) rates[r.code] = r.rate;
    }
    if (Object.keys(rates).length <= 1) return null;
    return rates;
  } catch {
    return null;
  }
}

async function fetchMarketStackRates(_apiKey: string): Promise<Record<string, number> | null> {
  // MarketStack Currencies endpoint is metadata, not exchange rates. Use ExchangeRate-API.
  return null;
}

async function fetchFinnhubRates(apiKey: string): Promise<Record<string, number> | null> {
  try {
    // Finnhub forex rates: https://finnhub.io/api/v1/forex/rates?base=USD
    const res = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${apiKey}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { quote?: Record<string, number> };
    const quote = data?.quote;
    if (!quote || typeof quote !== 'object') return null;
    const rates: Record<string, number> = { USD: 1 };
    for (const [ccy, value] of Object.entries(quote)) {
      if (typeof value === 'number') rates[ccy] = value;
    }
    if (Object.keys(rates).length <= 1) return null;
    return rates;
  } catch {
    return null;
  }
}

async function fetchAlphaVantageRates(apiKey: string): Promise<Record<string, number> | null> {
  try {
    const rates: Record<string, number> = { USD: 1 };
    await Promise.all(
      MAJOR_CURRENCIES.map(async (toCcy) => {
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=${toCcy}&apikey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { 'Realtime Currency Exchange Rate'?: { '5. Exchange Rate'?: string } };
        const rateStr = data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
        if (rateStr) {
          const rate = parseFloat(rateStr);
          if (Number.isFinite(rate)) rates[toCcy] = rate;
        }
      })
    );
    if (Object.keys(rates).length <= 1) return null;
    return rates;
  } catch {
    return null;
  }
}

async function fetchExchangeRateAPIRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates) return null;
    return data.rates;
  } catch {
    return null;
  }
}
