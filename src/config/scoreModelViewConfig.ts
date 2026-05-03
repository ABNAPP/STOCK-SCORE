import {
  FUNDAMENTAL_MAX_SCORE_POINTS,
  TECHNICAL_MAX_SCORE_POINTS,
  TOTAL_SCORE_WEIGHT,
} from '../utils/calculateScoreDetailed';

/**
 * Read-only summary aligned with `calculateScoreDetailed` exports (documentation).
 */
export const scoreModelSummaryReadonly = {
  fundamentalMax: FUNDAMENTAL_MAX_SCORE_POINTS,
  technicalMax: TECHNICAL_MAX_SCORE_POINTS,
  totalWeight: TOTAL_SCORE_WEIGHT,
} as const;

export type ScoreModelMetricCategoryReadonly = 'Fundamental' | 'Technical';

/** Editable draft row (strings for controlled inputs). Not used by SCORE engine until wired later. */
export interface ScoreModelMetricDraft {
  id: string;
  category: ScoreModelMetricCategoryReadonly;
  displayName: string;
  fullCondition: string;
  fullPoints: string;
  halfCondition: string;
  halfPoints: string;
  zeroCondition: string;
  zeroPoints: string;
}

/**
 * Default SCORE model as shown/edited on Score Model Settings.
 * Mirrors current product defaults; does not drive `calculateScoreDetailed`.
 * Global persisted settings (when saved): Firestore `appConfig/scoreModel` — see `scoreModelFirestoreService.ts`.
 */
export const DEFAULT_SCORE_MODEL_METRICS: ScoreModelMetricDraft[] = [
  {
    id: 'valuation',
    category: 'Fundamental',
    displayName: 'Valuation Score',
    fullCondition: '>= 3',
    fullPoints: '13.75',
    halfCondition: '>= 1.5 and < 3',
    halfPoints: '6.875',
    zeroCondition: '< 1.5',
    zeroPoints: '0',
  },
  {
    id: 'risk-flag',
    category: 'Fundamental',
    displayName: 'Risk Flag',
    fullCondition: 'LOW',
    fullPoints: '8.25',
    halfCondition: 'MEDIUM',
    halfPoints: '4.125',
    zeroCondition: 'HIGH',
    zeroPoints: '0',
  },
  {
    id: 'business-quality',
    category: 'Fundamental',
    displayName: 'Business Quality Summary',
    fullCondition: 'PASS',
    fullPoints: '8.25',
    halfCondition: 'WATCH',
    halfPoints: '4.125',
    zeroCondition: 'FAIL',
    zeroPoints: '0',
  },
  {
    id: 'sanity',
    category: 'Fundamental',
    displayName: 'Sanity Summary',
    fullCondition: 'PASS',
    fullPoints: '8.25',
    halfCondition: 'WATCH',
    halfPoints: '4.125',
    zeroCondition: 'FAIL',
    zeroPoints: '0',
  },
  {
    id: 'forecast',
    category: 'Fundamental',
    displayName: 'Forecast Confidence',
    fullCondition: 'STRONG',
    fullPoints: '5.5',
    halfCondition: 'MODERATE',
    halfPoints: '2.75',
    zeroCondition: 'WEAK',
    zeroPoints: '0',
  },
  {
    id: 'operating-pillar',
    category: 'Fundamental',
    displayName: 'Operating Pillar Score',
    fullCondition: '>= 7',
    fullPoints: '5.5',
    halfCondition: '>= 4 and < 7',
    halfPoints: '2.75',
    zeroCondition: '< 4',
    zeroPoints: '0',
  },
  {
    id: 'overall-strength',
    category: 'Fundamental',
    displayName: 'Overall Strength',
    fullCondition: '>= 8',
    fullPoints: '5.5',
    halfCondition: '>= 5 and < 8',
    halfPoints: '2.75',
    zeroCondition: '< 5',
    zeroPoints: '0',
  },
  {
    id: 'theoentry',
    category: 'Technical',
    displayName: 'Technical Recommendation',
    fullCondition: 'BUY',
    fullPoints: '45',
    halfCondition: '',
    halfPoints: '0',
    zeroCondition: 'otherwise',
    zeroPoints: '0',
  },
];

export function cloneDefaultScoreModelDraft(): ScoreModelMetricDraft[] {
  return DEFAULT_SCORE_MODEL_METRICS.map((row) => ({ ...row }));
}

/** Legacy step-1 shape: derived for compatibility / simple summaries */
export interface ScoreModelMetricRowReadonly {
  category: ScoreModelMetricCategoryReadonly;
  displayName: string;
  maxPoints: number;
  ruleSummary: string;
}

export const SCORE_MODEL_METRICS_READONLY: ScoreModelMetricRowReadonly[] =
  DEFAULT_SCORE_MODEL_METRICS.map((m) => ({
    category: m.category,
    displayName: m.displayName,
    maxPoints: parseFloat(m.fullPoints) || 0,
    ruleSummary: [
      `${m.fullCondition} → ${m.fullPoints}`,
      m.halfCondition.trim() ? `${m.halfCondition} → ${m.halfPoints}` : null,
      `${m.zeroCondition} → ${m.zeroPoints}`,
    ]
      .filter(Boolean)
      .join('; '),
  }));
