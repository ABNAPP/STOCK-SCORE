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
type ColorType = 'GREEN' | 'ORANGE' | 'RED' | 'BLANK';

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
  ORANGE: COLOR_FACTOR_ORANGE_BLUE, // Used for orange/blue colors (same value)
  RED: 0.00,
  BLANK: 0.00, // BLANK values contribute 0 points
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

// Helper function to classify color from CSS class logic
function classifyColor(colorClass: string | null): ColorType {
  if (!colorClass) return 'BLANK';
  
  if (colorClass.includes('green')) return 'GREEN';
  if (colorClass.includes('blue') || colorClass.includes('yellow')) return 'ORANGE';
  if (colorClass.includes('red')) return 'RED';
  
  return 'BLANK';
}

// Color classification functions (same logic as ScoreBoardTable)

/**
 * Classifies IRR color based on industry threshold
 * 
 * **Edge Case: Missing threshold data**
 * - If threshold data is missing for an industry, returns BLANK (0 points)
 * - This prevents false positives from missing data
 * - Business logic: Better to show no score than an incorrect score
 * 
 * @param irrValue - IRR value to classify
 * @param industry - Industry name for threshold lookup
 * @param thresholdData - Industry threshold configuration
 * @returns Color classification (GREEN if >= threshold, RED if < threshold, BLANK if missing)
 */
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

  // Edge case: Missing threshold data - return BLANK to avoid false scoring
  if (!threshold) return 'BLANK';

  const { irr: irrThreshold } = threshold;
  return irrValue >= irrThreshold ? 'GREEN' : 'RED';
}

/**
 * Classifies Munger Quality Score color using three thresholds
 * 
 * **Why three thresholds?**
 * - RED (< 50): Low quality - company has significant issues requiring attention
 * - ORANGE (50-70): Moderate quality - acceptable but not exceptional
 * - GREEN (> 70): High quality - strong company fundamentals
 * 
 * This three-tier system provides nuanced evaluation rather than binary pass/fail,
 * allowing the scoring algorithm to distinguish between acceptable and excellent companies.
 * 
 * @param mungerQualityScore - Munger Quality Score value (0-100 scale)
 * @returns Color classification based on score thresholds
 */
function getMungerQualityScoreColor(mungerQualityScore: number | null): ColorType {
  if (mungerQualityScore === null || !isFinite(mungerQualityScore)) return 'BLANK';
  
  if (mungerQualityScore < MUNGER_QUALITY_SCORE_RED_THRESHOLD) return 'RED';
  if (mungerQualityScore >= MUNGER_QUALITY_SCORE_RED_THRESHOLD && mungerQualityScore <= MUNGER_QUALITY_SCORE_GREEN_THRESHOLD) return 'ORANGE';
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
  return 'ORANGE'; // Between MIN and MAX
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
  if (leverageF2Value <= leverageF2Max) return 'ORANGE';
  return 'RED'; // > leverageF2Max
}

/**
 * Classifies Cash/SDebt color based on industry thresholds
 * 
 * **Why division by zero returns GREEN?**
 * - If SDebt is zero (division by zero), the company has no short-term debt
 * - This is an extremely positive financial position (infinite cash/debt ratio)
 * - Therefore, it's classified as GREEN to reflect this strong financial health
 * 
 * @param cashSdebt - Cash to Short-term Debt ratio
 * @param isDivZero - Whether the calculation resulted in division by zero (SDebt = 0)
 * @param industry - Industry name for threshold lookup
 * @param thresholdData - Industry threshold configuration
 * @returns Color classification
 */
function getCashSdebtColor(
  cashSdebt: number | null,
  isDivZero: boolean,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): ColorType {
  // Division by zero = no short-term debt = excellent financial position
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
  return 'ORANGE'; // Between MIN and MAX
}

/**
 * Classifies Current Ratio color with special logic
 * 
 * **Why this specific logic?**
 * - RED (< min): Insufficient liquidity - company may struggle to meet short-term obligations
 * - GREEN (min to max): Optimal range - sufficient liquidity without excessive idle cash
 * - ORANGE (>= max): Excess liquidity - too much cash sitting idle (opportunity cost)
 * 
 * Unlike other metrics where higher is always better, Current Ratio has a "sweet spot"
 * where too much liquidity can indicate inefficient capital allocation.
 * 
 * @param currentRatio - Current assets to current liabilities ratio
 * @param industry - Industry name for threshold lookup
 * @param thresholdData - Industry threshold configuration
 * @returns Color classification
 */
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
  return 'ORANGE'; // >= currentRatioMax - excess liquidity indicates opportunity cost

