import Papa from 'papaparse';
import { BenjaminGrahamData, PEIndustryData, ScoreBoardData, ThresholdIndustryData, SMAData } from '../types/stock';
import {
  INDUSTRY_IRR_MAP,
  INDUSTRY_LEVERAGE_F2_MAP,
  INDUSTRY_RO40_MAP,
  INDUSTRY_CASH_SDEBT_MAP,
  INDUSTRY_CURRENT_RATIO_MAP,
} from '../config/industryThresholds';
import { getCachedData, setCachedData, DEFAULT_TTL, CACHE_KEYS } from './cacheService';

// Apps Script Web App URL - Replace with your deployed Apps Script URL
// To deploy: Create Apps Script bound to sheet → Deploy as Web App → Copy URL
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Validate Apps Script URL format at startup (warn only, don't fail)
if (APPS_SCRIPT_URL) {
  if (APPS_SCRIPT_URL.includes('/library/')) {
    console.error(
      '❌ Invalid Apps Script URL: Looks like a library deployment, not a Web App!\n' +
      'Expected format: https://script.google.com/macros/s/SCRIPT_ID/exec\n' +
      'Current URL: ' + APPS_SCRIPT_URL + '\n' +
      'SOLUTION: Redeploy as "Web app" (not "Library") in Apps Script → Deploy → New deployment'
    );
  } else if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
    console.warn(
      '⚠️ Apps Script URL format may be incorrect:\n' +
      'Expected: https://script.google.com/macros/s/SCRIPT_ID/exec\n' +
      'Current: ' + APPS_SCRIPT_URL
    );
  } else {
    console.log(
      '✅ Apps Script URL configured successfully!\n' +
      '   URL: ' + APPS_SCRIPT_URL + '\n' +
      '   Status: Ready to use (will bypass CSV proxy)'
    );
  }
} else {
  const isProduction = import.meta.env.PROD;
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  
  if (isProduction || isVercel) {
    console.error(
      '❌ Apps Script URL NOT configured in Vercel!\n' +
      'App will fall back to slower CSV proxy method.\n\n' +
      'TO FIX:\n' +
      '1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n' +
      '2. Add: VITE_APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec\n' +
      '3. Select all environments (Production, Preview, Development)\n' +
      '4. Save and REDEPLOY your project!\n'
    );
  } else {
    console.info(
      'ℹ️ Apps Script URL not configured locally. App will use CSV fallback.\n' +
      'To enable locally: Create .env.local file with:\n' +
      '  VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec\n'
    );
  }
}

// Fallback: Use CORS proxy if Apps Script URL is not configured
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

// Request timeout in milliseconds (30 seconds)
const FETCH_TIMEOUT = 30000;

// Type for row data (compatible with both CSV and JSON)
// Values can be string, number, or undefined
type DataRow = Record<string, string | number | undefined>;

/**
 * Validates CSV text to ensure it's not HTML or empty
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
 * Progress callback type for tracking fetch progress
 */
export type ProgressCallback = (progress: {
  stage: 'fetch' | 'parse' | 'transform' | 'complete';
  percentage: number;
  message?: string;
  rowsProcessed?: number;
  totalRows?: number;
}) => void;

/**
 * Convert 2D array from Apps Script to object array format
 * Apps Script returns: [["Header1", "Header2"], ["Value1", "Value2"], ...]
 * Converts to: [{"Header1": "Value1", "Header2": "Value2"}, ...]
 */
function convert2DArrayToObjects(data: any[][]): DataRow[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const headers = data[0].map((h: any) => String(h).trim());
  const rows: DataRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const row: DataRow = {};
    const values = data[i];
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];
      // Convert empty strings, null, undefined to empty string
      row[header] = value === null || value === undefined || value === '' ? '' : value;
    }
    
    rows.push(row);
  }

  return rows;
}

/**
 * Create a mock Papa.ParseResult-like object for compatibility with existing transformers
 */
function createMockParseResult(data: DataRow[]): { data: DataRow[]; meta: { fields: string[] | null } } {
  const fields = data.length > 0 ? Object.keys(data[0]) : null;
  return {
    data,
    meta: { fields },
  };
}

/**
 * Generic function to fetch JSON data from Apps Script API
 * @param sheetName Name of the sheet to fetch (e.g., "DashBoard", "SMA")
 * @param dataTypeName Name of the data type for error messages (e.g., "Benjamin Graham")
 * @param transformer Function to transform data rows into the target data type
 * @param requiredColumns Optional list of required column names for error messages
 * @param cacheKey Optional cache key for caching
 * @param forceRefresh If true, bypasses cache and forces network request
 * @param ttl Optional TTL in milliseconds for cache (default: DEFAULT_TTL)
 * @param progressCallback Optional callback for progress updates
 */
