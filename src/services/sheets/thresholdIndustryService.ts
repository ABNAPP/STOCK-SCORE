/**
 * Threshold Industry Service
 * 
 * Fetches and transforms Threshold Industry data from Google Sheets.
 * Maps industry names to configured threshold values.
 */

import { ThresholdIndustryData } from '../../types/stock';
import { CACHE_KEYS, DEFAULT_TTL } from '../cacheService';
import { fetchWithFallback } from './fetchService';
import { getValue, isValidValue, findIRRForIndustry, findLeverageF2ForIndustry, findRO40ForIndustry, findCashSdebtForIndustry, findCurrentRatioForIndustry } from './dataTransformers';
import { logger } from '../../utils/logger';
import type { DataRow, ProgressCallback } from './types';

// Threshold Industry data configuration (uses same Dashboard sheet as P/E Industry)
const THRESHOLD_INDUSTRY_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const THRESHOLD_INDUSTRY_GID = '1180885830';
const THRESHOLD_INDUSTRY_CSV_URL = `https://docs.google.com/spreadsheets/d/${THRESHOLD_INDUSTRY_SHEET_ID}/export?format=csv&gid=${THRESHOLD_INDUSTRY_GID}`;

/**
 * Transformer function for Threshold Industry data
 */
function transformThresholdIndustryData(results: { data: DataRow[]; meta: { fields: string[] | null } }): ThresholdIndustryData[] {
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
  
  // Log industries that were not found in the mappings (only in dev mode to reduce noise)
  if (notFoundIRRIndustries.length > 0) {
    logger.warn(
      `Threshold Industry: ${notFoundIRRIndustries.length} industry/industries not found in IRR mapping: ${notFoundIRRIndustries.join(', ')}. To fix: Add these industries to INDUSTRY_IRR_MAP in src/config/industryThresholds.ts`,
      { component: 'thresholdIndustryService', industries: notFoundIRRIndustries }
    );
  }
  if (notFoundLeverageF2Industries.length > 0) {
    logger.warn(
      `Threshold Industry: ${notFoundLeverageF2Industries.length} industry/industries not found in Leverage F2 mapping: ${notFoundLeverageF2Industries.join(', ')}. To fix: Add these industries to INDUSTRY_LEVERAGE_F2_MAP in src/config/industryThresholds.ts`,
      { component: 'thresholdIndustryService', industries: notFoundLeverageF2Industries }
    );
  }
  if (notFoundRO40Industries.length > 0) {
    logger.warn(
      `Threshold Industry: ${notFoundRO40Industries.length} industry/industries not found in RO40 mapping: ${notFoundRO40Industries.join(', ')}. To fix: Add these industries to INDUSTRY_RO40_MAP in src/config/industryThresholds.ts`,
      { component: 'thresholdIndustryService', industries: notFoundRO40Industries }
    );
  }
  if (notFoundCashSdebtIndustries.length > 0) {
    logger.warn(
      `Threshold Industry: ${notFoundCashSdebtIndustries.length} industry/industries not found in Cash/SDebt mapping: ${notFoundCashSdebtIndustries.join(', ')}. To fix: Add these industries to INDUSTRY_CASH_SDEBT_MAP in src/config/industryThresholds.ts`,
      { component: 'thresholdIndustryService', industries: notFoundCashSdebtIndustries }
    );
  }
  if (notFoundCurrentRatioIndustries.length > 0) {
    logger.warn(
      `Threshold Industry: ${notFoundCurrentRatioIndustries.length} industry/industries not found in Current Ratio mapping: ${notFoundCurrentRatioIndustries.join(', ')}. To fix: Add these industries to INDUSTRY_CURRENT_RATIO_MAP in src/config/industryThresholds.ts`,
      { component: 'thresholdIndustryService', industries: notFoundCurrentRatioIndustries }
    );
  }
  
  return thresholdIndustryData;
}

/**
 * Fetches Threshold Industry data from Google Sheets
 * 
 * Retrieves industry-specific threshold values including IRR, Leverage F2, RO40,
 * Cash/SDebt, and Current Ratio thresholds. Maps industry names to configured threshold values.
 * Tries Apps Script API first (fast), falls back to CSV proxy if needed (slower).
 * 
 * @param forceRefresh - If true, bypasses cache and forces network request (default: false)
 * @param progressCallback - Optional callback for progress updates during fetch/parse/transform
 * @returns Promise resolving to array of Threshold Industry data entries, one per industry
 * @throws {Error} If data fetch fails or required columns are missing
 */
export async function fetchThresholdIndustryData(
  forceRefresh: boolean = false,
  progressCallback?: ProgressCallback
): Promise<ThresholdIndustryData[]> {
  return fetchWithFallback<ThresholdIndustryData>({
    sheetName: 'DashBoard',
    dataTypeName: 'Threshold Industry',
    transformer: transformThresholdIndustryData,
    requiredColumns: ['INDUSTRY'],
    cacheKey: CACHE_KEYS.THRESHOLD_INDUSTRY,
    forceRefresh,
    ttl: DEFAULT_TTL,
    progressCallback,
    csvUrl: THRESHOLD_INDUSTRY_CSV_URL,
  });
}
