import { ScoreBoardData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValuesForScore } from '../types/score';
import { isTheoEntryGreen } from './colorThresholds';
import type { ColorType } from './colorThresholds';

/** Detailed view uses BLUE for middle band (partial credit on fundamentals). */
type DetailedColor = 'GREEN' | 'BLUE' | 'RED' | 'BLANK';

/** Maps colorThresholds ColorType (ORANGE) to DetailedColor (BLUE) for factor lookup and display. */
function toDetailedColor(color: ColorType): DetailedColor {
  return color === 'ORANGE' ? 'BLUE' : (color as DetailedColor);
}

interface Metric {
  name: string;
  weight: number;
  method: 'GreenOnly' | 'TieredFundamental';
}

/**
 * Fundamental = 55p (tiered), Technical = 45p (THEOENTRY GreenOnly). Total weight = 100.
 * P/E och SMA ingår inte i Score-poängen.
 */
const METRICS: Metric[] = [
  { name: 'VALUATION_SCORE', weight: 13.75, method: 'TieredFundamental' },
  { name: 'RISK_FLAG', weight: 8.25, method: 'TieredFundamental' },
  { name: 'BUSINESS_QUALITY_SUMMARY', weight: 8.25, method: 'TieredFundamental' },
  { name: 'SANITY_SUMMARY', weight: 8.25, method: 'TieredFundamental' },
  { name: 'FORECAST_CONFIDENCE', weight: 5.5, method: 'TieredFundamental' },
  { name: 'OPERATING_PILLAR_SCORE', weight: 5.5, method: 'TieredFundamental' },
  { name: 'OVERALL_STRENGTH', weight: 5.5, method: 'TieredFundamental' },
  { name: 'THEOENTRY', weight: 45, method: 'GreenOnly' },
];

const FUNDAMENTAL_METRIC_NAMES = new Set(
  METRICS.filter((m) => m.method === 'TieredFundamental').map((m) => m.name)
);

export const FUNDAMENTAL_MAX_SCORE_POINTS = METRICS.filter((m) =>
  FUNDAMENTAL_METRIC_NAMES.has(m.name)
).reduce((sum, m) => sum + m.weight, 0);

export const TECHNICAL_MAX_SCORE_POINTS = METRICS.filter(
  (m) => !FUNDAMENTAL_METRIC_NAMES.has(m.name)
).reduce((sum, m) => sum + m.weight, 0);

export const TOTAL_SCORE_WEIGHT = METRICS.reduce((sum, m) => sum + m.weight, 0);

function normText(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase();
}

function isValidNumber(n: unknown): n is number {
  return typeof n === 'number' && !Number.isNaN(n);
}

function computeTieredFundamentalPoints(metric: Metric, row: ScoreBoardData): number {
  const w = metric.weight;
  switch (metric.name) {
    case 'VALUATION_SCORE': {
      const v = row.valuationScore;
      if (!isValidNumber(v)) return 0;
      if (v >= 3) return w;
      if (v >= 1.5 && v < 3) return w / 2;
      return 0;
    }
    case 'RISK_FLAG': {
      const t = normText(row.riskFlag);
      if (t === 'LOW') return w;
      if (t === 'MEDIUM') return w / 2;
      return 0;
    }
    case 'BUSINESS_QUALITY_SUMMARY': {
      const t = normText(row.businessQualitySummary);
      if (t === 'PASS') return w;
      if (t === 'WATCH') return w / 2;
      return 0;
    }
    case 'SANITY_SUMMARY': {
      const t = normText(row.sanitySummary);
      if (t === 'PASS') return w;
      if (t === 'WATCH') return w / 2;
      return 0;
    }
    case 'FORECAST_CONFIDENCE': {
      const t = normText(row.forecastConfidenceVerdict);
      if (t === 'STRONG') return w;
      if (t === 'MODERATE') return w / 2;
      return 0;
    }
    case 'OPERATING_PILLAR_SCORE': {
      const v = row.operatingPillarScore;
      if (!isValidNumber(v)) return 0;
      if (v >= 7) return w;
      if (v >= 4 && v < 7) return w / 2;
      return 0;
    }
    case 'OVERALL_STRENGTH': {
      const v = row.overallStrength;
      if (!isValidNumber(v)) return 0;
      if (v >= 8) return w;
      if (v >= 5 && v < 8) return w / 2;
      return 0;
    }
    default:
      return 0;
  }
}

