/**
 * Fetch JSON data from Apps Script API.
 */

import { getCachedData, setCachedData, DEFAULT_TTL } from '../firestoreCacheService';
import { createErrorHandler, isNetworkError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { checkRateLimit } from '../../utils/rateLimiter';
import { transformInWorker, getTransformerId } from '../workerService';
import type { DataRow, ProgressCallback } from './types';
import { APPS_SCRIPT_URL } from './fetchConfig';
import { convert2DArrayToObjects, createMockParseResult } from './fetchDataConversion';
import { isSecureMode } from '../../config/securityMode';
import { SecurityError } from '../../utils/securityErrors';

export async function fetchJSONData<T>(
  sheetName: string,
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

  const rateLimitKey = `json:${sheetName}:${dataTypeName}`;
  const rateLimitResult = checkRateLimit('fetch', rateLimitKey);
  if (!rateLimitResult.allowed) {
    const error = new Error(
      `Rate limit exceeded for ${dataTypeName} data fetch. ${rateLimitResult.error || 'Please try again later.'}`
    );
    logger.error('Rate limit exceeded', error, {
      component: 'fetchService',
      dataTypeName,
      operation: 'fetchJSONData',
      rateLimitResult,
    });
    throw error;
  }

  if (isSecureMode()) {
    logger.warn('Secure mode: legacy GET to Apps Script blocked', {
      component: 'fetchService',
      dataTypeName,
      operation: 'fetchJSONData',
    });
    throw new SecurityError(
      'Secure mode: legacy GET to Apps Script is disabled. Use delta sync or admin refresh. Set VITE_APPS_SCRIPT_PROXY_URL for client fetch.'
    );
  }

  if (!APPS_SCRIPT_URL) {
    const isProduction = import.meta.env.PROD;
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    if (isProduction || isVercel) {
      logger.error(
        `Apps Script URL NOT configured in Vercel for ${dataTypeName}! App will fall back to slower CSV proxy method. TO FIX: Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add VITE_APPS_SCRIPT_URL → Select all environments → Save and REDEPLOY`,
        undefined,
        { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
      );
    } else {
      logger.warn(
        `Apps Script URL not configured locally for ${dataTypeName}, falling back to CSV. To enable locally: Create .env.local file with VITE_APPS_SCRIPT_URL=your-apps-script-url`,
        { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
      );
    }
    throw new Error('Apps Script URL not configured');
  }

  if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
    logger.error(
      'Invalid Apps Script URL format. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec',
      undefined,
      { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
    );
    throw new Error('Invalid Apps Script URL format. Please check VITE_APPS_SCRIPT_URL environment variable.');
  }

  logger.debug(
    `Using Apps Script API for ${dataTypeName} (5-10x faster than CSV proxy)`,
    { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
  );

  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data from Apps Script API...`,
  });

  try {
    const url = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        mode: 'cors',
      });
    } catch (fetchError: unknown) {
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        const isCorsError =
          fetchError.message.includes('CORS') ||
          fetchError.message.includes('cross-origin') ||
          fetchError.message.includes('Access-Control-Allow-Origin');
        if (isCorsError || url.includes('script.google.com')) {
          throw new Error(
            `CORS error: Apps Script is blocking cross-origin requests. ` +
              `SOLUTION: In Apps Script → Deploy → Manage deployments → Edit → ` +
              `Set "Who has access" to "Anyone" → Save and redeploy. ` +
              `Also verify the URL format: ${APPS_SCRIPT_URL}`
          );
        }
      }
      throw fetchError;
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Apps Script not found (404). Please verify the URL: ${APPS_SCRIPT_URL}`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Apps Script access denied (${response.status}). ` +
            `SOLUTION: In Apps Script → Deploy → Manage deployments → Edit → ` +
            `Set "Who has access" to "Anyone" → Save and redeploy.`
        );
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    progressCallback?.({
      stage: 'fetch',
      percentage: 30,
      message: `Received ${dataTypeName} data, parsing...`,
    });

    let jsonData: unknown;
    try {
      jsonData = await response.json();
    } catch (parseError: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'parse JSON response',
        component: 'fetchService',
        additionalInfo: { sheetName, dataTypeName },
      });
      const formatted = errorHandler(parseError);
      throw new Error(`Failed to parse JSON response: ${formatted.message}`);
    }

    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      throw new Error('Invalid JSON response: expected non-empty array');
    }

    progressCallback?.({
      stage: 'parse',
      percentage: 40,
      message: `Parsing ${dataTypeName} JSON...`,
    });

    const dataRows = convert2DArrayToObjects(jsonData);
    if (dataRows.length === 0) {
      throw new Error('No data rows found after conversion');
    }

    if (dataRows.length > 0) {
      const fields = Object.keys(dataRows[0]);
      logger.debug(`${dataTypeName} JSON Headers: ${fields.join(', ')}`, {
        component: 'fetchService',
        dataTypeName,
        headers: fields,
      });
      logger.debug(`${dataTypeName} First row sample`, {
        component: 'fetchService',
        dataTypeName,
        firstRow: dataRows[0],
      });
    }

    const mockResults = createMockParseResult(dataRows);

    progressCallback?.({
      stage: 'transform',
      percentage: 80,
      message: `Transforming ${dataTypeName} data...`,
      rowsProcessed: dataRows.length,
      totalRows: dataRows.length,
    });

    let transformedData: T[];
    const transformerId = getTransformerId(dataTypeName, sheetName);
    if (transformerId) {
      try {
        transformedData = await transformInWorker<T>(
          transformerId,
          dataRows,
          mockResults.meta,
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
        transformedData = transformer(mockResults);
      }
    } else {
      transformedData = transformer(mockResults);
    }

    if (transformedData.length === 0) {
      const fields = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
      const columnsMsg = requiredColumns
        ? `Please check that the Google Sheet has columns: ${requiredColumns.join(', ')}`
        : '';
      throw new Error(
        `No valid ${dataTypeName} data found. ` +
          `Found ${dataRows.length} rows. ` +
          `Headers: ${fields.join(', ') || 'none'}. ` +
          columnsMsg
      );
    }

    logger.info(
      `Successfully loaded ${transformedData.length} ${dataTypeName} entries via Apps Script API (fast method)`,
      { component: 'fetchService', dataTypeName, count: transformedData.length }
    );

    if (cacheKey) {
      logger.debug(`Saving ${dataTypeName} data to Firestore cache`, {
        component: 'fetchService',
        dataTypeName,
        cacheKey,
        entryCount: transformedData.length,
      });
      try {
        await setCachedData(cacheKey, transformedData, ttl);
        logger.info(`${dataTypeName} data saved to Firestore cache successfully`, {
          component: 'fetchService',
          dataTypeName,
          cacheKey,
          entryCount: transformedData.length,
        });
      } catch (cacheError) {
        logger.error(`Failed to save ${dataTypeName} data to Firestore cache`, {
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

    return transformedData;
  } catch (error: unknown) {
    const errorHandler = createErrorHandler({
      operation: `fetch ${dataTypeName} data from Apps Script`,
      component: 'fetchService',
      additionalInfo: { sheetName, dataTypeName, url: APPS_SCRIPT_URL },
    });
    const formatted = errorHandler(error);

    let errorGuidance = '';
    if (
      isNetworkError(error) ||
      formatted.message.includes('CORS') ||
      formatted.message.includes('cross-origin')
    ) {
      errorGuidance =
        `\n\nTroubleshooting CORS:\n` +
        `1. Go to Apps Script → Deploy → Manage deployments\n` +
        `2. Click edit (pencil icon) on your deployment\n` +
        `3. Verify "Who has access" is set to "Anyone"\n` +
        `4. Save and redeploy\n` +
        `5. Verify URL format: https://script.google.com/macros/s/SCRIPT_ID/exec`;
    } else if (formatted.message.includes('404') || formatted.message.includes('not found')) {
      errorGuidance =
        `\n\nTroubleshooting 404:\n` +
        `1. Verify VITE_APPS_SCRIPT_URL in Vercel Environment Variables\n` +
        `2. Test the URL directly in browser: ${APPS_SCRIPT_URL}?sheet=${sheetName}\n` +
        `3. Ensure Apps Script is deployed as "Web app" (not "Library")\n` +
        `4. URL should end with /exec (not /library/...)`;
    } else if (formatted.message.includes('Invalid Apps Script URL')) {
      errorGuidance =
        `\n\nExpected URL format: https://script.google.com/macros/s/SCRIPT_ID/exec\n` +
        `Current URL: ${APPS_SCRIPT_URL || '(not set)'}`;
    }

    const enhancedError = new Error(
      `Failed to fetch ${dataTypeName} data from Apps Script: ${formatted.message}. ` +
        `Please check your Apps Script URL configuration and ensure the sheet "${sheetName}" exists.${errorGuidance}`
    );
    if (error instanceof Error) {
      enhancedError.stack = error.stack;
      (enhancedError as Error & { cause?: unknown }).cause = error;
    }
    throw enhancedError;
  }
}
