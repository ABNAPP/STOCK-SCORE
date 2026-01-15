/**
 * Fetch Service
 * 
 * Provides generic functions for fetching data from Google Sheets via Apps Script API
 * or CSV proxy fallback. Handles caching, progress tracking, and error handling.
 */

import Papa from 'papaparse';
import { getCachedData, setCachedData, DEFAULT_TTL } from '../cacheService';
import { formatError, logError, createErrorHandler, isNetworkError } from '../../utils/errorHandler';
import { is2DArray, isDataRowArray } from '../../utils/typeGuards';
import { logger } from '../../utils/logger';
import { checkRateLimit } from '../../utils/rateLimiter';
import type { DataRow, ProgressCallback } from './types';

// Apps Script Web App URL - Replace with your deployed Apps Script URL
// To deploy: Create Apps Script bound to sheet → Deploy as Web App → Copy URL
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Validate Apps Script URL format at startup (warn only, don't fail)
if (APPS_SCRIPT_URL) {
  if (import.meta.env.DEV) {
    if (APPS_SCRIPT_URL.includes('/library/')) {
      logger.error(
        'Invalid Apps Script URL: Looks like a library deployment, not a Web App! Expected format: https://script.google.com/macros/s/SCRIPT_ID/exec. SOLUTION: Redeploy as "Web app" (not "Library") in Apps Script → Deploy → New deployment',
        undefined,
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    } else if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
      logger.warn(
        'Apps Script URL format may be incorrect. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    } else {
      logger.info(
        'Apps Script URL configured successfully. Status: Ready to use (will bypass CSV proxy)',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  }
} else {
  const isProduction = import.meta.env.PROD;
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  
  if (isProduction || isVercel) {
    if (import.meta.env.DEV) {
      logger.error(
        'Apps Script URL NOT configured in Vercel! App will fall back to slower CSV proxy method. TO FIX: Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add VITE_APPS_SCRIPT_URL → Select all environments → Save and REDEPLOY',
        undefined,
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  } else {
    if (import.meta.env.DEV) {
      logger.info(
        'Apps Script URL not configured locally. App will use CSV fallback. To enable locally: Create .env.local file with VITE_APPS_SCRIPT_URL=your-apps-script-url',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  }
}

// Fallback: Use CORS proxy if Apps Script URL is not configured
// Why multiple proxies? Fallback strategy - if one fails, try the next
// This improves reliability when individual proxy services are down
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

// Request timeout: Configurable via environment variable, default 30 seconds
// Why 30s for CSV but 60s for delta sync?
// - CSV proxy: Faster feedback for user, proxies may timeout quickly
// - Delta sync: May need to fetch large snapshots, longer timeout prevents false failures
const FETCH_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_FETCH_TIMEOUT_SECONDS || '30', 10);
const FETCH_TIMEOUT = FETCH_TIMEOUT_SECONDS * 1000;

/**
 * Validates CSV text to ensure it's not HTML or empty
 * 
 * Checks if the response is valid CSV data and not an HTML login page.
 * Throws descriptive errors if validation fails.
 * 
 * @param csvText - The CSV text to validate
 * @throws {Error} If the text is empty, HTML, or doesn't appear to be valid CSV
 */
function validateCSVText(csvText: string): void {
  if (!csvText || csvText.trim().length === 0) {
    throw new Error('Empty response from server');
  }
  
  // Check if we got HTML instead of CSV
  const trimmedText = csvText.trim().toLowerCase();
  if (trimmedText.startsWith('<!doctype html') || 
      trimmedText.startsWith('<html') || 
      csvText.includes('accounts.google.com') ||
      csvText.includes('Sign in') ||
      csvText.includes('signin') ||
      csvText.includes('Google Account')) {
    throw new Error(
      'Received HTML login page instead of CSV data. ' +
      'The Google Sheet is not publicly accessible. ' +
      'SOLUTION: Go to your Google Sheet → Click "Share" button → ' +
      'Change to "Anyone with the link" → Set permission to "Viewer" → Save. ' +
      'Then refresh this page.'
    );
  }
  
  // Basic CSV validation
  if (!csvText.includes(',') && csvText.length > 100) {
    throw new Error('Response does not appear to be valid CSV data');
  }
}

/**
 * Convert 2D array from Apps Script to object array format
 * 
 * Apps Script returns data as a 2D array where the first row contains headers
 * and subsequent rows contain values. This function converts it to an array
 * of objects with header names as keys.
 * 
 * @param data - 2D array from Apps Script: [["Header1", "Header2"], ["Value1", "Value2"], ...]
 * @returns Array of objects: [{"Header1": "Value1", "Header2": "Value2"}, ...]
 * @throws {Error} If data is not a valid 2D array
 */
export function convert2DArrayToObjects(data: unknown[][]): DataRow[] {
  if (!is2DArray(data) || data.length === 0) {
    return [];
  }

  const headers = data[0].map((h: unknown) => String(h).trim());
  const rows: DataRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const row: DataRow = {};
    const values = data[i];
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];
      // Convert unknown value to DataRow value type (string | number | undefined)
      if (value === null || value === undefined || value === '') {
        row[header] = '';
      } else if (typeof value === 'string' || typeof value === 'number') {
        row[header] = value;
      } else {
        // Convert other types to string
        row[header] = String(value);
      }
    }
    
    rows.push(row);
  }

  return rows;
}

/**
 * Create a mock Papa.ParseResult-like object for compatibility with existing transformers
 * 
 * This function creates a structure that matches PapaParse's ParseResult format,
 * allowing transformers designed for CSV parsing to work with JSON data from Apps Script.
 * 
 * @param data - Array of data rows (objects with key-value pairs)
 * @returns Object with data and meta fields matching PapaParse format
 */
export function createMockParseResult(data: DataRow[]): { data: DataRow[]; meta: { fields: string[] | null } } {
  const fields = data.length > 0 ? Object.keys(data[0]) : null;
  return {
    data,
    meta: { fields },
  };
}

/**
 * Generic function to fetch JSON data from Apps Script API
 * 
 * Fetches data from Google Apps Script Web App API and transforms it using the provided
 * transformer function. Supports caching, progress callbacks, and automatic fallback handling.
 * 
 * @template T - The type of data returned after transformation
 * @param sheetName - Name of the sheet to fetch (e.g., "DashBoard", "SMA")
 * @param dataTypeName - Name of the data type for error messages (e.g., "Benjamin Graham")
 * @param transformer - Function to transform data rows into the target data type
 * @param requiredColumns - Optional list of required column names for error messages
 * @param cacheKey - Optional cache key for caching. If provided, checks cache before network request
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param ttl - Optional TTL in milliseconds for cache (default: DEFAULT_TTL)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of transformed data
 * @throws {Error} If Apps Script URL is not configured, fetch fails, or data is invalid
 */
export async function fetchJSONData<T>(
  sheetName: string,
  dataTypeName: string,
  transformer: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[],
  requiredColumns?: string[],
  cacheKey?: string,
  forceRefresh: boolean = false,
  ttl: number = DEFAULT_TTL,
  progressCallback?: ProgressCallback
): Promise<T[]> {
  // Check cache first if cacheKey is provided and not forcing refresh
  if (cacheKey && !forceRefresh) {
    const cachedData = getCachedData<T[]>(cacheKey);
    if (cachedData !== null) {
      logger.debug(`Using cached ${dataTypeName} data`, { component: 'fetchService', dataTypeName });
      progressCallback?.({
        stage: 'complete',
        percentage: 100,
        message: 'Using cached data',
      });
      return cachedData;
    }
  }

  // Check rate limit before making API call
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

  // If Apps Script URL is not configured, fall back to CSV
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
    // This will be handled by the calling function
    throw new Error('Apps Script URL not configured');
  }

  // Validate Apps Script URL format
  if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
    logger.error(
      'Invalid Apps Script URL format. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec',
      undefined,
      { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
    );
    throw new Error('Invalid Apps Script URL format. Please check VITE_APPS_SCRIPT_URL environment variable.');
  }

  // Why Apps Script API is 5-10x faster than CSV proxy:
  // - Direct JSON response (no CSV parsing overhead)
  // - No CORS proxy latency (direct connection)
  // - Optimized server-side processing in Apps Script
  // - Smaller payload size (JSON vs CSV with formatting)
  logger.debug(
    `Using Apps Script API for ${dataTypeName} (5-10x faster than CSV proxy)`,
    { component: 'fetchService', dataTypeName, operation: 'fetchJSONData' }
  );

  // Report fetch start
  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data from Apps Script API...`,
  });

  try {
    // Fetch from Apps Script with sheet name as parameter
    const url = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors', // Explicitly request CORS
      });
    } catch (fetchError: unknown) {
      // Handle CORS and network errors
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        const isCorsError = fetchError.message.includes('CORS') || 
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
      // Handle specific error codes
      if (response.status === 404) {
        throw new Error(`Apps Script not found (404). Please verify the URL: ${APPS_SCRIPT_URL}`);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Apps Script access denied (${response.status}). ` +
          `SOLUTION: In Apps Script → Deploy → Manage deployments → Edit → ` +
          `Set "Who has access" to "Anyone" → Save and redeploy.`
        );
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Report response received
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

    // Validate JSON structure
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      throw new Error('Invalid JSON response: expected non-empty array');
    }

    // Report parsing start
    progressCallback?.({
      stage: 'parse',
      percentage: 40,
      message: `Parsing ${dataTypeName} JSON...`,
    });

    // Convert 2D array to objects
    const dataRows = convert2DArrayToObjects(jsonData);

    if (dataRows.length === 0) {
      throw new Error('No data rows found after conversion');
    }

    // Debug: Log first few rows
    if (dataRows.length > 0) {
      const fields = Object.keys(dataRows[0]);
      logger.debug(`${dataTypeName} JSON Headers: ${fields.join(', ')}`, { component: 'fetchService', dataTypeName, headers: fields });
      logger.debug(`${dataTypeName} First row sample`, { component: 'fetchService', dataTypeName, firstRow: dataRows[0] });
    }

    // Create mock parse result for compatibility
    const mockResults = createMockParseResult(dataRows);

    // Report transformation start
    progressCallback?.({
      stage: 'transform',
      percentage: 80,
      message: `Transforming ${dataTypeName} data...`,
      rowsProcessed: dataRows.length,
      totalRows: dataRows.length,
    });

    const transformedData = transformer(mockResults);

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

    // Cache the data if cacheKey is provided
    if (cacheKey) {
      setCachedData(cacheKey, transformedData, ttl);
    }

    // Report complete
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
    
    // Provide specific guidance based on error type
    let errorGuidance = '';
    if (isNetworkError(error) || formatted.message.includes('CORS') || formatted.message.includes('cross-origin')) {
      errorGuidance = `\n\nTroubleshooting CORS:\n` +
        `1. Go to Apps Script → Deploy → Manage deployments\n` +
        `2. Click edit (pencil icon) on your deployment\n` +
        `3. Verify "Who has access" is set to "Anyone"\n` +
        `4. Save and redeploy\n` +
        `5. Verify URL format: https://script.google.com/macros/s/SCRIPT_ID/exec`;
    } else if (formatted.message.includes('404') || formatted.message.includes('not found')) {
      errorGuidance = `\n\nTroubleshooting 404:\n` +
        `1. Verify VITE_APPS_SCRIPT_URL in Vercel Environment Variables\n` +
        `2. Test the URL directly in browser: ${APPS_SCRIPT_URL}?sheet=${sheetName}\n` +
        `3. Ensure Apps Script is deployed as "Web app" (not "Library")\n` +
        `4. URL should end with /exec (not /library/...)`;
    } else if (formatted.message.includes('Invalid Apps Script URL')) {
      errorGuidance = `\n\nExpected URL format: https://script.google.com/macros/s/SCRIPT_ID/exec\n` +
        `Current URL: ${APPS_SCRIPT_URL || '(not set)'}`;
    }
    
    const enhancedError = new Error(
      `Failed to fetch ${dataTypeName} data from Apps Script: ${formatted.message}. ` +
      `Please check your Apps Script URL configuration and ensure the sheet "${sheetName}" exists.${errorGuidance}`
    );
    
    // Preserve original error for debugging
    if (error instanceof Error) {
      enhancedError.stack = error.stack;
      enhancedError.cause = error;
    }
    
    throw enhancedError;
  }
}