function fundamentalDisplayColor(points: number, weight: number): DetailedColor {
  const eps = 1e-6;
  if (points <= eps) return 'BLANK';
  if (points >= weight - eps) return 'GREEN';
  return 'BLUE';
}

function fundamentalFactor(points: number, weight: number): number {
  return weight > 0 ? points / weight : 0;
}

// Get price from BenjaminGrahamData
function getPriceFromBenjaminGraham(
  ticker: string,
  companyName: string,
  benjaminGrahamData: BenjaminGrahamData[]
): number | null {
  const match = benjaminGrahamData.find(
    (item) =>
      item.ticker?.toLowerCase() === ticker.toLowerCase() ||
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
 * Represents how a single metric contributes to the overall score calculation.
 */
export interface ScoreBreakdownItem {
  /** Internal metric id (e.g. THEOENTRY, VALUATION_SCORE) */
  metric: string;
  /** Weight of this metric in the total score calculation */
  weight: number;
  /** Color classification for display */
  color: 'GREEN' | 'BLUE' | 'RED' | 'BLANK';
  /** Fraction of max weight earned (0–1; fundamentals may be 0, 0.5, 1) */
  factor: number;
  /** Points contributed toward total (max 100 across all metrics) */
  points: number;
  /** Category: 'Fundamental' or 'Technical' */
  category: 'Fundamental' | 'Technical';
}

/**
 * Complete score breakdown structure
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

  for (const metric of METRICS) {
    const category = FUNDAMENTAL_METRIC_NAMES.has(metric.name) ? 'Fundamental' : 'Technical';

    if (metric.method === 'TieredFundamental') {
      const points = computeTieredFundamentalPoints(metric, scoreBoardData);
      const detailedColor = fundamentalDisplayColor(points, metric.weight);
      const factor = fundamentalFactor(points, metric.weight);
      items.push({
        metric: metric.name,
        weight: metric.weight,
        color: detailedColor,
        factor,
        points: Math.round(points * 10) / 10,
        category,
      });
      fundamentalTotal += points;
      continue;
    }

    if (metric.name === 'THEOENTRY') {
      const color: ColorType = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
      const detailedColor = toDetailedColor(color);
      const factor = detailedColor === 'GREEN' ? 1 : 0;
      const points = metric.weight * factor;
      items.push({
        metric: metric.name,
        weight: metric.weight,
        color: detailedColor,
        factor,
        points,
        category: 'Technical',
      });
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
 * Calculates detailed score (0-100): sum of earned points / 100 * 100.
 */
export function calculateDetailedScore(
  scoreBoardData: ScoreBoardData,
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValuesForScore>
): number {
  let totalPoints = 0;

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

  for (const metric of METRICS) {
    if (metric.method === 'TieredFundamental') {
      totalPoints += computeTieredFundamentalPoints(metric, scoreBoardData);
      continue;
    }
    if (metric.name === 'THEOENTRY') {
      const color: ColorType = isTheoEntryGreen(entryExitValue, price) ? 'GREEN' : 'BLANK';
      const detailedColor = toDetailedColor(color);
      const factor = detailedColor === 'GREEN' ? 1 : 0;
      totalPoints += metric.weight * factor;
    }
  }

  const scaled =
    TOTAL_SCORE_WEIGHT > 0
      ? Math.max(0, Math.min(100, (totalPoints / TOTAL_SCORE_WEIGHT) * 100))
      : 0;
  return Math.round(scaled * 10) / 10;
}
