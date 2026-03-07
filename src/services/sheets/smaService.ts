/**
 * SMA Service
 * 
 * Fetches and transforms SMA (Simple Moving Average) data from Google Sheets.
 */

import { SMAData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../firestoreCacheService';
import { fetchWithFallback } from './fetchService';
import { getValue, isValidValue, parseNumericValueNullable } from './dataTransformers';
import type { DataRow, ProgressCallback } from './types';

// SMA data configuration (uses same Dashboard sheet as Benjamin Graham)
const SMA_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const SMA_GID = '1413104083';
const SMA_CSV_URL = `https://docs.google.com/spreadsheets/d/${SMA_SHEET_ID}/export?format=csv&gid=${SMA_GID}`;

/**
 * Transformer function for SMA data
 * Exported for use in background sync persist.
 */
export function transformSMAData(results: { data: DataRow[]; meta: { fields: string[] | null } }): SMAData[] {
  const smaData: SMAData[] = results.data
    .map((row: DataRow) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const sma9Str = getValue(['SMA(9)', 'sma(9)', 'sma9', 'SMA9'], row);
      const sma21Str = getValue(['SMA(21)', 'sma(21)', 'sma21', 'SMA21'], row);
      const sma55Str = getValue(['SMA(55)', 'sma(55)', 'sma55', 'SMA55'], row);
      const sma200Str = getValue(['SMA(200)', 'SMA(200)', 'sma(200)', 'sma200', 'SMA200'], row);

      // Only skip row if both company name and ticker are invalid (keep row if either is valid, so no row is dropped e.g. ZIM)
      if (!isValidValue(companyName) && !isValidValue(ticker)) {
        return null;
      }

      const sma9 = parseNumericValueNullable(sma9Str);
      const sma21 = parseNumericValueNullable(sma21Str);
      const sma55 = parseNumericValueNullable(sma55Str);
      const sma200 = parseNumericValueNullable(sma200Str);

      return {
        companyName,
        ticker,
        sma9,
        sma21,
        sma55,
        sma200,
      };
    })
    .filter((data): data is SMAData => data !== null);

  return smaData;
}

/**
 * Fetches SMA (Simple Moving Average) data from Google Sheets
 * 
 * Retrieves technical analysis data including SMA(9), SMA(21), SMA(55) and SMA(200).
 * Tries Apps Script API first (fast), falls back to CSV proxy if needed (slower).
 * 
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of SMA data entries
 * @throws {Error} If data fetch fails or required columns are missing
 */
export async function fetchSMAData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<SMAData[]> {
  return fetchWithFallback<SMAData>({
    sheetName: 'SMA',
    dataTypeName: 'SMA',
    transformer: transformSMAData,
    requiredColumns: ['Company Name', 'Ticker', 'SMA(9)', 'SMA(21)', 'SMA(55)', 'SMA(200)'],
    cacheKey: CACHE_KEYS.SMA,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: SMA_CSV_URL,
  });
}