/**
 * Generic function to fetch and parse CSV data from Google Sheets
 * 
 * Fetches CSV data from Google Sheets using CORS proxies as fallback when Apps Script
 * is not available. Supports multiple proxy fallbacks, caching, and progress tracking.
 * 
 * @template T - The type of data returned after transformation
 * @param csvUrl - The Google Sheets CSV export URL
 * @param dataTypeName - Name of the data type for error messages (e.g., "Benjamin Graham")
 * @param transformer - Function to transform parsed CSV rows into the target data type
 * @param requiredColumns - Optional list of required column names for error messages
 * @param cacheKey - Optional cache key for caching. If provided, checks cache before network request
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param ttl - Optional TTL in milliseconds for cache (default: DEFAULT_TTL)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of transformed data
 * @throws {Error} If all proxies fail, CSV parsing fails, or data is invalid
 */
export async function fetchCSVData<T>(
  csvUrl: string,
  dataTypeName: string,
  transformer: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[],
  requiredColumns?: string[],
  cacheKey?: string,
  forceRefresh: boolean = false,
  ttl: number = DEFAULT_TTL,
  progressCallback?: ProgressCallback
): Promise<T[]> {
  // Check cache first if cacheKey is provided and not forcing refresh
  if (cacheKey && !forceRefresh) {
    const cachedData = getCachedData<T[]>(cacheKey);
    if (cachedData !== null) {
      logger.debug(`Using cached ${dataTypeName} data`, { component: 'fetchService', dataTypeName });
      progressCallback?.({
        stage: 'complete',
        percentage: 100,
        message: 'Using cached data',
      });
      return cachedData;
    }
  }

  // Check rate limit before making API call
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

  // Log that we're using the slower CSV proxy method
  logger.debug(
    `Using CSV proxy for ${dataTypeName} (slower method - configure VITE_APPS_SCRIPT_URL for 5-10x faster performance)`,
    { component: 'fetchService', dataTypeName, operation: 'fetchCSVData' }
  );

  // Report fetch start
  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data via CSV proxy...`,
  });

  let lastError: Error | null = null;
  const proxyErrors: Array<{ proxy: string; error: string }> = [];
  
  // Try each proxy in sequence
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[i];
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(csvUrl)}`;
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      // Fetch with timeout
      let response: Response;
      try {
        response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/csv',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        // Check if it was aborted (timeout)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          const errorHandler = createErrorHandler({
            operation: 'fetch CSV data',
            component: 'fetchService',
            additionalInfo: { proxy, csvUrl, dataTypeName },
          });
          throw new Error(`Request timeout after ${FETCH_TIMEOUT_SECONDS} seconds`);
        }
        throw fetchError;
      }
      
      if (!response.ok) {
        // Don't log 408 timeouts as errors - just try next proxy
        if (response.status === 408) {
          proxyErrors.push({ proxy, error: 'Request timeout (408)' });
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Success! Log which proxy worked
      if (proxyErrors.length > 0) {
        logger.info(
          `${dataTypeName}: Successfully fetched via ${proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')} (after ${proxyErrors.length} failed attempt${proxyErrors.length > 1 ? 's' : ''})`,
          { component: 'fetchService', dataTypeName, proxy, failedAttempts: proxyErrors.length }
        );
      }
      
      // Report response received
      progressCallback?.({
        stage: 'fetch',
        percentage: 30,
        message: `Received ${dataTypeName} data, parsing...`,
      });
      
      const csvText = await response.text();
      validateCSVText(csvText);
    
      // Report parsing start
      progressCallback?.({
        stage: 'parse',
        percentage: 40,
        message: `Parsing ${dataTypeName} CSV...`,
      });
      
      // Parse CSV data
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => {
            return header.trim();
          },
          complete: (results) => {
            try {
              // Debug: Log first few rows
              if (results.data.length > 0) {
                logger.debug(`${dataTypeName} CSV Headers: ${results.meta.fields?.join(', ') || 'none'}`, { component: 'fetchService', dataTypeName, headers: results.meta.fields });
                logger.debug(`${dataTypeName} First row sample`, { component: 'fetchService', dataTypeName, firstRow: results.data[0] });
              }

              // Report transformation start
              progressCallback?.({
                stage: 'transform',
                percentage: 80,
                message: `Transforming ${dataTypeName} data...`,
                rowsProcessed: results.data.length,
                totalRows: results.data.length,
              });

              // Convert Papa.ParseResult to compatible format
              const compatibleResults = {
                data: results.data as DataRow[],
                meta: { fields: results.meta.fields || null },
              };
              const transformedData = transformer(compatibleResults);
              
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
                reject(new Error(
                  `No valid ${dataTypeName} data found in CSV. ` +
                  `Found ${results.data.length} rows. ` +
                  `Headers: ${results.meta.fields?.join(', ') || 'none'}. ` +
                  columnsMsg
                ));
                return;
              }
              
              logger.info(
                `Successfully parsed ${transformedData.length} ${dataTypeName} entries from CSV`,
                { component: 'fetchService', dataTypeName, count: transformedData.length }
              );
              
              // Cache the data if cacheKey is provided
              if (cacheKey) {
                setCachedData(cacheKey, transformedData, ttl);
              }
              
              // Report complete
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
      // Save error and try next proxy
      const errorHandler = createErrorHandler({
        operation: 'fetch CSV via proxy',
        component: 'fetchService',
        additionalInfo: { proxy, csvUrl, dataTypeName },
      });
      const formatted = errorHandler(error);
      lastError = error instanceof Error ? error : new Error(formatted.message);
      
      // Categorize the error
      const isCorsError = isNetworkError(error) || 
                         formatted.message.includes('CORS') || 
                         formatted.message.includes('cross-origin') ||
                         formatted.message.includes('Access-Control-Allow-Origin');
      const isTimeoutError = formatted.message.includes('timeout') || 
                            formatted.message.includes('408') ||
                            formatted.message.includes('Request timeout');
      const isNetworkErr = isNetworkError(error) ||
                          formatted.message.includes('Failed to fetch') ||
                          formatted.message.includes('network');
      
      // Store error info (only log if all proxies fail)
      proxyErrors.push({ 
        proxy, 
        error: isCorsError ? 'CORS blocked' : 
               isTimeoutError ? 'Request timeout' :
               isNetworkErr ? 'Network error' :
               formatted.message.substring(0, 50)
      });
      
      // Only log detailed error if this is the last proxy attempt
      if (i === CORS_PROXIES.length - 1) {
        logger.warn(
          `${dataTypeName}: All proxy attempts failed. Errors: ${proxyErrors.map(e => `${e.proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}: ${e.error}`).join(', ')}`,
          { component: 'fetchService', dataTypeName, proxyErrors }
        );
      }
      
      // Add a small delay before trying next proxy (except for last attempt)
      if (i < CORS_PROXIES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      continue;
    }
  }
  
  // If all proxies failed, provide detailed error message
  const errorSummary = proxyErrors.length > 0 
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

/**
 * Generic function to fetch data with automatic fallback from JSON to CSV
 * 
 * This function tries to fetch data using the fast Apps Script API (JSON) first,
 * and automatically falls back to the slower CSV proxy method if JSON fails.
 * This reduces code duplication across all sheet services.
 * 
 * @template T - The type of data returned after transformation
 * @param config - Configuration object containing all fetch parameters
 * @returns Promise resolving to array of transformed data
 * @throws {Error} If both JSON and CSV methods fail
 * 
 * @example
 * ```typescript
 * // Automatic fallback from JSON to CSV
 * const data = await fetchWithFallback<BenjaminGrahamData[]>({
 *   sheetName: 'DashBoard',
 *   dataTypeName: 'Benjamin Graham',
 *   transformer: transformBenjaminGrahamData,
 *   requiredColumns: ['Benjamin Graham', 'Company Name', 'Ticker'],
 *   cacheKey: CACHE_KEYS.BENJAMIN_GRAHAM,
 *   csvUrl: BENJAMIN_GRAHAM_CSV_URL
 * });
 * 
 * // Tries Apps Script API first (fast), falls back to CSV if needed
 * ```
 */
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
  } = config;

  // Try Apps Script first (fast method)
  try {
    return await fetchJSONData<T>(
      sheetName,
      dataTypeName,
      transformer,
      requiredColumns,
      cacheKey,
      forceRefresh,
      ttl,
      progressCallback
    );
  } catch (error: unknown) {
    // Fallback to CSV if Apps Script fails
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
      progressCallback
    );
  }
}
