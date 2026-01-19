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
 */
function transformSMAData(results: { data: DataRow[]; meta: { fields: string[] | null } }): SMAData[] {
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
    .filter((data): data is SMAData => data !== null);
  
  return smaData;
}

/**
 * Fetches SMA (Simple Moving Average) data from Google Sheets
 * 
 * Retrieves technical analysis data including SMA(100), SMA(200), and SMA Cross signals.
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
    requiredColumns: ['Company Name', 'Ticker', 'SMA(100)', 'SMA(200)', 'SMA Cross'],
    cacheKey: CACHE_KEYS.SMA,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: SMA_CSV_URL,
  });
}
