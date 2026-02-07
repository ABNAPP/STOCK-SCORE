/**
 * Fetch Service - Barrel
 *
 * Re-exports fetch functions and helpers. Use this module for all fetch imports.
 */

import { DEFAULT_TTL } from '../firestoreCacheService';
import { logger } from '../../utils/logger';
import type { DataRow, ProgressCallback } from './types';
import { fetchJSONData } from './fetchJson';
import { fetchCSVData } from './fetchCsv';
import { convert2DArrayToObjects, createMockParseResult } from './fetchDataConversion';
import { validateCSVText } from './fetchValidation';

export { convert2DArrayToObjects, createMockParseResult };
export { validateCSVText };
export { fetchJSONData } from './fetchJson';
export { fetchCSVData } from './fetchCsv';

export interface FetchWithFallbackConfig<T> {
  sheetName: string;
  dataTypeName: string;
  transformer: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[];
  requiredColumns?: string[];
  cacheKey?: string;
  forceRefresh?: boolean;
  ttl?: number;
  progressCallback?: ProgressCallback;
  csvUrl: string;
  additionalData?: Record<string, unknown>;
}

export async function fetchWithFallback<T>(
  config: FetchWithFallbackConfig<T>
): Promise<T[]> {
  const {
    sheetName,
    dataTypeName,
    transformer,
    requiredColumns,
    cacheKey,
    forceRefresh = false,
    ttl = DEFAULT_TTL,
    progressCallback,
    csvUrl,
    additionalData,
  } = config;

  try {
    return await fetchJSONData<T>(
      sheetName,
      dataTypeName,
      transformer,
      requiredColumns,
      cacheKey,
      forceRefresh,
      ttl,
      progressCallback,
      additionalData
    );
  } catch (error: unknown) {
    logger.warn(
      `Apps Script API failed for ${dataTypeName}, falling back to CSV proxy (slower method)`,
      { component: 'fetchService', dataTypeName, operation: 'fetchWithFallback', error }
    );

    return fetchCSVData<T>(
      csvUrl,
      dataTypeName,
      transformer,
      requiredColumns,
      cacheKey,
      forceRefresh,
      ttl,
      progressCallback,
      additionalData
    );
  }
}
