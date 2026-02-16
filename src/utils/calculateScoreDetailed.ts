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
  getSMACrossColorDetailed,
  isTheoEntryGreen,
} from './colorThresholds';
import type { ColorType } from './colorThresholds';

/** Detailed view uses BLUE for middle band (maps ORANGE from colorThresholds). */
type DetailedColor = 'GREEN' | 'BLUE' | 'RED' | 'BLANK';

const COLOR_FACTORS: Record<DetailedColor, number> = {
  GREEN: COLOR_FACTOR_GREEN,
  BLUE: COLOR_FACTOR_ORANGE_BLUE,
  RED: 0.00,
  BLANK: 0.00,
};

/** Maps colorThresholds ColorType (ORANGE) to DetailedColor (BLUE) for factor lookup and display. */
function toDetailedColor(color: ColorType): DetailedColor {
  return color === 'ORANGE' ? 'BLUE' : (color as DetailedColor);
}

// Metrics configuration with weights
interface Metric {
  name: string;
  weight: number;
}

const METRICS: Metric[] = [
  // Fundamental (50p)
  { name: 'VALUE CREATION', weight: 7 },
  { name: 'Munger Quality Score', weight: 7 },
  { name: 'IRR', weight: 6 },
  { name: 'Ro40 F1', weight: 3 },
  { name: 'Ro40 F2', weight: 3 },
  { name: 'LEVERAGE F2', weight: 4 },
  { name: 'Cash/SDebt', weight: 5 },
  { name: 'Current Ratio', weight: 3 },
  { name: 'P/E1 INDUSTRY', weight: 5 },
  { name: 'P/E2 INDUSTRY', weight: 5 },
  { name: '(TB/S)/Price', weight: 2 },
  // Technical (50p)
  { name: 'THEOENTRY', weight: 40 },
  { name: 'SMA(100)', weight: 2.5 },
  { name: 'SMA(200)', weight: 2.5 },
  { name: 'SMA CROSS', weight: 5 },
];

const TOTAL_WEIGHT = 100; // 50 + 50

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
 * Individual metric breakdown item
 * 
 * Represents how a single metric contributes to the overall score.
 */
export interface ScoreBreakdownItem {
  /** Metric name (e.g., 'VALUE CREATION', 'TheoEntry') */
  metric: string;
  /** Weight of this metric in the total score calculation */
  weight: number;
  /** Color classification: GREEN (1.00), BLUE (0.70), RED (0.00), or BLANK (0.00) */
  color: 'GREEN' | 'BLUE' | 'RED' | 'BLANK';
  /** Color factor applied: 1.00 (GREEN), 0.70 (BLUE/ORANGE), or 0.00 (RED/BLANK) */
  factor: number;
  /** Points contributed: weight * factor */
  points: number;
  /** Category: 'Fundamental' or 'Technical' */
  category: 'Fundamental' | 'Technical';
}

/**
 * Complete score breakdown structure
 * 
 * Provides detailed breakdown of how the score was calculated, allowing
 * users to understand which metrics contributed positively or negatively.
 */
export interface ScoreBreakdown {
  /** Total score (0-100) */
  totalScore: number;
  /** Array of individual metric contributions */
  items: ScoreBreakdownItem[];
  /** Sum of all fundamental metric points */
  fundamentalTotal: number;
  /** Sum of all technical metric points */
  technicalTotal: number;
}

/**
 * Calculates detailed score breakdown showing individual metric contributions
 * 
 * This function provides transparency into how the score was calculated by
 * breaking down each metric's contribution. Useful for:
 * - Understanding which metrics are driving the score
 * - Identifying areas for improvement
 * - Debugging score calculations
 * - Displaying score breakdown in UI tooltips
 * 
 * **Differences from calculateScore():**
 * - Returns detailed breakdown instead of just final score
 * - Separates fundamental vs technical totals
 * - Uses BLUE instead of ORANGE for consistency with detailed view
 * - Provides per-metric point contributions
 * 
 * **Score Breakdown Structure:**
 * - Each metric shows: name, weight, color, factor, points, category
 * - Fundamental total: Sum of all fundamental metric points
 * - Technical total: Sum of all technical metric points
 * - Total score: Sum of both categories (0-100)
 * 
 * @param scoreBoardData - Core stock data with fundamental and technical metrics
 * @param thresholdData - Industry-specific threshold values for metric classification
 * @param benjaminGrahamData - Price data for technical metric calculations
 * @param entryExitValues - Entry/exit values for TheoEntry calculation
 * @returns Detailed score breakdown with per-metric contributions
 * 
 * @example
 * ```typescript
 * const breakdown = calculateDetailedScoreBreakdown(
 *   scoreBoardData,
 *   thresholdData,
 *   benjaminGrahamData,
 *   entryExitValues
 * );
 * 
 * console.log(`Total Score: ${breakdown.totalScore}`);
 * console.log(`Fundamental: ${breakdown.fundamentalTotal}`);
 * console.log(`Technical: ${breakdown.technicalTotal}`);
 * breakdown.items.forEach(item => {
 *   console.log(`${item.metric}: ${item.points} points (${item.color})`);
 * });
 * ```
 */
