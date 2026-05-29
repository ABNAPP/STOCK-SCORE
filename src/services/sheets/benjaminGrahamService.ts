/**
 * Benjamin Graham Service
 * 
 * Fetches and transforms Benjamin Graham valuation data from Google Sheets.
 * NOTE: Legacy/fallback service path. UI hooks should prefer sheetSnapshotService.
 */

import { BenjaminGrahamData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../firestoreCacheService';
import { fetchWithFallback } from './fetchService';
import { getValue, isValidValue, parseNumericValueNullable } from './dataTransformers';
import {
  asHeaderList,
  DASHBOARD_COMPANY_NAME_COLUMNS,
  DASHBOARD_ENTRY_F1_COLUMNS,
  DASHBOARD_EXIT_F1_COLUMNS,
  DASHBOARD_EXIT_F2_COLUMNS,
  DASHBOARD_IV_FCF_COLUMNS,
  DASHBOARD_IRR1_COLUMNS,
  DASHBOARD_PRICE_COLUMNS,
  DASHBOARD_TICKER_COLUMNS,
} from './dashboardSheetContract';
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
      const companyName = getValue(asHeaderList(DASHBOARD_COMPANY_NAME_COLUMNS), row);
      const ticker = getValue(asHeaderList(DASHBOARD_TICKER_COLUMNS), row);
      const priceStr = getValue(asHeaderList(DASHBOARD_PRICE_COLUMNS), row);
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

      const entryF1Str = getValue(asHeaderList(DASHBOARD_ENTRY_F1_COLUMNS), row);
      const entryF1 = parseNumericValueNullable(entryF1Str);

      const exitF1Str = getValue(asHeaderList(DASHBOARD_EXIT_F1_COLUMNS), row);
      const exitF1 = parseNumericValueNullable(exitF1Str);

      const exitF2Str = getValue(asHeaderList(DASHBOARD_EXIT_F2_COLUMNS), row);
      const exitF2 = parseNumericValueNullable(exitF2Str);
      
      // Parse IV (FCF) if it exists
      const ivFcfStr = getValue(asHeaderList(DASHBOARD_IV_FCF_COLUMNS), row);
      const ivFcf = parseNumericValueNullable(ivFcfStr);
      
      // Parse optional sheet column (IRR1 / RR T1 label); property stays irr1
      const irr1Str = getValue(asHeaderList(DASHBOARD_IRR1_COLUMNS), row);
      const irr1 = parseNumericValueNullable(irr1Str);
      
      // Include row if both company name and ticker are valid (we already checked above)
      return {
        companyName: companyName,
        ticker: ticker,
        price: price,
        entryF1,
        exitF1,
        exitF2,
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
 * Retrieves company data including price, ENTRY F1, IV (FCF), and optional irr1 (RR T1 in UI).
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
    requiredColumns: ['Company Name', 'Ticker'],
    cacheKey: CACHE_KEYS.BENJAMIN_GRAHAM,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: BENJAMIN_GRAHAM_CSV_URL,
  });
}
