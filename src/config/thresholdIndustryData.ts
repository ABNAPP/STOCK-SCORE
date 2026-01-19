/**
 * Static Threshold Industry Data
 * 
 * This file contains the static threshold industry data that was previously
 * fetched from Google Sheets. The data is generated from industry threshold
 * mappings in industryThresholds.ts.
 * 
 * Manual changes to threshold values are persisted in Firestore and localStorage
 * via ThresholdContext.
 */

import { ThresholdIndustryData } from '../types/stock';
import {
  INDUSTRY_IRR_MAP,
  INDUSTRY_LEVERAGE_F2_MAP,
  INDUSTRY_RO40_MAP,
  INDUSTRY_CASH_SDEBT_MAP,
  INDUSTRY_CURRENT_RATIO_MAP,
} from './industryThresholds';

/**
 * Generate threshold industry data from mappings
 * Uses all industries found across all mapping files
 */
function generateThresholdIndustryData(): ThresholdIndustryData[] {
  // Collect all unique industries from all mappings
  const industrySet = new Set<string>();
  
  // Add industries from all maps
  Object.keys(INDUSTRY_IRR_MAP).forEach(industry => industrySet.add(industry));
  Object.keys(INDUSTRY_LEVERAGE_F2_MAP).forEach(industry => industrySet.add(industry));
  Object.keys(INDUSTRY_RO40_MAP).forEach(industry => industrySet.add(industry));
  Object.keys(INDUSTRY_CASH_SDEBT_MAP).forEach(industry => industrySet.add(industry));
  Object.keys(INDUSTRY_CURRENT_RATIO_MAP).forEach(industry => industrySet.add(industry));
  
  // Convert to sorted array and map to ThresholdIndustryData
  const industries = Array.from(industrySet).sort();
  
  return industries.map((industry) => {
    // Get IRR value (default to 0 if not found)
    const irrValue = INDUSTRY_IRR_MAP[industry] ?? 0;
    
    // Get Leverage F2 values (default to { min: 0, max: 0 } if not found)
    const leverageF2Map = INDUSTRY_LEVERAGE_F2_MAP[industry];
    const leverageF2Values = leverageF2Map
      ? { min: leverageF2Map.greenMax, max: leverageF2Map.redMin }
      : { min: 0, max: 0 };
    
    // Get RO40 values (default to { min: 0, max: 0 } if not found)
    const ro40Values = INDUSTRY_RO40_MAP[industry] ?? { min: 0, max: 0 };
    
    // Get Cash/SDebt values (default to { min: 0, max: 0 } if not found)
    const cashSdebtValues = INDUSTRY_CASH_SDEBT_MAP[industry] ?? { min: 0, max: 0 };
    
    // Get Current Ratio values (default to { min: 0, max: 0 } if not found)
    const currentRatioValues = INDUSTRY_CURRENT_RATIO_MAP[industry] ?? { min: 0, max: 0 };
    
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
}

/**
 * Static threshold industry data
 * Generated from industry threshold mappings at build time
 */
export const STATIC_THRESHOLD_INDUSTRY_DATA: ThresholdIndustryData[] = generateThresholdIndustryData();
