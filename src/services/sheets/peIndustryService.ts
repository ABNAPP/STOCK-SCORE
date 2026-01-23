/**
 * P/E Industry Service
 * 
 * Fetches and transforms P/E Industry data from Google Sheets.
 * Groups companies by industry and calculates median P/E ratios.
 */

import { PEIndustryData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../firestoreCacheService';
import { fetchWithFallback } from './fetchService';
import { getValue, isValidValue, parseNumericValueNullable, calculateMedian } from './dataTransformers';
import type { DataRow, ProgressCallback } from './types';

// P/E Industry data configuration
const PE_INDUSTRY_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const PE_INDUSTRY_GID = '1180885830';
const PE_INDUSTRY_CSV_URL = `https://docs.google.com/spreadsheets/d/${PE_INDUSTRY_SHEET_ID}/export?format=csv&gid=${PE_INDUSTRY_GID}`;

/**
 * Transformer function for P/E Industry data
 */
export function transformPEIndustryData(results: { data: DataRow[]; meta: { fields: string[] | null } }): PEIndustryData[] {
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

    let industryData = industryMap.get(industry);
    if (!industryData) {
      industryData = { pe: [], pe1: [], pe2: [], count: 0 };
      industryMap.set(industry, industryData);
    }
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
}

/**
 * Fetches P/E Industry data from Google Sheets
 * 
 * Retrieves industry-specific P/E ratio data by grouping companies by industry
 * and calculating median P/E, P/E1, and P/E2 values for each industry.
 * Tries Apps Script API first (fast), falls back to CSV proxy if needed (slower).
 * 
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of P/E Industry data entries, one per industry
 * @throws {Error} If data fetch fails or required columns are missing
 */
export async function fetchPEIndustryData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<PEIndustryData[]> {
  return fetchWithFallback<PEIndustryData>({
    sheetName: 'DashBoard',
    dataTypeName: 'P/E Industry',
    transformer: transformPEIndustryData,
    requiredColumns: ['INDUSTRY', 'P/E', 'P/E1', 'P/E2', 'Company Name', 'Ticker'],
    cacheKey: CACHE_KEYS.PE_INDUSTRY,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: PE_INDUSTRY_CSV_URL,
  });
}
