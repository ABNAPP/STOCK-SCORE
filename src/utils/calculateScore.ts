import { ScoreBoardData, IndustryThresholdData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValuesForScore } from '../types/score';
import {
  COLOR_FACTOR_GREEN,
  COLOR_FACTOR_ORANGE_BLUE,
} from '../config/constants';
import {
  getIRRColor,
  getMungerQualityScoreColor,
  getValueCreationColor,
  getRo40Color,
  getLeverageF2Color,
  getCashSdebtColor,
  getCurrentRatioColor,
  getPEPercentageColor,
  getTBSPPriceColor,
  getSMAColor,
  getSMACrossColorStandard,
  isTheoEntryGreen,
} from './colorThresholds';
import type { ColorType } from './colorThresholds';

/**
 * 3-band color factors for score calculation
 *
 * These factors determine how much each color contributes to the total score:
 * - GREEN (1.00): Full points - indicates strong positive metric
 * - ORANGE/BLUE (0.70): Partial points - indicates moderate/acceptable metric
 * - RED (0.00): No points - indicates negative metric requiring attention
 * - BLANK (0.00): No points - indicates missing/invalid data
 *
 * The 0.70 factor for ORANGE/BLUE provides a middle ground between perfect (GREEN)
 * and problematic (RED), allowing for nuanced scoring that reflects real-world
 * business conditions where metrics may be acceptable but not optimal.
 */
const COLOR_FACTORS: Record<ColorType, number> = {
  GREEN: COLOR_FACTOR_GREEN,
  ORANGE: COLOR_FACTOR_ORANGE_BLUE,
  RED: 0.00,
  BLANK: 0.00,
};

/**
 * Metric configuration interface
 * 
 * Defines how each metric contributes to the overall score calculation.
 */
interface Metric {
  name: string;
  weight: number;
  method: '3Band' | 'GreenOnly';
}

/**
 * Metrics configuration with weights and calculation methods
 * 
 * Total weight: 105 points (55 fundamental + 50 technical), scaled to 100.
 * 
 * Weight distribution rationale:
 * - Fundamental metrics (55p): Core financial health indicators
 *   - VALUE CREATION (10p): Highest weight - measures actual value generation
 *   - Munger Quality Score (10p): Highest weight - comprehensive quality metric
 *   - IRR (8p): High weight - return on investment indicator
 *   - Lower weights for supporting metrics (P/E ratios, ratios, etc.)
 * 
 * - Technical metrics (50p): Market timing and technical indicators
 *   - TheoEntry (40p): Highest weight - entry/exit timing is critical for returns
 *   - SMA indicators (2.5p each): Lower weight - supporting trend indicators
 *   - SMA Cross (5p): Moderate weight - trend reversal signal
 * 
 * Calculation methods:
 * - 3Band: Uses color factors (GREEN=1.0, ORANGE=0.7, RED=0.0) for nuanced scoring
 * - GreenOnly: Binary scoring - full points if GREEN, 0 otherwise
 */
const METRICS: Metric[] = [
  // Fundamental (55p)
  { name: 'VALUE CREATION', weight: 10, method: '3Band' },
  { name: 'Munger Quality Score', weight: 10, method: '3Band' },
  { name: 'IRR', weight: 8, method: '3Band' },
  { name: 'Ro40 F1', weight: 6, method: '3Band' },
  { name: 'Ro40 F2', weight: 5, method: '3Band' },
  { name: 'LEVERAGE F2', weight: 5, method: '3Band' },
  { name: 'Cash/SDebt', weight: 4, method: '3Band' },
  { name: 'Current Ratio', weight: 3, method: '3Band' },
  { name: 'P/E1 INDUSTRY', weight: 2, method: '3Band' },
  { name: 'P/E2 INDUSTRY', weight: 1, method: '3Band' },
  { name: '(TB/S)/Price', weight: 1, method: '3Band' },
  // Technical (50p)
  { name: 'TheoEntry', weight: 40, method: 'GreenOnly' },
  { name: 'SMA(100)', weight: 2.5, method: 'GreenOnly' },
  { name: 'SMA(200)', weight: 2.5, method: 'GreenOnly' },
  { name: 'SMA Cross', weight: 5, method: 'GreenOnly' },
];

const TOTAL_ACTIVE_POINTS = 100; // 55 + 50 = 105, but scaled to 100

// Get price from BenjaminGrahamData
function getPriceFromBenjaminGraham(
  ticker: string,
  companyName: string,
  benjaminGrahamData: BenjaminGrahamData[]
): number | null {
  const match = benjaminGrahamData.find(
    item => item.ticker?.toLowerCase() === ticker.toLowerCase() ||
            item.companyName?.toLowerCase() === companyName.toLowerCase()
  );
  return match?.price ?? null;
}

// Get EntryExitValuesForScore
function getEntryExitValue(
  ticker: string,
  companyName: string,
  entryExitValues: Map<string, EntryExitValuesForScore>
): EntryExitValuesForScore | undefined {
  const key = `${ticker}-${companyName}`;
  return entryExitValues.get(key);
}

