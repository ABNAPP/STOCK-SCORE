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

// Metrics configuration with weights; GreenOnly metrics get full weight only when GREEN
interface Metric {
  name: string;
  weight: number;
  method: '3Band' | 'GreenOnly';
}

const METRICS: Metric[] = [
  // Technical (45p) — endast THEOENTRY i Score-motorn (P/E används inte här)
  { name: 'THEOENTRY', weight: 45, method: 'GreenOnly' },
];

const FUNDAMENTAL_METRIC_NAMES = new Set<string>();

export const FUNDAMENTAL_MAX_SCORE_POINTS = METRICS.filter((m) =>
  FUNDAMENTAL_METRIC_NAMES.has(m.name)
).reduce((sum, m) => sum + m.weight, 0);

export const TECHNICAL_MAX_SCORE_POINTS = METRICS.filter(
  (m) => !FUNDAMENTAL_METRIC_NAMES.has(m.name)
).reduce((sum, m) => sum + m.weight, 0);

export const TOTAL_SCORE_WEIGHT = METRICS.reduce((sum, m) => sum + m.weight, 0);

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
 * Individual metric breakdown item
 * 
 * Represents how a single metric contributes to the overall score.
 */
export interface ScoreBreakdownItem {
  /** Metric name (t.ex. 'THEOENTRY') */
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
 */
export function calculateDetailedScoreBreakdown(
  scoreBoardData: ScoreBoardData,
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

  const fundamentalMetrics = [...FUNDAMENTAL_METRIC_NAMES];

  // Process each metric
  for (const metric of METRICS) {
    let color: ColorType = 'BLANK';

    switch (metric.name) {
      case 'THEOENTRY':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
        break;
    }

    // Map ORANGE -> BLUE for detailed view (factor lookup and display)
    const detailedColor = toDetailedColor(color);
    const factor = metric.method === 'GreenOnly'
      ? (detailedColor === 'GREEN' ? 1 : 0)
      : COLOR_FACTORS[detailedColor];
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

  const rawTotal = fundamentalTotal + technicalTotal;
  const totalScore =
    TOTAL_SCORE_WEIGHT > 0
      ? Math.round(Math.max(0, Math.min(100, (rawTotal / TOTAL_SCORE_WEIGHT) * 100)) * 10) / 10
      : 0;

  return {
    totalScore,
    items,
    fundamentalTotal: Math.round(fundamentalTotal * 10) / 10,
    technicalTotal: Math.round(technicalTotal * 10) / 10,
  };
}

/**
 * Calculates detailed score (0-100) using the detailed scoring algorithm
 */
export function calculateDetailedScore(
  scoreBoardData: ScoreBoardData,
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
      case 'THEOENTRY':
        color = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
        break;
    }

    const detailedColor = toDetailedColor(color);
    const factor = metric.method === 'GreenOnly'
      ? (detailedColor === 'GREEN' ? 1 : 0)
      : COLOR_FACTORS[detailedColor];
    totalPoints += metric.weight * factor;
  }

  const scaled =
    TOTAL_SCORE_WEIGHT > 0
      ? Math.max(0, Math.min(100, (totalPoints / TOTAL_SCORE_WEIGHT) * 100))
      : 0;
  return Math.round(scaled * 10) / 10;
}