/**
 * Classifies P/E Industry percentage color
 * 
 * **Why negative/zero P/E is GREEN?**
 * - Negative P/E means the stock is trading below its earnings (undervalued)
 * - Zero P/E means the stock is trading at earnings (fairly valued)
 * - Positive P/E percentage means the stock is trading above industry average (overvalued)
 * 
 * This metric measures relative valuation compared to industry peers, where
 * being at or below industry average indicates better value.
 * 
 * @param peIndustry - P/E ratio percentage relative to industry average
 * @returns Color classification
 */
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
  return 'ORANGE'; // price === smaValue (yellow)
}

function getSMACrossColor(smaCross: string | null): ColorType {
  if (!smaCross) return 'BLANK';
  const upper = smaCross.toUpperCase();
  if (upper === 'GOLDEN') return 'GREEN';
  if (upper === 'DEATH') return 'RED';
  return 'BLANK';
}

// Calculate RR1: (Exit1 - Entry1) / Entry1 * 100
function calculateRR1(entry1: number, exit1: number): number | null {
  if (!entry1 || !exit1 || entry1 === 0) return null;
  const rr1 = ((exit1 - entry1) / entry1) * 100;
  return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
}

/**
 * Determines if RR1 (Risk/Reward ratio 1) is green
 * 
 * **Why 5% price tolerance (1.05)?**
 * - Allows for small price movements around entry point
 * - Accounts for market volatility and bid/ask spreads
 * - Prevents false negatives when price is slightly above entry due to normal trading
 * - 5% is a reasonable buffer that doesn't compromise entry discipline
 * 
 * **Why RR1 >= 60% threshold?**
 * - Ensures minimum 60% potential return for the risk taken
 * - Filters for trades with favorable risk/reward profiles
 * - Aligns with professional trading standards for minimum acceptable R/R
 * 
 * @param entryExitValues - Entry and exit values for calculation
 * @param price - Current stock price
 * @returns True if RR1 meets all green criteria
 */
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

/**
 * Determines if TheoEntry (Theoretical Entry) is green
 * 
 * **Why two paths (RR1/Entry1 OR RR2/Entry2)?**
 * - Provides flexibility for different trading strategies
 * - RR1 path: Primary entry strategy with Entry1/Exit1
 * - RR2 path: Alternative entry strategy with Entry2/Exit2
 * - Either path can qualify, allowing for multiple valid entry scenarios
 * - This dual-path approach accommodates different market conditions and strategies
 * 
 * **Business Logic:**
 * - TheoEntry is green if EITHER path is valid (OR logic)
 * - Both paths require: sufficient R/R ratio (>=60%) AND price within tolerance
 * - This ensures entry quality while maintaining flexibility
 * 
 * @param entryExitValues - Entry and exit values for both paths
 * @param price - Current stock price
 * @returns True if either RR1+Entry1 OR RR2+Entry2 path is green
 */
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
 * ```typescript
 * const score = calculateScore(
 *   {
 *     ticker: 'AAPL',
 *     companyName: 'Apple Inc.',
 *     valueCreation: 150,
 *     mungerQualityScore: 75,
 *     irr: 12.5,
 *     industry: 'Technology',
 *     // ... other metrics
 *   },
 *   [
 *     { industry: 'Technology', irr: 10, ro40Min: 0.15, ro40Max: 0.25, /* ... */ }
 *   ],
 *   [
 *     { ticker: 'AAPL', companyName: 'Apple Inc.', price: 175.50 }
 *   ],
 *   new Map([['AAPL-Apple Inc.', { entry1: 170, exit1: 200, entry2: 165, exit2: 195 }]])
 * );
 * // Returns: 82.5 (example score)
 * ```
 */
export function calculateScore(
  scoreBoardData: ScoreBoardData,
  thresholdData: ThresholdIndustryData[],
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValues>
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
        color = getSMACrossColor(scoreBoardData.smaCross);
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

