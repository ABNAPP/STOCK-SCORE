import { ScoreBoardData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValuesForScore } from '../types/score';
import {
  COLOR_FACTOR_GREEN,
  COLOR_FACTOR_ORANGE_BLUE,
} from '../config/constants';
import {
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
 * Total raw weight sums to 45 (enbart THEOENTRY); score is scaled till 0–100.
 * P/E1/P/E2 och SMA ingår inte i Score-poängen.
 *
 * Calculation methods:
 * - 3Band: Uses color factors (GREEN=1.0, ORANGE=0.7, RED=0.0) for nuanced scoring (används ej när inga sådana metriker finns)
 * - GreenOnly: Binary scoring - full points if GREEN, 0 otherwise
 */
const METRICS: Metric[] = [
  { name: 'THEOENTRY', weight: 45, method: 'GreenOnly' },
];

const TOTAL_ACTIVE_POINTS = METRICS.reduce((sum, m) => sum + m.weight, 0);

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
  _ticker: string,
  companyName: string,
  entryExitValues: Map<string, EntryExitValuesForScore>
): EntryExitValuesForScore | undefined {
  return entryExitValues.get(companyName);
}

/**
 * Calculates the overall stock score (0-100) based on fundamental and technical metrics
 * 
 * @param scoreBoardData - Core stock data with fundamental and technical metrics
 * @param benjaminGrahamData - Price data for technical metric calculations
 * @param entryExitValues - Entry/exit values for TheoEntry calculation
 * @returns Stock score between 0.0 and 100.0 (rounded to 1 decimal)
 */
export function calculateScore(
  scoreBoardData: ScoreBoardData,
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
      case 'THEOENTRY':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
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