async function fetchJSONData<T>(
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
      console.log(`Using cached ${dataTypeName} data`);
      progressCallback?.({
        stage: 'complete',
        percentage: 100,
        message: 'Using cached data',
      });
      return cachedData;
    }
  }

  // If Apps Script URL is not configured, fall back to CSV
  if (!APPS_SCRIPT_URL) {
    const isProduction = import.meta.env.PROD;
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    
    if (isProduction || isVercel) {
      console.error(
        `❌ Apps Script URL NOT configured in Vercel for ${dataTypeName}!\n` +
        `App will fall back to slower CSV proxy method.\n\n` +
        `TO FIX:\n` +
        `1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n` +
        `2. Add: VITE_APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec\n` +
        `3. Select all environments (Production, Preview, Development)\n` +
        `4. Save and REDEPLOY your project!\n`
      );
    } else {
      console.warn(
        `⚠️ Apps Script URL not configured locally for ${dataTypeName}, falling back to CSV.\n` +
        `To enable locally: Create .env.local file in project root with:\n` +
        `  VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec\n` +
        `Then restart dev server: npm run dev\n`
      );
    }
    // This will be handled by the calling function
    throw new Error('Apps Script URL not configured');
  }

  // Validate Apps Script URL format
  if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
    console.error('Invalid Apps Script URL format. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec');
    console.error('Current URL:', APPS_SCRIPT_URL);
    throw new Error('Invalid Apps Script URL format. Please check VITE_APPS_SCRIPT_URL environment variable.');
  }

  // Report fetch start
  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data from Apps Script...`,
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
    } catch (fetchError) {
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

    const jsonData = await response.json();

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
      console.log(`${dataTypeName} JSON Headers:`, fields);
      console.log(`${dataTypeName} First row sample:`, dataRows[0]);
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

    console.log(`Successfully parsed ${transformedData.length} ${dataTypeName} entries from JSON`);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Provide specific guidance based on error type
    let errorGuidance = '';
    if (message.includes('CORS') || message.includes('cross-origin')) {
      errorGuidance = `\n\nTroubleshooting CORS:\n` +
        `1. Go to Apps Script → Deploy → Manage deployments\n` +
        `2. Click edit (pencil icon) on your deployment\n` +
        `3. Verify "Who has access" is set to "Anyone"\n` +
        `4. Save and redeploy\n` +
        `5. Verify URL format: https://script.google.com/macros/s/SCRIPT_ID/exec`;
    } else if (message.includes('404') || message.includes('not found')) {
      errorGuidance = `\n\nTroubleshooting 404:\n` +
        `1. Verify VITE_APPS_SCRIPT_URL in Vercel Environment Variables\n` +
        `2. Test the URL directly in browser: ${APPS_SCRIPT_URL}?sheet=${sheetName}\n` +
        `3. Ensure Apps Script is deployed as "Web app" (not "Library")\n` +
        `4. URL should end with /exec (not /library/...)`;
    } else if (message.includes('Invalid Apps Script URL')) {
      errorGuidance = `\n\nExpected URL format: https://script.google.com/macros/s/SCRIPT_ID/exec\n` +
        `Current URL: ${APPS_SCRIPT_URL || '(not set)'}`;
    }
    
    throw new Error(
      `Failed to fetch ${dataTypeName} data from Apps Script: ${message}. ` +
      `Please check your Apps Script URL configuration and ensure the sheet "${sheetName}" exists.${errorGuidance}`
    );
  }
}

/**
 * Generic function to fetch and parse CSV data from Google Sheets
 * @param csvUrl The Google Sheets CSV export URL
 * @param dataTypeName Name of the data type for error messages (e.g., "Benjamin Graham")
 * @param transformer Function to transform parsed CSV rows into the target data type
 * @param requiredColumns Optional list of required column names for error messages
 * @param cacheKey Optional cache key for caching. If provided, checks cache before network request
 * @param forceRefresh If true, bypasses cache and forces network request
 * @param ttl Optional TTL in milliseconds for cache (default: DEFAULT_TTL)
 * @param progressCallback Optional callback for progress updates
 */
async function fetchCSVData<T>(
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
      console.log(`Using cached ${dataTypeName} data`);
      progressCallback?.({
        stage: 'complete',
        percentage: 100,
        message: 'Using cached data',
      });
      return cachedData;
    }
  }

  // Report fetch start
  progressCallback?.({
    stage: 'fetch',
    percentage: 0,
    message: `Fetching ${dataTypeName} data...`,
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
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Check if it was aborted (timeout)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timeout');
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
      
      // Success! Log which proxy worked (only in development)
      if (import.meta.env.DEV && proxyErrors.length > 0) {
        console.log(
          `✅ ${dataTypeName}: Successfully fetched via ${proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')} ` +
          `(after ${proxyErrors.length} failed attempt${proxyErrors.length > 1 ? 's' : ''})`
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
                console.log(`${dataTypeName} CSV Headers:`, results.meta.fields);
                console.log(`${dataTypeName} First row sample:`, results.data[0]);
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
                console.error(`${dataTypeName} CSV parsing result:`, {
                  totalRows: results.data.length,
                  headers: results.meta.fields,
                  firstRow: results.data[0],
                  csvPreview: csvText.substring(0, 500),
                });
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
              
              console.log(`Successfully parsed ${transformedData.length} ${dataTypeName} entries from CSV`);
              
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
            } catch (error) {
              reject(new Error(`Failed to parse ${dataTypeName} CSV data: ${error}`));
            }
          },
          error: (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            reject(new Error(`${dataTypeName} CSV parsing error: ${message}`));
          },
        });
      });
    } catch (error) {
      // Save error and try next proxy
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Categorize the error
      const isCorsError = errorMessage.includes('CORS') || 
                         errorMessage.includes('cross-origin') ||
                         errorMessage.includes('Access-Control-Allow-Origin');
      const isTimeoutError = errorMessage.includes('timeout') || 
                            errorMessage.includes('408') ||
                            errorMessage.includes('Request timeout');
      const isNetworkError = errorMessage.includes('Failed to fetch') ||
                            errorMessage.includes('network');
      
      // Store error info (only log if all proxies fail)
      proxyErrors.push({ 
        proxy, 
        error: isCorsError ? 'CORS blocked' : 
               isTimeoutError ? 'Request timeout' :
               isNetworkError ? 'Network error' :
               errorMessage.substring(0, 50)
      });
      
      // Only log detailed error if this is the last proxy attempt
      if (i === CORS_PROXIES.length - 1) {
        console.warn(
          `${dataTypeName}: All proxy attempts failed. Errors:`,
          proxyErrors.map(e => `${e.proxy.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}: ${e.error}`).join(', ')
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

// Benjamin Graham data configuration
const BENJAMIN_GRAHAM_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const BENJAMIN_GRAHAM_GID = '1180885830';
const BENJAMIN_GRAHAM_CSV_URL = `https://docs.google.com/spreadsheets/d/${BENJAMIN_GRAHAM_SHEET_ID}/export?format=csv&gid=${BENJAMIN_GRAHAM_GID}`;

// Helper function to get value from row with case-insensitive matching
function getValue(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return String(row[name]).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName && row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).trim();
      }
    }
  }
  return '';
}

// Helper function to validate values (filter out #N/A, etc.)
function isValidValue(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized !== '#N/A' && normalized !== 'N/A' && normalized !== '#NUM!' && normalized !== '#VALUE!' && normalized !== '#DIV/0!' && normalized !== '#REF!';
}

