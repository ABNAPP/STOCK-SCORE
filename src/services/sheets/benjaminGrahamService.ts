/**
 * Benjamin Graham Service
 * 
 * Fetches and transforms Benjamin Graham valuation data from Google Sheets.
 */

import { BenjaminGrahamData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../firestoreCacheService';
import { fetchWithFallback } from './fetchService';
import { getValue, isValidValue, parseNumericValueNullable } from './dataTransformers';
import { isBenjaminGrahamData } from '../../utils/typeGuards';
import type { DataRow, ProgressCallback } from './types';

// Benjamin Graham data configuration
const BENJAMIN_GRAHAM_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const BENJAMIN_GRAHAM_GID = '1180885830';
const BENJAMIN_GRAHAM_CSV_URL = `https://docs.google.com/spreadsheets/d/${BENJAMIN_GRAHAM_SHEET_ID}/export?format=csv&gid=${BENJAMIN_GRAHAM_GID}`;

/**
 * Transformer function for Benjamin Graham data
 * Exported for use in background sync persist.
 */
export function transformBenjaminGrahamData(results: { data: DataRow[]; meta: { fields: string[] | null } }): BenjaminGrahamData[] {
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
    .filter((data): data is BenjaminGrahamData => data !== null && isBenjaminGrahamData(data));
  
  return benjaminGrahamData;
}

/**
 * Fetches Benjamin Graham data from Google Sheets
 * 
 * Retrieves company valuation data including Benjamin Graham value, price, IV (FCF), and IRR1.
 * Tries Apps Script API first (fast), falls back to CSV proxy if needed (slower).
 * 
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of Benjamin Graham data entries
 * @throws {Error} If data fetch fails or required columns are missing
 */
export async function fetchBenjaminGrahamData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<BenjaminGrahamData[]> {
  return fetchWithFallback<BenjaminGrahamData>({
    sheetName: 'DashBoard',
    dataTypeName: 'Benjamin Graham',
    transformer: transformBenjaminGrahamData,
    requiredColumns: ['Benjamin Graham', 'Company Name', 'Ticker'],
    cacheKey: CACHE_KEYS.BENJAMIN_GRAHAM,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: BENJAMIN_GRAHAM_CSV_URL,
  });
}