/**
 * Calculates the overall stock score (0-100) based on fundamental and technical metrics
 * 
 * This function implements a weighted scoring algorithm that evaluates stocks across
 * multiple dimensions:
 * 
 * **Scoring Algorithm:**
 * 1. For each metric, determines color classification (GREEN/ORANGE/RED/BLANK)
 * 2. Applies color factor to metric weight:
 *    - 3Band metrics: GREEN=1.0, ORANGE=0.7, RED=0.0
 *    - GreenOnly metrics: GREEN=full weight, otherwise=0
 * 3. Sums all metric points
 * 4. Scales to 0-100 range (total possible points = 100)
 * 5. Rounds to 1 decimal place
 * 
 * **Color Classification:**
 * - Metrics are classified using industry-specific thresholds where applicable
 * - Missing threshold data results in BLANK (0 points)
 * - Invalid/missing values result in BLANK (0 points)
 * 
 * **Edge Cases:**
 * - If threshold data is missing for an industry, that metric contributes 0 points
 * - If price data is missing, technical metrics (SMA, TheoEntry) contribute 0 points
 * - If entry/exit values are missing, TheoEntry contributes 0 points
 * 
 * @param scoreBoardData - Core stock data with fundamental and technical metrics
 * @param thresholdData - Industry-specific threshold values for metric classification
 * @param benjaminGrahamData - Price data for technical metric calculations
 * @param entryExitValues - Entry/exit values for TheoEntry calculation
 * @returns Stock score between 0.0 and 100.0 (rounded to 1 decimal)
 * 
 * @example
 * See unit tests for full usage examples.
 */
export function calculateScore(
  scoreBoardData: ScoreBoardData,
  thresholdData: IndustryThresholdData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValuesForScore>
): number {
  let totalPts = 0;

  // Get price and entry exit values
  const price = getPriceFromBenjaminGraham(
    scoreBoardData.ticker,
    scoreBoardData.companyName,
    benjaminGrahamData
  );
  const entryExitValue = getEntryExitValue(
    scoreBoardData.ticker,
    scoreBoardData.companyName,
    entryExitValues
  );

  // Process each metric
  for (const metric of METRICS) {
    let color: ColorType = 'BLANK';

    switch (metric.name) {
      case 'VALUE CREATION':
        color = getValueCreationColor(scoreBoardData.valueCreation);
        break;
      case 'Munger Quality Score':
        color = getMungerQualityScoreColor(scoreBoardData.mungerQualityScore);
        break;
      case 'IRR':
        // Edge case: If threshold data is missing for this industry, getIRRColor returns BLANK (0 points)
        // This ensures missing threshold data doesn't break scoring, but also doesn't give false positives
        color = getIRRColor(scoreBoardData.irr, scoreBoardData.industry, thresholdData);
        break;
      case 'Ro40 F1':
        color = getRo40Color(scoreBoardData.ro40F1, scoreBoardData.industry, thresholdData);
        break;
      case 'Ro40 F2':
        color = getRo40Color(scoreBoardData.ro40F2, scoreBoardData.industry, thresholdData);
        break;
      case 'LEVERAGE F2':
        color = getLeverageF2Color(scoreBoardData.leverageF2, scoreBoardData.industry, thresholdData);
        break;
      case 'Cash/SDebt':
        color = getCashSdebtColor(
          scoreBoardData.cashSdebt,
          scoreBoardData.isCashSdebtDivZero,
          scoreBoardData.industry,
          thresholdData
        );
        break;
      case 'Current Ratio':
        color = getCurrentRatioColor(scoreBoardData.currentRatio, scoreBoardData.industry, thresholdData);
        break;
      case 'P/E1 INDUSTRY':
        color = getPEPercentageColor(scoreBoardData.pe1Industry);
        break;
      case 'P/E2 INDUSTRY':
        color = getPEPercentageColor(scoreBoardData.pe2Industry);
        break;
      case '(TB/S)/Price':
        color = getTBSPPriceColor(scoreBoardData.tbSPrice);
        break;
      case 'TheoEntry':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
        break;
      case 'SMA(100)':
        color = getSMAColor(price, scoreBoardData.sma100);
        break;
      case 'SMA(200)':
        color = getSMAColor(price, scoreBoardData.sma200);
        break;
      case 'SMA Cross':
        color = getSMACrossColorStandard(scoreBoardData.smaCross);
        break;
    }

    // Calculate points based on method
    if (metric.method === '3Band') {
      const factor = COLOR_FACTORS[color];
      totalPts += metric.weight * factor;
    } else if (metric.method === 'GreenOnly') {
      if (color === 'GREEN') {
        totalPts += metric.weight;
      }
      // Otherwise 0 points
    }
  }

  // Scale to 0-100
  const score100 = TOTAL_ACTIVE_POINTS > 0
    ? Math.max(0, Math.min(100, (totalPts / TOTAL_ACTIVE_POINTS) * 100))
    : 0;

  // Round to 1 decimal
  return Math.round(score100 * 10) / 10;
}