// Helper function to parse numeric values that can distinguish between invalid (null) and actual zero (0)
function parseNumericValueNullable(valueStr: string): number | null {
  if (!isValidValue(valueStr)) return null;
  
  // Remove common prefixes and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

// Helper function to get value from row with case-insensitive matching (allows 0 values)
function getValueAllowZero(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined && row[name] !== null) {
      const value = row[name];
      // Om värdet är 0 (nummer eller sträng "0"), returnera "0"
      if (value === 0 || value === '0') {
        return '0';
      }
      // Om värdet är en tom sträng, hoppa över
      if (value === '') {
        continue;
      }
      return String(value).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const value = row[key];
        // Tillåt 0 som ett giltigt värde
        if (value !== undefined && value !== null) {
          // Om värdet är 0 (nummer eller sträng "0"), returnera "0"
          if (value === 0 || value === '0') {
            return '0';
          }
          // Om värdet är en tom sträng, hoppa över
          if (value === '') {
            continue;
          }
          return String(value).trim();
        }
      }
    }
  }
  return '';
}

// Helper function to parse percentage values that can distinguish between invalid (null) and actual zero (0)
function parsePercentageValueNullable(valueStr: string): number | null {
  if (!isValidValue(valueStr)) return null;
  
  // Remove % sign and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

export async function fetchBenjaminGrahamData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<BenjaminGrahamData[]> {
  // Try Apps Script first, fallback to CSV
  try {
    return await fetchJSONData<BenjaminGrahamData>(
      'DashBoard',
      'Benjamin Graham',
    (results) => {
      const benjaminGrahamData = results.data
        .map((row: DataRow) => {
          const companyName = getValue(['Company Name', 'Company', 'company'], row);
          const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
          const priceStr = getValue(['Price', 'price', 'PRICE'], row);
          const benjaminGrahamStr = getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row);
          
          // Only process if company name is valid (not #N/A)
          if (!isValidValue(companyName)) {
            return null;
          }
          
          // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
          if (!isValidValue(ticker)) {
            return null;
          }
          
          // Parse Price value as number (handle #N/A)
          const price = parseNumericValueNullable(priceStr);
          
          // Parse Benjamin Graham value as number (handle #N/A)
          const benjaminGraham = parseNumericValueNullable(benjaminGrahamStr);
          
          // Parse IV (FCF) if it exists
          const ivFcfStr = getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row);
          const ivFcf = parseNumericValueNullable(ivFcfStr);
          
          // Parse IRR1 if it exists
          const irr1Str = getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row);
          const irr1 = parseNumericValueNullable(irr1Str);
          
          // Include row if both company name and ticker are valid (we already checked above)
          return {
            companyName: companyName,
            ticker: ticker,
            price: price,
            benjaminGraham: benjaminGraham,
            ivFcf: ivFcf, // Include if it exists
            irr1: irr1, // Include if it exists
          };
        })
        .filter((data) => data !== null) as BenjaminGrahamData[];
      
      return benjaminGrahamData;
    },
      ['Benjamin Graham', 'Company Name', 'Ticker'],
      CACHE_KEYS.BENJAMIN_GRAHAM,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  } catch (error) {
    // Fallback to CSV if Apps Script fails
    console.warn('Apps Script fetch failed, falling back to CSV:', error);
    return fetchCSVData<BenjaminGrahamData>(
      BENJAMIN_GRAHAM_CSV_URL,
      'Benjamin Graham',
      (results) => {
        const benjaminGrahamData = results.data
          .map((row: DataRow) => {
            const companyName = getValue(['Company Name', 'Company', 'company'], row);
            const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
            const priceStr = getValue(['Price', 'price', 'PRICE'], row);
            const benjaminGrahamStr = getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row);
            
            // Only process if company name is valid (not #N/A)
            if (!isValidValue(companyName)) {
              return null;
            }
            
            // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
            if (!isValidValue(ticker)) {
              return null;
            }
            
            // Parse Price value as number (handle #N/A)
            const price = parseNumericValueNullable(priceStr);
            
            // Parse Benjamin Graham value as number (handle #N/A)
            const benjaminGraham = parseNumericValueNullable(benjaminGrahamStr);
            
            // Parse IV (FCF) if it exists
            const ivFcfStr = getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row);
            const ivFcf = parseNumericValueNullable(ivFcfStr);
            
            // Parse IRR1 if it exists
            const irr1Str = getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row);
            const irr1 = parseNumericValueNullable(irr1Str);
            
            // Include row if both company name and ticker are valid (we already checked above)
            return {
              companyName: companyName,
              ticker: ticker,
              price: price,
              benjaminGraham: benjaminGraham,
              ivFcf: ivFcf, // Include if it exists
              irr1: irr1, // Include if it exists
            };
          })
          .filter((data) => data !== null) as BenjaminGrahamData[];
        
        return benjaminGrahamData;
      },
      ['Benjamin Graham', 'Company Name', 'Ticker'],
      CACHE_KEYS.BENJAMIN_GRAHAM,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  }
}

// SMA data configuration (uses same Dashboard sheet as Benjamin Graham)
const SMA_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const SMA_GID = '1413104083';
const SMA_CSV_URL = `https://docs.google.com/spreadsheets/d/${SMA_SHEET_ID}/export?format=csv&gid=${SMA_GID}`;

