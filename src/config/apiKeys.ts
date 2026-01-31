/**
 * API Keys Configuration
 *
 * Reads API keys from environment variables and optional Firestore cache.
 * Cache (set from Firestore or admin UI save) overrides env for non-empty values.
 */

export interface ApiKeys {
  eodhd?: string;
  marketstack?: string;
  finnhub?: string;
  alphaVantage?: string;
}

let cachedApiKeys: ApiKeys | null = null;

function getEnvKeys(): ApiKeys {
  return {
    eodhd: import.meta.env.VITE_EODHD_API_KEY,
    marketstack: import.meta.env.VITE_MARKETSTACK_API_KEY,
    finnhub: import.meta.env.VITE_FINNHUB_API_KEY,
    alphaVantage: import.meta.env.VITE_ALPHA_VANTAGE_API_KEY,
  };
}

/**
 * Merge cache with env: for each key, use cached value if non-empty, else env.
 */
function mergeKeys(cache: ApiKeys, env: ApiKeys): ApiKeys {
  return {
    eodhd: (cache.eodhd && cache.eodhd.trim()) ? cache.eodhd : env.eodhd,
    marketstack: (cache.marketstack && cache.marketstack.trim()) ? cache.marketstack : env.marketstack,
    finnhub: (cache.finnhub && cache.finnhub.trim()) ? cache.finnhub : env.finnhub,
    alphaVantage: (cache.alphaVantage && cache.alphaVantage.trim()) ? cache.alphaVantage : env.alphaVantage,
  };
}

/**
 * Set API keys cache (e.g. after admin save from UI).
 */
export function setApiKeysCache(keys: ApiKeys): void {
  cachedApiKeys = { ...keys };
}

/**
 * Set API keys cache from Firestore result (merge with env so empty Firestore fields use env).
 */
export function setApiKeysCacheFromFirestore(keys: ApiKeys): void {
  cachedApiKeys = mergeKeys(keys, getEnvKeys());
}

/**
 * Get API keys: merged cache + env (cache overrides for non-empty values).
 */
export function getApiKeys(): ApiKeys {
  const env = getEnvKeys();
  if (!cachedApiKeys) return env;
  return mergeKeys(cachedApiKeys, env);
}

/**
 * Get API keys for display in admin UI (same as getApiKeys).
 */
export function getApiKeysForDisplay(): ApiKeys {
  return getApiKeys();
}
