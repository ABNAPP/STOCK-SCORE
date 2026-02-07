/**
 * Fetch CSV data from Google Sheets via CORS proxies.
 */

import Papa from 'papaparse';
import { getCachedData, setCachedData, DEFAULT_TTL } from '../firestoreCacheService';
import { createErrorHandler, isNetworkError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { checkRateLimit } from '../../utils/rateLimiter';
import { transformInWorker, getTransformerId } from '../workerService';
import type { DataRow, ProgressCallback } from './types';
import {
  CORS_PROXIES,
  FETCH_TIMEOUT,
  FETCH_TIMEOUT_SECONDS,
} from './fetchConfig';
import { validateCSVText } from './fetchValidation';

export async function fetchCSVData<T>(
  csvUrl: string,
  dataTypeName: string,
  transformer: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[],
  requiredColumns?: string[],
  cacheKey?: string,
  forceRefresh: boolean = false,
  ttl: number = DEFAULT_TTL,
  progressCallback?: ProgressCallback,
  additionalData?: Record<string, unknown>
): Promise<T[]> {
  if (cacheKey && !forceRefresh) {
    const cachedData = await getCachedData<T[]>(cacheKey);
    if (cachedData !== null) {
      logger.debug(`Using cached ${dataTypeName} data`, { component: 'fetchService', dataTypeName });
      progressCallback?.({ stage: 'complete', percentage: 100, message: 'Using cached data' });
      return cachedData;
    }
  }

  const rateLimitKey = `csv:${dataTypeName}`;
  const rateLimitResult = checkRateLimit('fetch', rateLimitKey);
  if (!rateLimitResult.allowed) {
    const error = new Error(
      `Rate limit exceeded for ${dataTypeName} CSV fetch. ${rateLimitResult.error || 'Please try again later.'}`
    );
    logger.error('Rate limit exceeded', error, {
      component: 'fetchService',
      dataTypeName,
      operation: 'fetchCSVData',
      rateLimitResult,
    });
    throw error;
  }

  logger.debug(
    `Using CSV proxy for ${dataTypeName} (slower method - configure VITE_APPS_SCRIPT_URL for 5-10x faster performance)`,
    { component: 'fetchService', dataTypeName, operation: 'fetchCSVData' }
  );

  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data via CSV proxy...`,
  });

  const proxyErrors: Array<{ proxy: string; error: string }> = [];

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[i];
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(csvUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      let response: Response;
      try {
        response = await fetch(proxyUrl, {
          headers: { Accept: 'text/csv' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after ${FETCH_TIMEOUT_SECONDS} seconds`);
        }
        if (fetchError instanceof TypeError) {
          const errorMessage = fetchError.message.toLowerCase();
          if (
            errorMessage.includes('cors') ||
            errorMessage.includes('cross-origin') ||
            errorMessage.includes('access-control-allow-origin') ||
            errorMessage.includes('networkerror') ||
            errorMessage.includes('failed to fetch')
          ) {
            throw new Error('CORS policy blocked');
          }
        }
        throw fetchError;
      }

      if (!response.ok) {
        if (response.status === 408) {
          proxyErrors.push({ proxy, error: 'Request timeout (408)' });
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (proxyErrors.length > 0) {
        logger.info(
          `${dataTypeName}: Successfully fetched via ${proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')} (after ${proxyErrors.length} failed attempt${proxyErrors.length > 1 ? 's' : ''})`,
          { component: 'fetchService', dataTypeName, proxy, failedAttempts: proxyErrors.length }
        );
      }

      progressCallback?.({
        stage: 'fetch',
        percentage: 30,
        message: `Received ${dataTypeName} data, parsing...`,
      });

      const csvText = await response.text();
      validateCSVText(csvText);

      progressCallback?.({
        stage: 'parse',
        percentage: 40,
        message: `Parsing ${dataTypeName} CSV...`,
      });

      return await new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
          complete: async (results) => {
            try {
              if (results.data.length > 0) {
                logger.debug(`${dataTypeName} CSV Headers: ${results.meta.fields?.join(', ') || 'none'}`, {
                  component: 'fetchService',
                  dataTypeName,
                  headers: results.meta.fields,
                });
                logger.debug(`${dataTypeName} First row sample`, {
                  component: 'fetchService',
                  dataTypeName,
                  firstRow: results.data[0],
                });
              }

              progressCallback?.({
                stage: 'transform',
                percentage: 80,
                message: `Transforming ${dataTypeName} data...`,
                rowsProcessed: results.data.length,
                totalRows: results.data.length,
              });

              const compatibleResults = {
                data: results.data as DataRow[],
                meta: { fields: results.meta.fields || null },
              };

              let transformedData: T[];
              const transformerId = getTransformerId(dataTypeName);
              if (transformerId) {
                try {
                  transformedData = await transformInWorker<T>(
                    transformerId,
                    compatibleResults.data,
                    compatibleResults.meta,
                    progressCallback,
                    additionalData,
                    transformer
                  );
                } catch (workerError) {
                  logger.debug(`Worker transformation failed for ${dataTypeName}, using main thread`, {
                    component: 'fetchService',
                    dataTypeName,
                    error: workerError,
                  });
                  transformedData = transformer(compatibleResults);
                }
              } else {
                transformedData = transformer(compatibleResults);
              }

              if (transformedData.length === 0) {
                logger.error(
                  `${dataTypeName} CSV parsing result: No valid data found`,
                  undefined,
                  {
                    component: 'fetchService',
                    dataTypeName,
                    totalRows: results.data.length,
                    headers: results.meta.fields,
                    firstRow: results.data[0],
                    csvPreview: csvText.substring(0, 500),
                  }
                );
                const columnsMsg = requiredColumns
                  ? `Please check that the Google Sheet has columns: ${requiredColumns.join(', ')}`
                  : '';
                reject(
                  new Error(
                    `No valid ${dataTypeName} data found in CSV. ` +
                      `Found ${results.data.length} rows. ` +
                      `Headers: ${results.meta.fields?.join(', ') || 'none'}. ` +
                      columnsMsg
                  )
                );
                return;
              }

              logger.info(
                `Successfully parsed ${transformedData.length} ${dataTypeName} entries from CSV`,
                { component: 'fetchService', dataTypeName, count: transformedData.length }
              );

              if (cacheKey) {
                logger.debug(`Saving ${dataTypeName} data to Firestore cache (CSV)`, {
                  component: 'fetchService',
                  dataTypeName,
                  cacheKey,
                  entryCount: transformedData.length,
                });
                try {
                  await setCachedData(cacheKey, transformedData, ttl);
                  logger.info(`${dataTypeName} data saved to Firestore cache successfully (CSV)`, {
                    component: 'fetchService',
                    dataTypeName,
                    cacheKey,
                    entryCount: transformedData.length,
                  });
                } catch (cacheError) {
                  logger.error(`Failed to save ${dataTypeName} data to Firestore cache (CSV)`, {
                    component: 'fetchService',
                    dataTypeName,
                    cacheKey,
                    error: cacheError,
                  });
                }
              }

              progressCallback?.({
                stage: 'complete',
                percentage: 100,
                message: `Successfully loaded ${transformedData.length} ${dataTypeName} entries`,
                rowsProcessed: transformedData.length,
                totalRows: transformedData.length,
              });

              resolve(transformedData);
            } catch (error: unknown) {
              const errorHandler = createErrorHandler({
                operation: `parse ${dataTypeName} CSV data`,
                component: 'fetchService',
                additionalInfo: { dataTypeName, proxy },
              });
              const formatted = errorHandler(error);
              reject(new Error(`Failed to parse ${dataTypeName} CSV data: ${formatted.message}`));
            }
          },
          error: (error: unknown) => {
            const errorHandler = createErrorHandler({
              operation: `parse ${dataTypeName} CSV`,
              component: 'fetchService',
              additionalInfo: { dataTypeName, proxy },
            });
            const formatted = errorHandler(error);
            reject(new Error(`${dataTypeName} CSV parsing error: ${formatted.message}`));
          },
        });
      });
    } catch (error: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch CSV via proxy',
        component: 'fetchService',
        additionalInfo: { proxy, csvUrl, dataTypeName },
      });
      const formatted = errorHandler(error);

      const isCorsError =
        isNetworkError(error) ||
        formatted.message.includes('CORS') ||
        formatted.message.includes('cross-origin') ||
        formatted.message.includes('Access-Control-Allow-Origin') ||
        formatted.message.includes('CORS policy blocked') ||
        (error instanceof TypeError && error.message.toLowerCase().includes('cors'));
      const isTimeoutError =
        formatted.message.includes('timeout') ||
        formatted.message.includes('408') ||
        formatted.message.includes('Request timeout');
      const isNetworkErr =
        isNetworkError(error) ||
        formatted.message.includes('Failed to fetch') ||
        formatted.message.includes('network');

      proxyErrors.push({
        proxy,
        error: isCorsError
          ? 'CORS blocked'
          : isTimeoutError
            ? 'Request timeout'
            : isNetworkErr
              ? 'Network error'
              : formatted.message.substring(0, 50),
      });

      if (isCorsError && i < CORS_PROXIES.length - 1) {
        continue;
      }

      if (i === CORS_PROXIES.length - 1) {
        logger.warn(
          `${dataTypeName}: All proxy attempts failed. Errors: ${proxyErrors.map((e) => `${e.proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}: ${e.error}`).join(', ')}`,
          { component: 'fetchService', dataTypeName, proxyErrors }
        );
      }

      if (i < CORS_PROXIES.length - 1 && !isCorsError) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      continue;
    }
  }

  const errorSummary =
    proxyErrors.length > 0
      ? `\nProxy failures:\n${proxyErrors.map((e, idx) => `  ${idx + 1}. ${e.proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}: ${e.error}`).join('\n')}`
      : '';

  throw new Error(
    `Failed to fetch ${dataTypeName} data from all proxies (tried ${CORS_PROXIES.length} proxy${CORS_PROXIES.length > 1 ? 'ies' : ''}).${errorSummary}\n\n` +
      `SOLUTIONS:\n` +
      `1. Check your internet connection\n` +
      `2. Verify the Google Sheet is publicly accessible (Share → Anyone with the link → Viewer)\n` +
      `3. Configure Apps Script URL to bypass proxies: Set VITE_APPS_SCRIPT_URL environment variable\n` +
      `4. Wait a moment and refresh the page (proxy services may be temporarily unavailable)`
  );
}
