/**
 * Sheets Service - Barrel Export
 * 
 * Central export point for all sheets-related services.
 * Provides backward compatibility with existing imports.
 */

// Types
export type { DataRow, ProgressCallback } from './types';

// Data transformers (helper functions)
export {
  getValue,
  getValueAllowZero,
  isValidValue,
  parseNumericValueNullable,
  parsePercentageValueNullable,
  calculateMedian,
  findIRRForIndustry,
  findLeverageF2ForIndustry,
  findRO40ForIndustry,
  findCashSdebtForIndustry,
  findCurrentRatioForIndustry,
} from './dataTransformers';

// Fetch functions
export {
  convert2DArrayToObjects,
  createMockParseResult,
  fetchJSONData,
  fetchCSVData,
  fetchWithFallback,
  type FetchWithFallbackConfig,
} from './fetchService';

// Data fetching functions
export { fetchBenjaminGrahamData } from './benjaminGrahamService';
export { fetchSMAData } from './smaService';
export { fetchPEIndustryData } from './peIndustryService';
export { fetchScoreBoardData } from './scoreBoardService';
export { fetchThresholdIndustryData } from './thresholdIndustryService';
