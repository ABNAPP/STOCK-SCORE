/**
 * Score Board Service
 * 
 * Fetches and transforms Score Board data from Google Sheets.
 * Combines data from multiple sources (PE Industry and SMA sheets).
 */

import { ScoreBoardData, PEIndustryData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../cacheService';
import { fetchWithFallback } from './fetchService';
import { getValueAllowZero, isValidValue, parseNumericValueNullable, parsePercentageValueNullable } from './dataTransformers';
import { fetchPEIndustryData } from './peIndustryService';
import { fetchSMAData } from './smaService';
import { logger } from '../../utils/logger';
import type { DataRow, ProgressCallback } from './types';

// Score Board data configuration (uses same Dashboard sheet as P/E Industry)
const SCORE_BOARD_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const SCORE_BOARD_GID = '1180885830';
const SCORE_BOARD_CSV_URL = `https://docs.google.com/spreadsheets/d/${SCORE_BOARD_SHEET_ID}/export?format=csv&gid=${SCORE_BOARD_GID}`;

/**
 * Creates transformer function for Score Board data
 * 
 * @param industryPe1Map - Map of industry to P/E1 median values
 * @param industryPe2Map - Map of industry to P/E2 median values
 * @param smaDataMap - Map of ticker to SMA data
 * @returns Transformer function
 */
function createScoreBoardTransformer(
  industryPe1Map: Map<string, number>,
  industryPe2Map: Map<string, number>,
  smaDataMap: Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>
) {
  return (results: { data: DataRow[]; meta: { fields: string[] | null } }): ScoreBoardData[] => {
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
        
        // Get (TB/S)/Price directly from Dashboard sheet
        const tbSPriceStr = getValueAllowZero(['(TB/S)/Price', '(TB/S)/Price', '(tb/s)/price', '(TB/S)/PRICE'], row);
        
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
        
        // Parse (TB/S)/Price directly from column
        const tbSPrice = parseNumericValueNullable(tbSPriceStr);
        
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

        // Match SMA(100), SMA(200), and SMA Cross from SMA sheet by ticker
        const tickerKey = ticker.toLowerCase().trim();
        const smaMatch = smaDataMap.get(tickerKey);

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
          sma100: smaMatch ? smaMatch.sma100 : null, // Directly from SMA sheet
          sma200: smaMatch ? smaMatch.sma200 : null, // Directly from SMA sheet
          smaCross: smaMatch ? smaMatch.smaCross : null, // Directly from SMA sheet
        };
      })
      .filter((data): data is ScoreBoardData => data !== null);
    
    return scoreBoardData;
  };
}

/**
 * Fetches Score Board data from Google Sheets
 * 
 * Retrieves comprehensive scoring data including IRR, Munger Quality Score, Value Creation,
 * RO40, Leverage, P/E ratios, Current Ratio, Cash/SDebt, and SMA data.
 * Combines data from multiple sources (PE Industry and SMA sheets).
 * Tries Apps Script API first (fast), falls back to CSV proxy if needed (slower).
 * 
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of Score Board data entries
 * @throws {Error} If data fetch fails or required columns are missing
 */
export async function fetchScoreBoardData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<ScoreBoardData[]> {
  // Fetch PEIndustryData and SMAData in parallel (they are independent)
  logger.debug('Fetching PE Industry and SMA data in parallel...', { component: 'scoreBoardService', operation: 'fetchScoreBoardData' });
  
  const [peIndustryResult, smaResult] = await Promise.allSettled([
    fetchPEIndustryData(forceRefresh),
    fetchSMAData(forceRefresh),
  ]);

  // Process PEIndustryData results
  let peIndustryData: PEIndustryData[] = [];
  if (peIndustryResult.status === 'fulfilled') {
    peIndustryData = peIndustryResult.value;
  } else {
    logger.warn(
      'Failed to fetch PE Industry data for P/E1 INDUSTRY calculation',
      { component: 'scoreBoardService', operation: 'fetchScoreBoardData', error: peIndustryResult.reason }
    );
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

  // Process SMAData results
  let smaDataMap = new Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>();
  if (smaResult.status === 'fulfilled') {
    const smaData = smaResult.value;
    smaData.forEach((sma) => {
      const tickerKey = sma.ticker.toLowerCase().trim();
      smaDataMap.set(tickerKey, {
        sma100: sma.sma100,
        sma200: sma.sma200,
        smaCross: sma.smaCross,
      });
    });
  } else {
    logger.warn(
      'Failed to fetch SMA data for Score Board',
      { component: 'scoreBoardService', operation: 'fetchScoreBoardData', error: smaResult.reason }
    );
  }

  // Create transformer with the maps
  const transformer = createScoreBoardTransformer(industryPe1Map, industryPe2Map, smaDataMap);

  return fetchWithFallback<ScoreBoardData>({
    sheetName: 'DashBoard',
    dataTypeName: 'Score Board',
    transformer,
    requiredColumns: ['Company Name', 'Ticker', 'IRR', 'Munger Quality Score', 'VALUE CREATION'],
    cacheKey: CACHE_KEYS.SCORE_BOARD,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: SCORE_BOARD_CSV_URL,
  });
}