export function calculateDetailedScoreBreakdown(
  scoreBoardData: ScoreBoardData,
  thresholdData: IndustryThresholdData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValuesForScore>
): ScoreBreakdown {
  const items: ScoreBreakdownItem[] = [];
  let fundamentalTotal = 0;
  let technicalTotal = 0;

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

  // Define which metrics are Fundamental vs Technical
  const fundamentalMetrics = [
    'VALUE CREATION',
    'Munger Quality Score',
    'IRR',
    'Ro40 F1',
    'Ro40 F2',
    'LEVERAGE F2',
    'Cash/SDebt',
    'Current Ratio',
    'P/E1 INDUSTRY',
    'P/E2 INDUSTRY',
    '(TB/S)/Price',
  ];

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
      case 'THEOENTRY':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
        break;
      case 'SMA(100)':
        color = getSMAColor(price, scoreBoardData.sma100);
        break;
      case 'SMA(200)':
        color = getSMAColor(price, scoreBoardData.sma200);
        break;
      case 'SMA CROSS':
        color = getSMACrossColorDetailed(scoreBoardData.smaCross);
        break;
    }

    // Map ORANGE -> BLUE for detailed view (factor lookup and display)
    const detailedColor = toDetailedColor(color);
    const factor = COLOR_FACTORS[detailedColor];
    const points = metric.weight * factor;
    
    // Determine category
    const category = fundamentalMetrics.includes(metric.name) ? 'Fundamental' : 'Technical';
    
    items.push({
      metric: metric.name,
      weight: metric.weight,
      color: detailedColor,
      factor: factor,
      points: points,
      category: category,
    });

    // Add to category total
    if (category === 'Fundamental') {
      fundamentalTotal += points;
    } else {
      technicalTotal += points;
    }
  }

  const totalScore = Math.round(Math.max(0, Math.min(100, fundamentalTotal + technicalTotal)) * 10) / 10;

  return {
    totalScore,
    items,
    fundamentalTotal: Math.round(fundamentalTotal * 10) / 10,
    technicalTotal: Math.round(technicalTotal * 10) / 10,
  };
}

/**
 * Calculates detailed score (0-100) using the detailed scoring algorithm
 * 
 * This function uses the same algorithm as calculateScore() but with
 * different metric weights optimized for the detailed view. The main
 * differences are:
 * 
 * - Different weight distribution (50p fundamental + 50p technical)
 * - Uses BLUE color classification instead of ORANGE
 * - SMA Cross has inverted logic (GOLDEN=RED, DEATH=GREEN) for detailed view
 * 
 * **When to use:**
 * - For detailed score view that matches the breakdown display
 * - When consistency with calculateDetailedScoreBreakdown() is required
 * - For alternative scoring perspective with balanced fundamental/technical weights
 * 
 * @param scoreBoardData - Core stock data with fundamental and technical metrics
 * @param thresholdData - Industry-specific threshold values for metric classification
 * @param benjaminGrahamData - Price data for technical metric calculations
 * @param entryExitValues - Entry/exit values for TheoEntry calculation
 * @returns Stock score between 0.0 and 100.0 (rounded to 1 decimal)
 * 
 * @example
 * ```typescript
 * const detailedScore = calculateDetailedScore(
 *   scoreBoardData,
 *   thresholdData,
 *   benjaminGrahamData,
 *   entryExitValues
 * );
 * // Returns: 78.5 (example score using detailed algorithm)
 * ```
 */
export function calculateDetailedScore(
  scoreBoardData: ScoreBoardData,
  thresholdData: IndustryThresholdData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValuesForScore>
): number {
  let totalPoints = 0;

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
      case 'THEOENTRY':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
        break;
      case 'SMA(100)':
        color = getSMAColor(price, scoreBoardData.sma100);
        break;
      case 'SMA(200)':
        color = getSMAColor(price, scoreBoardData.sma200);
        break;
      case 'SMA CROSS':
        color = getSMACrossColorDetailed(scoreBoardData.smaCross);
        break;
    }

    const detailedColor = toDetailedColor(color);
    const factor = COLOR_FACTORS[detailedColor];
    totalPoints += metric.weight * factor;
  }

  // Score is already 0-100 (total weight is 100)
  // Round to 1 decimal
  return Math.round(Math.max(0, Math.min(100, totalPoints)) * 10) / 10;
}