export async function fetchSMAData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<SMAData[]> {
  // Try Apps Script first, fallback to CSV
  try {
    return await fetchJSONData<SMAData>(
      'SMA',
      'SMA',
    (results) => {
      const smaData: SMAData[] = results.data
        .map((row: DataRow) => {
          const companyName = getValue(['Company Name', 'Company', 'company'], row);
          const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
          const sma100Str = getValue(['SMA(100)', 'SMA(100)', 'sma(100)', 'sma100', 'SMA100'], row);
          const sma200Str = getValue(['SMA(200)', 'SMA(200)', 'sma(200)', 'sma200', 'SMA200'], row);
          const smaCrossStr = getValue(['SMA Cross', 'SMA Cross', 'sma cross', 'smaCross', 'SMACross', 'SMA CROSS'], row);
          
          // Only process if company name is valid (not #N/A)
          if (!isValidValue(companyName)) {
            return null;
          }
          
          // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
          if (!isValidValue(ticker)) {
            return null;
          }
          
          // Parse SMA(100) value as number (handle #N/A)
          const sma100 = parseNumericValueNullable(sma100Str);
          
          // Parse SMA(200) value as number (handle #N/A)
          const sma200 = parseNumericValueNullable(sma200Str);
          
          // Extract SMA Cross value as text (handle #N/A and empty values)
          let smaCross: string | null = null;
          if (smaCrossStr && smaCrossStr.trim()) {
            const trimmed = smaCrossStr.trim();
            // Convert #N/A to null, otherwise use the value
            if (trimmed.toUpperCase() !== '#N/A' && trimmed.toUpperCase() !== 'N/A' && trimmed !== '') {
              smaCross = trimmed;
            }
          }
          
          return {
            companyName: companyName,
            ticker: ticker,
            sma100: sma100,
            sma200: sma200,
            smaCross: smaCross,
          };
        })
        .filter((data: SMAData | null): data is SMAData => data !== null);
      
      return smaData;
    },
      ['Company Name', 'Ticker', 'SMA(100)', 'SMA(200)', 'SMA Cross'],
      CACHE_KEYS.SMA,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  } catch (error) {
    // Fallback to CSV if Apps Script fails
    console.warn('Apps Script fetch failed, falling back to CSV:', error);
    return fetchCSVData<SMAData>(
      SMA_CSV_URL,
      'SMA',
      (results) => {
        const smaData: SMAData[] = results.data
          .map((row: DataRow) => {
            const companyName = getValue(['Company Name', 'Company', 'company'], row);
            const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
            const sma100Str = getValue(['SMA(100)', 'SMA(100)', 'sma(100)', 'sma100', 'SMA100'], row);
            const sma200Str = getValue(['SMA(200)', 'SMA(200)', 'sma(200)', 'sma200', 'SMA200'], row);
            const smaCrossStr = getValue(['SMA Cross', 'SMA Cross', 'sma cross', 'smaCross', 'SMACross', 'SMA CROSS'], row);
            
            // Only process if company name is valid (not #N/A)
            if (!isValidValue(companyName)) {
              return null;
            }
            
            // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
            if (!isValidValue(ticker)) {
              return null;
            }
            
            // Parse SMA(100) value as number (handle #N/A)
            const sma100 = parseNumericValueNullable(sma100Str);
            
            // Parse SMA(200) value as number (handle #N/A)
            const sma200 = parseNumericValueNullable(sma200Str);
            
            // Extract SMA Cross value as text (handle #N/A and empty values)
            let smaCross: string | null = null;
            if (smaCrossStr && smaCrossStr.trim()) {
              const trimmed = smaCrossStr.trim();
              // Convert #N/A to null, otherwise use the value
              if (trimmed.toUpperCase() !== '#N/A' && trimmed.toUpperCase() !== 'N/A' && trimmed !== '') {
                smaCross = trimmed;
              }
            }
            
            return {
              companyName: companyName,
              ticker: ticker,
              sma100: sma100,
              sma200: sma200,
              smaCross: smaCross,
            };
          })
          .filter((data: SMAData | null): data is SMAData => data !== null);
        
        return smaData;
      },
      ['Company Name', 'Ticker', 'SMA(100)', 'SMA(200)', 'SMA Cross'],
      CACHE_KEYS.SMA,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  }
}

// P/E Industry data configuration
const PE_INDUSTRY_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const PE_INDUSTRY_GID = '1180885830';
const PE_INDUSTRY_CSV_URL = `https://docs.google.com/spreadsheets/d/${PE_INDUSTRY_SHEET_ID}/export?format=csv&gid=${PE_INDUSTRY_GID}`;

// Helper function to calculate median
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

export async function fetchPEIndustryData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<PEIndustryData[]> {
  // Try Apps Script first, fallback to CSV
  try {
    return await fetchJSONData<PEIndustryData>(
      'DashBoard',
      'P/E Industry',
    (results) => {
      // Group data by industry
      const industryMap = new Map<string, { pe: number[], pe1: number[], pe2: number[], count: number }>();

      results.data.forEach((row: DataRow) => {
        const companyName = getValue(['Company Name', 'Company', 'company'], row);
        const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
        const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
        
        // Filter out rows where Company Name, Ticker, or Industry is N/A
        if (!isValidValue(companyName) || !isValidValue(ticker) || !isValidValue(industry)) {
          return;
        }

        const peStr = getValue(['P/E', 'P/E', 'pe', 'PE'], row);
        const pe1Str = getValue(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
        const pe2Str = getValue(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);

        if (!industryMap.has(industry)) {
          industryMap.set(industry, { pe: [], pe1: [], pe2: [], count: 0 });
        }

        const industryData = industryMap.get(industry)!;
        industryData.count++;

        const pe = parseNumericValueNullable(peStr);
        const pe1 = parseNumericValueNullable(pe1Str);
        const pe2 = parseNumericValueNullable(pe2Str);

        // Include 0 values (actual zeros) but exclude null (invalid/missing)
        if (pe !== null) {
          industryData.pe.push(pe);
        }
        if (pe1 !== null) {
          industryData.pe1.push(pe1);
        }
        if (pe2 !== null) {
          industryData.pe2.push(pe2);
        }
      });

      // Convert to PEIndustryData array
      const peIndustryData: PEIndustryData[] = Array.from(industryMap.entries())
        .map(([industry, data]) => ({
          industry: industry,
          pe: calculateMedian(data.pe),
          pe1: calculateMedian(data.pe1),
          pe2: calculateMedian(data.pe2),
          companyCount: data.count,
        }))
        .filter(item => item.companyCount > 0); // Only include industries with at least one company
      
      return peIndustryData;
    },
      ['INDUSTRY', 'P/E', 'P/E1', 'P/E2', 'Company Name', 'Ticker'],
      CACHE_KEYS.PE_INDUSTRY,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  } catch (error) {
    // Fallback to CSV if Apps Script fails
    console.warn('Apps Script fetch failed, falling back to CSV:', error);
    return fetchCSVData<PEIndustryData>(
      PE_INDUSTRY_CSV_URL,
      'P/E Industry',
      (results) => {
        // Group data by industry
        const industryMap = new Map<string, { pe: number[], pe1: number[], pe2: number[], count: number }>();

        results.data.forEach((row: DataRow) => {
          const companyName = getValue(['Company Name', 'Company', 'company'], row);
          const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
          const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
          
          // Filter out rows where Company Name, Ticker, or Industry is N/A
          if (!isValidValue(companyName) || !isValidValue(ticker) || !isValidValue(industry)) {
            return;
          }

          const peStr = getValue(['P/E', 'P/E', 'pe', 'PE'], row);
          const pe1Str = getValue(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
          const pe2Str = getValue(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);

          if (!industryMap.has(industry)) {
            industryMap.set(industry, { pe: [], pe1: [], pe2: [], count: 0 });
          }

          const industryData = industryMap.get(industry)!;
          industryData.count++;

          const pe = parseNumericValueNullable(peStr);
          const pe1 = parseNumericValueNullable(pe1Str);
          const pe2 = parseNumericValueNullable(pe2Str);

          // Include 0 values (actual zeros) but exclude null (invalid/missing)
          if (pe !== null) {
            industryData.pe.push(pe);
          }
          if (pe1 !== null) {
            industryData.pe1.push(pe1);
          }
          if (pe2 !== null) {
            industryData.pe2.push(pe2);
          }
        });

        // Convert to PEIndustryData array
        const peIndustryData: PEIndustryData[] = Array.from(industryMap.entries())
          .map(([industry, data]) => ({
            industry: industry,
            pe: calculateMedian(data.pe),
            pe1: calculateMedian(data.pe1),
            pe2: calculateMedian(data.pe2),
            companyCount: data.count,
          }))
          .filter(item => item.companyCount > 0); // Only include industries with at least one company
        
        return peIndustryData;
      },
      ['INDUSTRY', 'P/E', 'P/E1', 'P/E2', 'Company Name', 'Ticker'],
      CACHE_KEYS.PE_INDUSTRY,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  }
}

// Score Board data configuration (uses same Dashboard sheet as P/E Industry)
const SCORE_BOARD_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const SCORE_BOARD_GID = '1180885830';
const SCORE_BOARD_CSV_URL = `https://docs.google.com/spreadsheets/d/${SCORE_BOARD_SHEET_ID}/export?format=csv&gid=${SCORE_BOARD_GID}`;

export async function fetchScoreBoardData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<ScoreBoardData[]> {
  // First, fetch PEIndustryData to get industry medians
  let peIndustryData: PEIndustryData[] = [];
  try {
    peIndustryData = await fetchPEIndustryData(forceRefresh);
  } catch (peError) {
    console.warn('Failed to fetch PE Industry data for P/E1 INDUSTRY calculation:', peError);
  }

  // Create maps for quick lookup: industry -> pe1 and pe2 (median)
  const industryPe1Map = new Map<string, number>();
  const industryPe2Map = new Map<string, number>();
  peIndustryData.forEach((peIndustry) => {
    if (peIndustry.pe1 !== null) {
      industryPe1Map.set(peIndustry.industry.toLowerCase(), peIndustry.pe1);
    }
    if (peIndustry.pe2 !== null) {
      industryPe2Map.set(peIndustry.industry.toLowerCase(), peIndustry.pe2);
    }
  });

  // Try Apps Script first, fallback to CSV
  try {
    return await fetchJSONData<ScoreBoardData>(
      'DashBoard',
      'Score Board',
      (results: { data: DataRow[]; meta: { fields: string[] | null } }) => {
      const scoreBoardData = results.data
        .map((row: DataRow) => {
          const companyName = getValueAllowZero(['Company Name', 'Company', 'company'], row);
          const ticker = getValueAllowZero(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
          const irrStr = getValueAllowZero(['IRR', 'irr', 'Irr'], row);
          const mungerQualityScoreStr = getValueAllowZero(['Munger Quality Score', 'Munger Quality Score', 'munger quality score', 'MUNGER QUALITY SCORE'], row);
          const valueCreationStr = getValueAllowZero(['VALUE CREATION', 'Value Creation', 'value creation', 'VALUE_CREATION'], row);
          const ro40CyStr = getValueAllowZero(['Ro40 CY', 'Ro40 CY', 'ro40 cy', 'RO40 CY'], row);
          const ro40F1Str = getValueAllowZero(['Ro40 F1', 'Ro40 F1', 'ro40 f1', 'RO40 F1'], row);
          const ro40F2Str = getValueAllowZero(['Ro40 F2', 'Ro40 F2', 'ro40 f2', 'RO40 F2'], row);
          const leverageF2Str = getValueAllowZero(['Leverage F2', 'Leverage F2', 'leverage f2', 'LEVERAGE F2'], row);
          const currentRatioStr = getValueAllowZero(['Current Ratio', 'Current Ratio', 'current ratio', 'CURRENT RATIO'], row);
          const cashSdebtStr = getValueAllowZero(['Cash/SDebt', 'Cash/SDebt', 'cash/sdebt', 'CASH/SDEBT'], row);
          
          // Detect division-by-zero for Cash/SDebt (should be treated as green)
          const isCashSdebtDivZero = cashSdebtStr && 
            (cashSdebtStr.trim().toUpperCase() === '#DIV/0!' || 
             cashSdebtStr.trim().toUpperCase() === 'INF' ||
             cashSdebtStr.trim().toUpperCase() === '∞');
          
          // Get TB/Share and Price for (TB/S)/Price calculation
          const tbShareStr = getValueAllowZero(['TB/Share', 'TB/Share', 'tb/share', 'TB/SHARE'], row);
          const priceStr = getValueAllowZero(['Price', 'price', 'PRICE'], row);
          
          const pe1Str = getValueAllowZero(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
          const pe2Str = getValueAllowZero(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);
          const industryStr = getValueAllowZero(['INDUSTRY', 'Industry', 'industry'], row);
          
          // Filter out rows where Company Name or Ticker is N/A (same rule as Benjamin Graham)
          if (!isValidValue(companyName) || !isValidValue(ticker)) {
            return null;
          }

          const irr = parseNumericValueNullable(irrStr);
          const mungerQualityScore = parseNumericValueNullable(mungerQualityScoreStr);
          const valueCreation = parsePercentageValueNullable(valueCreationStr);
          const ro40Cy = parsePercentageValueNullable(ro40CyStr);
          const ro40F1 = parsePercentageValueNullable(ro40F1Str);
          const ro40F2 = parsePercentageValueNullable(ro40F2Str);
          const leverageF2 = parseNumericValueNullable(leverageF2Str);
          const currentRatio = parseNumericValueNullable(currentRatioStr);
          const cashSdebt = parseNumericValueNullable(cashSdebtStr);
          
          // Calculate (TB/Share) / Price
          const tbShare = parseNumericValueNullable(tbShareStr);
          const price = parseNumericValueNullable(priceStr);
          let tbSPrice: number | null = null;
          if (tbShare !== null && price !== null && price !== 0 && isFinite(price) && isFinite(tbShare)) {
            tbSPrice = tbShare / price;
          }
          
          // Calculate P/E1 INDUSTRY (procentuell skillnad)
          const pe1 = parseNumericValueNullable(pe1Str);
          let pe1Industry: number | null = null;
          
          if (isValidValue(industryStr) && pe1 !== null && pe1 > 0) {
            const industryKey = industryStr.trim().toLowerCase();
            const pe1IndustryMedian = industryPe1Map.get(industryKey);
            
            if (pe1IndustryMedian !== undefined && pe1IndustryMedian > 0) {
              // Calculate percentage difference: (pe1 - pe1IndustryMedian) / pe1IndustryMedian * 100
              pe1Industry = ((pe1 - pe1IndustryMedian) / pe1IndustryMedian) * 100;
            }
          }
          
          // Calculate P/E2 INDUSTRY (procentuell skillnad)
          const pe2 = parseNumericValueNullable(pe2Str);
          let pe2Industry: number | null = null;
          
          if (isValidValue(industryStr) && pe2 !== null && pe2 > 0) {
            const industryKey = industryStr.trim().toLowerCase();
            const pe2IndustryMedian = industryPe2Map.get(industryKey);
            
            if (pe2IndustryMedian !== undefined && pe2IndustryMedian > 0) {
              // Calculate percentage difference: (pe2 - pe2IndustryMedian) / pe2IndustryMedian * 100
              pe2Industry = ((pe2 - pe2IndustryMedian) / pe2IndustryMedian) * 100;
            }
          }

          return {
            companyName: companyName,
            ticker: ticker,
            industry: industryStr || '',
            irr: irr,
            mungerQualityScore: mungerQualityScore,
            valueCreation: valueCreation,
            tbSPrice: tbSPrice,
            ro40Cy: ro40Cy,
            ro40F1: ro40F1,
            ro40F2: ro40F2,
            leverageF2: leverageF2,
            pe1Industry: pe1Industry,
            pe2Industry: pe2Industry,
            currentRatio: currentRatio,
            cashSdebt: cashSdebt,
            isCashSdebtDivZero: isCashSdebtDivZero || false,
            sma100: null, // Will be populated later from SMA data
            sma200: null, // Will be populated later from SMA data
            smaCross: null, // Will be populated later from SMA data
          };
        })
        .filter((data) => data !== null) as ScoreBoardData[];
      
        return scoreBoardData;
      },
      ['Company Name', 'Ticker', 'IRR', 'Munger Quality Score', 'VALUE CREATION'],
      CACHE_KEYS.SCORE_BOARD,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  } catch (error) {
    // Fallback to CSV if Apps Script fails
    console.warn('Apps Script fetch failed, falling back to CSV:', error);
    return fetchCSVData<ScoreBoardData>(
      SCORE_BOARD_CSV_URL,
      'Score Board',
      (results): ScoreBoardData[] => {
        const scoreBoardData = results.data
          .map((row: DataRow) => {
            const companyName = getValueAllowZero(['Company Name', 'Company', 'company'], row);
            const ticker = getValueAllowZero(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
            const irrStr = getValueAllowZero(['IRR', 'irr', 'Irr'], row);
            const mungerQualityScoreStr = getValueAllowZero(['Munger Quality Score', 'Munger Quality Score', 'munger quality score', 'MUNGER QUALITY SCORE'], row);
            const valueCreationStr = getValueAllowZero(['VALUE CREATION', 'Value Creation', 'value creation', 'VALUE_CREATION'], row);
            const ro40CyStr = getValueAllowZero(['Ro40 CY', 'Ro40 CY', 'ro40 cy', 'RO40 CY'], row);
            const ro40F1Str = getValueAllowZero(['Ro40 F1', 'Ro40 F1', 'ro40 f1', 'RO40 F1'], row);
            const ro40F2Str = getValueAllowZero(['Ro40 F2', 'Ro40 F2', 'ro40 f2', 'RO40 F2'], row);
            const leverageF2Str = getValueAllowZero(['Leverage F2', 'Leverage F2', 'leverage f2', 'LEVERAGE F2'], row);
            const currentRatioStr = getValueAllowZero(['Current Ratio', 'Current Ratio', 'current ratio', 'CURRENT RATIO'], row);
            const cashSdebtStr = getValueAllowZero(['Cash/SDebt', 'Cash/SDebt', 'cash/sdebt', 'CASH/SDEBT'], row);
            
            // Detect division-by-zero for Cash/SDebt (should be treated as green)
            const isCashSdebtDivZero = cashSdebtStr && 
              (cashSdebtStr.trim().toUpperCase() === '#DIV/0!' || 
               cashSdebtStr.trim().toUpperCase() === 'INF' ||
               cashSdebtStr.trim().toUpperCase() === '∞');
            
            // Get TB/Share and Price for (TB/S)/Price calculation
            const tbShareStr = getValueAllowZero(['TB/Share', 'TB/Share', 'tb/share', 'TB/SHARE'], row);
            const priceStr = getValueAllowZero(['Price', 'price', 'PRICE'], row);
            
            const pe1Str = getValueAllowZero(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
            const pe2Str = getValueAllowZero(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);
            const industryStr = getValueAllowZero(['INDUSTRY', 'Industry', 'industry'], row);
            
            // Filter out rows where Company Name or Ticker is N/A (same rule as Benjamin Graham)
            if (!isValidValue(companyName) || !isValidValue(ticker)) {
              return null;
            }

            const irr = parseNumericValueNullable(irrStr);
            const mungerQualityScore = parseNumericValueNullable(mungerQualityScoreStr);
            const valueCreation = parsePercentageValueNullable(valueCreationStr);
            const ro40Cy = parsePercentageValueNullable(ro40CyStr);
            const ro40F1 = parsePercentageValueNullable(ro40F1Str);
            const ro40F2 = parsePercentageValueNullable(ro40F2Str);
            const leverageF2 = parseNumericValueNullable(leverageF2Str);
            const currentRatio = parseNumericValueNullable(currentRatioStr);
            const cashSdebt = parseNumericValueNullable(cashSdebtStr);
            
            // Calculate (TB/Share) / Price
            const tbShare = parseNumericValueNullable(tbShareStr);
            const price = parseNumericValueNullable(priceStr);
            let tbSPrice: number | null = null;
            if (tbShare !== null && price !== null && price !== 0 && isFinite(price) && isFinite(tbShare)) {
              tbSPrice = tbShare / price;
            }
            
            // Calculate P/E1 INDUSTRY (procentuell skillnad)
            const pe1 = parseNumericValueNullable(pe1Str);
            let pe1Industry: number | null = null;
            
            if (isValidValue(industryStr) && pe1 !== null && pe1 > 0) {
              const industryKey = industryStr.trim().toLowerCase();
              const pe1IndustryMedian = industryPe1Map.get(industryKey);
              
              if (pe1IndustryMedian !== undefined && pe1IndustryMedian > 0) {
                // Calculate percentage difference: (pe1 - pe1IndustryMedian) / pe1IndustryMedian * 100
                pe1Industry = ((pe1 - pe1IndustryMedian) / pe1IndustryMedian) * 100;
              }
            }
            
            // Calculate P/E2 INDUSTRY (procentuell skillnad)
            const pe2 = parseNumericValueNullable(pe2Str);
            let pe2Industry: number | null = null;
            
            if (isValidValue(industryStr) && pe2 !== null && pe2 > 0) {
              const industryKey = industryStr.trim().toLowerCase();
              const pe2IndustryMedian = industryPe2Map.get(industryKey);
              
              if (pe2IndustryMedian !== undefined && pe2IndustryMedian > 0) {
                // Calculate percentage difference: (pe2 - pe2IndustryMedian) / pe2IndustryMedian * 100
                pe2Industry = ((pe2 - pe2IndustryMedian) / pe2IndustryMedian) * 100;
              }
            }

            return {
              companyName: companyName,
              ticker: ticker,
              industry: industryStr || '',
              irr: irr,
              mungerQualityScore: mungerQualityScore,
              valueCreation: valueCreation,
              tbSPrice: tbSPrice,
              ro40Cy: ro40Cy,
              ro40F1: ro40F1,
              ro40F2: ro40F2,
              leverageF2: leverageF2,
              pe1Industry: pe1Industry,
              pe2Industry: pe2Industry,
              currentRatio: currentRatio,
              cashSdebt: cashSdebt,
              isCashSdebtDivZero: isCashSdebtDivZero || false,
              sma100: null, // Will be populated later from SMA data
              sma200: null, // Will be populated later from SMA data
              smaCross: null, // Will be populated later from SMA data
            };
          })
          .filter((data) => data !== null) as ScoreBoardData[];
        
        return scoreBoardData;
      },
      ['Company Name', 'Ticker', 'IRR', 'Munger Quality Score', 'VALUE CREATION'],
      CACHE_KEYS.SCORE_BOARD,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    ) as Promise<ScoreBoardData[]>;
  }
}

// Threshold Industry data configuration (uses same Dashboard sheet as P/E Industry)
const THRESHOLD_INDUSTRY_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const THRESHOLD_INDUSTRY_GID = '1180885830';
const THRESHOLD_INDUSTRY_CSV_URL = `https://docs.google.com/spreadsheets/d/${THRESHOLD_INDUSTRY_SHEET_ID}/export?format=csv&gid=${THRESHOLD_INDUSTRY_GID}`;

// Helper functions for Threshold Industry data mapping
function findIRRForIndustry(industryName: string): number {
  const trimmed = industryName.trim();
  
  // Try exact match first
  if (INDUSTRY_IRR_MAP[trimmed] !== undefined) {
    return INDUSTRY_IRR_MAP[trimmed];
  }
  
  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(INDUSTRY_IRR_MAP)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }
  
  return 0; // Not found
}

function findLeverageF2ForIndustry(industryName: string): { min: number; max: number } {
  const trimmed = industryName.trim();
  
  // Try exact match first
  if (INDUSTRY_LEVERAGE_F2_MAP[trimmed] !== undefined) {
    const { greenMax, redMin } = INDUSTRY_LEVERAGE_F2_MAP[trimmed];
    return { min: greenMax, max: redMin };
  }
  
  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(INDUSTRY_LEVERAGE_F2_MAP)) {
    if (key.toLowerCase() === lowerTrimmed) {
      const { greenMax, redMin } = value;
      return { min: greenMax, max: redMin };
    }
  }
  
  return { min: 0, max: 0 }; // Not found
}

function findRO40ForIndustry(industryName: string): { min: number; max: number } {
  const trimmed = industryName.trim();
  
  // Try exact match first
  if (INDUSTRY_RO40_MAP[trimmed] !== undefined) {
    return INDUSTRY_RO40_MAP[trimmed];
  }
  
  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(INDUSTRY_RO40_MAP)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }
  
  return { min: 0, max: 0 }; // Not found
}

function findCashSdebtForIndustry(industryName: string): { min: number; max: number } {
  const trimmed = industryName.trim();
  
  // Try exact match first
  if (INDUSTRY_CASH_SDEBT_MAP[trimmed] !== undefined) {
    return INDUSTRY_CASH_SDEBT_MAP[trimmed];
  }
  
  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(INDUSTRY_CASH_SDEBT_MAP)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }
  
  return { min: 0, max: 0 }; // Not found
}

function findCurrentRatioForIndustry(industryName: string): { min: number; max: number } {
  const trimmed = industryName.trim();
  
  // Try exact match first
  if (INDUSTRY_CURRENT_RATIO_MAP[trimmed] !== undefined) {
    return INDUSTRY_CURRENT_RATIO_MAP[trimmed];
  }
  
  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(INDUSTRY_CURRENT_RATIO_MAP)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }
  
  return { min: 0, max: 0 }; // Not found
}

export async function fetchThresholdIndustryData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<ThresholdIndustryData[]> {
  // Try Apps Script first, fallback to CSV
  try {
    return await fetchJSONData<ThresholdIndustryData>(
      'DashBoard',
      'Threshold Industry',
    (results) => {
      // Extract unique industries
      const industrySet = new Set<string>();

      results.data.forEach((row: DataRow) => {
        const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
        
        // Filter out invalid values
        if (isValidValue(industry)) {
          industrySet.add(industry);
        }
      });

      // Convert Set to sorted array of ThresholdIndustryData
      // Map IRR, Leverage F2, RO40, Cash/SDebt, and Current Ratio values based on industry name
      const notFoundIRRIndustries: string[] = [];
      const notFoundLeverageF2Industries: string[] = [];
      const notFoundRO40Industries: string[] = [];
      const notFoundCashSdebtIndustries: string[] = [];
      const notFoundCurrentRatioIndustries: string[] = [];
      const thresholdIndustryData: ThresholdIndustryData[] = Array.from(industrySet)
        .sort()
        .map((industry) => {
          const irrValue = findIRRForIndustry(industry);
          if (irrValue === 0) {
            notFoundIRRIndustries.push(industry);
          }
          const leverageF2Values = findLeverageF2ForIndustry(industry);
          if (leverageF2Values.min === 0 && leverageF2Values.max === 0) {
            notFoundLeverageF2Industries.push(industry);
          }
          const ro40Values = findRO40ForIndustry(industry);
          if (ro40Values.min === 0 && ro40Values.max === 0) {
            notFoundRO40Industries.push(industry);
          }
          const cashSdebtValues = findCashSdebtForIndustry(industry);
          if (cashSdebtValues.min === 0 && cashSdebtValues.max === 0) {
            notFoundCashSdebtIndustries.push(industry);
          }
          const currentRatioValues = findCurrentRatioForIndustry(industry);
          if (currentRatioValues.min === 0 && currentRatioValues.max === 0) {
            notFoundCurrentRatioIndustries.push(industry);
          }
          return {
            industry: industry,
            irr: irrValue,
            leverageF2Min: leverageF2Values.min,
            leverageF2Max: leverageF2Values.max,
            ro40Min: ro40Values.min,
            ro40Max: ro40Values.max,
            cashSdebtMin: cashSdebtValues.min,
            cashSdebtMax: cashSdebtValues.max,
            currentRatioMin: currentRatioValues.min,
            currentRatioMax: currentRatioValues.max,
          };
        });
      
      // Log industries that were not found in the mappings
      if (notFoundIRRIndustries.length > 0) {
        console.warn('Threshold Industry: Industries not found in IRR mapping:', notFoundIRRIndustries);
      }
      if (notFoundLeverageF2Industries.length > 0) {
        console.warn('Threshold Industry: Industries not found in Leverage F2 mapping:', notFoundLeverageF2Industries);
      }
      if (notFoundRO40Industries.length > 0) {
        console.warn('Threshold Industry: Industries not found in RO40 mapping:', notFoundRO40Industries);
      }
      if (notFoundCashSdebtIndustries.length > 0) {
        console.warn('Threshold Industry: Industries not found in Cash/SDebt mapping:', notFoundCashSdebtIndustries);
      }
      if (notFoundCurrentRatioIndustries.length > 0) {
        console.warn('Threshold Industry: Industries not found in Current Ratio mapping:', notFoundCurrentRatioIndustries);
      }
      
      return thresholdIndustryData;
    },
      ['INDUSTRY'],
      CACHE_KEYS.THRESHOLD_INDUSTRY,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  } catch (error) {
    // Fallback to CSV if Apps Script fails
    console.warn('Apps Script fetch failed, falling back to CSV:', error);
    return fetchCSVData<ThresholdIndustryData>(
      THRESHOLD_INDUSTRY_CSV_URL,
      'Threshold Industry',
      (results) => {
        // Extract unique industries
        const industrySet = new Set<string>();

        results.data.forEach((row: DataRow) => {
          const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
          
          // Filter out invalid values
          if (isValidValue(industry)) {
            industrySet.add(industry);
          }
        });

        // Convert Set to sorted array of ThresholdIndustryData
        // Map IRR, Leverage F2, RO40, Cash/SDebt, and Current Ratio values based on industry name
        const notFoundIRRIndustries: string[] = [];
        const notFoundLeverageF2Industries: string[] = [];
        const notFoundRO40Industries: string[] = [];
        const notFoundCashSdebtIndustries: string[] = [];
        const notFoundCurrentRatioIndustries: string[] = [];
        const thresholdIndustryData: ThresholdIndustryData[] = Array.from(industrySet)
          .sort()
          .map((industry) => {
            const irrValue = findIRRForIndustry(industry);
            if (irrValue === 0) {
              notFoundIRRIndustries.push(industry);
            }
            const leverageF2Values = findLeverageF2ForIndustry(industry);
            if (leverageF2Values.min === 0 && leverageF2Values.max === 0) {
              notFoundLeverageF2Industries.push(industry);
            }
            const ro40Values = findRO40ForIndustry(industry);
            if (ro40Values.min === 0 && ro40Values.max === 0) {
              notFoundRO40Industries.push(industry);
            }
            const cashSdebtValues = findCashSdebtForIndustry(industry);
            if (cashSdebtValues.min === 0 && cashSdebtValues.max === 0) {
              notFoundCashSdebtIndustries.push(industry);
            }
            const currentRatioValues = findCurrentRatioForIndustry(industry);
            if (currentRatioValues.min === 0 && currentRatioValues.max === 0) {
              notFoundCurrentRatioIndustries.push(industry);
            }
            return {
              industry: industry,
              irr: irrValue,
              leverageF2Min: leverageF2Values.min,
              leverageF2Max: leverageF2Values.max,
              ro40Min: ro40Values.min,
              ro40Max: ro40Values.max,
              cashSdebtMin: cashSdebtValues.min,
              cashSdebtMax: cashSdebtValues.max,
              currentRatioMin: currentRatioValues.min,
              currentRatioMax: currentRatioValues.max,
            };
          });
        
        // Log industries that were not found in the mappings
        if (notFoundIRRIndustries.length > 0) {
          console.warn('Threshold Industry: Industries not found in IRR mapping:', notFoundIRRIndustries);
        }
        if (notFoundLeverageF2Industries.length > 0) {
          console.warn('Threshold Industry: Industries not found in Leverage F2 mapping:', notFoundLeverageF2Industries);
        }
        if (notFoundRO40Industries.length > 0) {
          console.warn('Threshold Industry: Industries not found in RO40 mapping:', notFoundRO40Industries);
        }
        if (notFoundCashSdebtIndustries.length > 0) {
          console.warn('Threshold Industry: Industries not found in Cash/SDebt mapping:', notFoundCashSdebtIndustries);
        }
        if (notFoundCurrentRatioIndustries.length > 0) {
          console.warn('Threshold Industry: Industries not found in Current Ratio mapping:', notFoundCurrentRatioIndustries);
        }
        
        return thresholdIndustryData;
      },
      ['INDUSTRY'],
      CACHE_KEYS.THRESHOLD_INDUSTRY,
      forceRefresh,
      DEFAULT_TTL,
      progressCallback
    );
  }
}

