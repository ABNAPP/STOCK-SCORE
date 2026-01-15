import { ScoreBoardData, ThresholdIndustryData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';
import {
  PRICE_TOLERANCE_GREEN,
  RR1_GREEN_THRESHOLD_PERCENT,
  MUNGER_QUALITY_SCORE_RED_THRESHOLD,
  MUNGER_QUALITY_SCORE_GREEN_THRESHOLD,
  TB_S_PRICE_GREEN_THRESHOLD,
  COLOR_FACTOR_GREEN,
  COLOR_FACTOR_ORANGE_BLUE,
} from '../config/constants';

// Color classification types
type ColorType = 'GREEN' | 'BLUE' | 'RED' | 'BLANK';

// Color factors
const COLOR_FACTORS = {
  GREEN: COLOR_FACTOR_GREEN,
  BLUE: COLOR_FACTOR_ORANGE_BLUE,
  RED: 0.00,
  BLANK: 0.00,
};

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

// Color classification functions (same logic as ScoreBoardTable)

function getIRRColor(
  irrValue: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  if (irrValue === null || !isFinite(irrValue)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    t => t.industry.toLowerCase() === industry.toLowerCase()
  );

  if (!threshold) return 'BLANK';

  const { irr: irrThreshold } = threshold;
  return irrValue >= irrThreshold ? 'GREEN' : 'RED';
}

function getMungerQualityScoreColor(mungerQualityScore: number | null): ColorType {
  if (mungerQualityScore === null || !isFinite(mungerQualityScore)) return 'BLANK';
  
  if (mungerQualityScore < MUNGER_QUALITY_SCORE_RED_THRESHOLD) return 'RED';
  if (mungerQualityScore >= MUNGER_QUALITY_SCORE_RED_THRESHOLD && mungerQualityScore <= MUNGER_QUALITY_SCORE_GREEN_THRESHOLD) return 'BLUE';
  return 'GREEN'; // >= MUNGER_QUALITY_SCORE_GREEN_THRESHOLD
}

function getValueCreationColor(valueCreation: number | null): ColorType {
  if (valueCreation === null || !isFinite(valueCreation)) return 'BLANK';
  return valueCreation >= 0 ? 'GREEN' : 'RED';
}

function getRo40Color(
  ro40Value: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  if (ro40Value === null || !isFinite(ro40Value)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    t => t.industry.toLowerCase() === industry.toLowerCase()
  );

  if (!threshold) return 'BLANK';

  const { ro40Min, ro40Max } = threshold;
  const ro40Decimal = ro40Value / 100;

  if (ro40Decimal <= ro40Min) return 'RED';
  if (ro40Decimal >= ro40Max) return 'GREEN';
  return 'BLUE'; // Between MIN and MAX
}

function getLeverageF2Color(
  leverageF2Value: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  if (leverageF2Value === null || !isFinite(leverageF2Value)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    t => t.industry.toLowerCase() === industry.toLowerCase()
  );

  if (!threshold) return 'BLANK';

  const { leverageF2Min, leverageF2Max } = threshold;

  if (leverageF2Value <= leverageF2Min) return 'GREEN';
  if (leverageF2Value <= leverageF2Max) return 'BLUE';
  return 'RED'; // > leverageF2Max
}

function getCashSdebtColor(
  cashSdebt: number | null,
  isDivZero: boolean,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  if (isDivZero) return 'GREEN';
  if (cashSdebt === null || !isFinite(cashSdebt)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    t => t.industry.toLowerCase() === industry.toLowerCase()
  );

  if (!threshold) return 'BLANK';

  const { cashSdebtMin, cashSdebtMax } = threshold;

  if (cashSdebt <= cashSdebtMin) return 'RED';
  if (cashSdebt >= cashSdebtMax) return 'GREEN';
  return 'BLUE'; // Between MIN and MAX
}

function getCurrentRatioColor(
  currentRatio: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  if (currentRatio === null || !isFinite(currentRatio)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    t => t.industry.toLowerCase() === industry.toLowerCase()
  );

  if (!threshold) return 'BLANK';

  const { currentRatioMin, currentRatioMax } = threshold;

  if (currentRatio < currentRatioMin) return 'RED';
  if (currentRatio >= currentRatioMin && currentRatio < currentRatioMax) return 'GREEN';
  return 'BLUE'; // >= currentRatioMax
}

function getPEPercentageColor(peIndustry: number | null): ColorType {
  if (peIndustry === null || !isFinite(peIndustry)) return 'BLANK';
  return peIndustry <= 0 ? 'GREEN' : 'RED';
}

function getTBSPPriceColor(tbSPrice: number | null): ColorType {
  if (tbSPrice === null || !isFinite(tbSPrice)) return 'BLANK';
  return tbSPrice >= TB_S_PRICE_GREEN_THRESHOLD ? 'GREEN' : 'RED';
}

function getSMAColor(
  price: number | null | undefined,
  smaValue: number | null
): ColorType {
  if (price === null || price === undefined || !isFinite(price) ||
      smaValue === null || !isFinite(smaValue)) {
    return 'BLANK';
  }

  if (price > smaValue) return 'GREEN';
  if (price < smaValue) return 'RED';
  return 'BLUE'; // price === smaValue (yellow in UI, but counts as blue)
}

/**
 * Classifies SMA Cross color with inverted logic for detailed view
 * 
 * **Why inverted logic (GOLDEN=RED, DEATH=GREEN)?**
 * - In the detailed scoring view, the business logic interprets signals differently
 * - GOLDEN cross (short-term above long-term) can indicate overbought conditions
 * - DEATH cross (short-term below long-term) can indicate oversold opportunities
 * - This inversion reflects a contrarian approach in the detailed analysis
 * - Note: This differs from the main score calculation which uses standard logic
 * 
 * @param smaCross - SMA cross signal ('GOLDEN', 'DEATH', or null)
 * @returns Color classification (inverted for detailed view)
 */
function getSMACrossColor(smaCross: string | null): ColorType {
  if (!smaCross) return 'BLANK';
  const upper = smaCross.toUpperCase();
  // Note: In ScoreBoardTable, GOLDEN is red and DEATH is green (opposite of expectation)
  // Following the actual implementation in ScoreBoardTable
  if (upper.includes('GOLDEN')) return 'RED';
  if (upper.includes('DEATH')) return 'GREEN';
  return 'BLANK';
}

// Calculate RR1: (Exit1 - Entry1) / Entry1 * 100
function calculateRR1(entry1: number, exit1: number): number | null {
  if (!entry1 || !exit1 || entry1 === 0) return null;
  const rr1 = ((exit1 - entry1) / entry1) * 100;
  return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
}

// Check if RR1 is green
function isRR1Green(
  entryExitValues: EntryExitValues | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  
  const entry1 = entryExitValues.entry1 || 0;
  const exit1 = entryExitValues.exit1 || 0;
  const rr1 = calculateRR1(entry1, exit1);

  // RR1 is green when: RR1 >= 60%, Price > 0, Entry1 > 0, Price ≤ Entry1 * 1.05
  return rr1 !== null && rr1 >= RR1_GREEN_THRESHOLD_PERCENT && price !== null && price !== undefined && price > 0 && entry1 > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN;
}

// Check if Entry1 is green
function isEntry1Green(
  entryExitValues: EntryExitValues | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  
  const entry1 = entryExitValues.entry1 || 0;

  // Entry1 is green when: Entry1 > 0, Price > 0, Price ≤ Entry1 * 1.05
  return entry1 > 0 && price !== null && price !== undefined && price > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN;
}

// Calculate RR2: (Exit2 - Entry2) / Entry2 * 100
function calculateRR2(entry2: number, exit2: number): number | null {
  if (!entry2 || !exit2 || entry2 === 0) return null;
  const rr2 = ((exit2 - entry2) / entry2) * 100;
  return isNaN(rr2) || !isFinite(rr2) ? null : rr2;
}

// Check if RR2 is green for TheoEntry (RR2 > 60% and Price ≤ Entry2 * 1.05)
function isRR2GreenForTheoEntry(
  entryExitValues: EntryExitValues | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  
  const entry2 = entryExitValues.entry2 || 0;
  const exit2 = entryExitValues.exit2 || 0;
  const rr2 = calculateRR2(entry2, exit2);

  // RR2 is green for TheoEntry when: RR2 > 60%, Price > 0, Entry2 > 0, Price ≤ Entry2 * 1.05
  return rr2 !== null && rr2 > RR1_GREEN_THRESHOLD_PERCENT && price !== null && price !== undefined && price > 0 && entry2 > 0 && price <= entry2 * PRICE_TOLERANCE_GREEN;
}

// Check if Entry2 is green
function isEntry2Green(
  entryExitValues: EntryExitValues | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  
  const entry2 = entryExitValues.entry2 || 0;

  // Entry2 is green when: Entry2 > 0, Price > 0, Price ≤ Entry2 * 1.05
  return entry2 > 0 && price !== null && price !== undefined && price > 0 && price <= entry2 * PRICE_TOLERANCE_GREEN;
}

// Check if TheoEntry is green (either RR1+Entry1 OR RR2+Entry2 are green)
function isTheoEntryGreen(
  entryExitValues: EntryExitValues | undefined,
  price: number | null | undefined
): boolean {
  // RR1 path: RR1 is green AND Entry1 is green
  const rr1Path = isRR1Green(entryExitValues, price) && isEntry1Green(entryExitValues, price);
  
  // RR2 path: RR2 > 60% AND Entry2 is green
  const rr2Path = isRR2GreenForTheoEntry(entryExitValues, price) && isEntry2Green(entryExitValues, price);
  
  return rr1Path || rr2Path;
}

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

// Get EntryExitValues
function getEntryExitValue(
  ticker: string,
  companyName: string,
  entryExitValues: Map<string, EntryExitValues>
): EntryExitValues | undefined {
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
  thresholdData: ThresholdIndustryData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValues>
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
        color = getSMACrossColor(scoreBoardData.smaCross);
        break;
    }

    // Calculate points based on color
    const factor = COLOR_FACTORS[color];
    const points = metric.weight * factor;
    
    // Determine category
    const category = fundamentalMetrics.includes(metric.name) ? 'Fundamental' : 'Technical';
    
    items.push({
      metric: metric.name,
      weight: metric.weight,
      color: color,
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
  thresholdData: ThresholdIndustryData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValues>
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
        color = getSMACrossColor(scoreBoardData.smaCross);
        break;
    }

    // Calculate points based on color
    const factor = COLOR_FACTORS[color];
    totalPoints += metric.weight * factor;
  }

  // Score is already 0-100 (total weight is 100)
  // Round to 1 decimal
  return Math.round(Math.max(0, Math.min(100, totalPoints)) * 10) / 10;
}

