/**
 * Cache Keys
 * 
 * Centralized cache key definitions for all data types.
 * Used by Firestore cache.
 */

// Cache keys for different data types
export const CACHE_KEYS = {
  BENJAMIN_GRAHAM: 'cache:benjaminGraham',
  SMA: 'cache:sma',
  DASHBOARD_SNAPSHOT: 'cache:dashboardSnapshot',
  SMA_SNAPSHOT: 'cache:smaSnapshot',
  PE_INDUSTRY: 'cache:peIndustry',
  SCORE_BOARD: 'cache:scoreBoard',
  THRESHOLD_INDUSTRY: 'cache:industryThreshold',
  CURRENCY_RATES_USD: 'cache:currency_rates_usd',
  PMI_HEATMAP_COMPOSITE: 'cache:pmiHeatmapComposite',
  PMI_HEATMAP_MANUFACTURING: 'cache:pmiHeatmapManufacturing',
  PMI_HEATMAP_SERVICES: 'cache:pmiHeatmapServices',
} as const;

export function getPmiHeatmapCacheKey(type: 'composite' | 'manufacturing' | 'services'): string {
  if (type === 'composite') {
    return CACHE_KEYS.PMI_HEATMAP_COMPOSITE;
  }
  if (type === 'manufacturing') {
    return CACHE_KEYS.PMI_HEATMAP_MANUFACTURING;
  }
  return CACHE_KEYS.PMI_HEATMAP_SERVICES;
}

export function getPmiCountryDetailCacheKey(
  type: 'composite' | 'manufacturing' | 'services',
  countryCode: string
): string {
  return `cache:pmiCountry${type[0].toUpperCase() + type.slice(1)}${countryCode.toUpperCase()}`;
}
