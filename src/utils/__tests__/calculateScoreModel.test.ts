import { describe, it, expect } from 'vitest';
import type { ScoreBoardData } from '../../types/stock';
import {
  FUNDAMENTAL_MAX_SCORE_POINTS,
  TECHNICAL_MAX_SCORE_POINTS,
  TOTAL_SCORE_WEIGHT,
  calculateDetailedScore,
  calculateDetailedScoreBreakdown,
} from '../calculateScoreDetailed';
import type { EntryExitValuesForScore } from '../../types/score';

function baseRow(over: Partial<ScoreBoardData> & Pick<ScoreBoardData, 'companyName' | 'ticker'>): ScoreBoardData {
  return {
    industry: '',
    marketCap: null,
    dashboardDateOfUpdate: null,
    dateOfValuation: null,
    mungerQualityScore: null,
    valueCreation: null,
    leverageF2: null,
    pe1Industry: null,
    pe2Industry: null,
    currentRatio: null,
    cashSdebt: null,
    isCashSdebtDivZero: false,
    sma9: null,
    sma21: null,
    sma55: null,
    sma200: null,
    fiveYearBeta: null,
    finalStatus: null,
    riskFlag: null,
    valuationScore: null,
    forecastConfidenceVerdict: null,
    sanitySummary: null,
    businessQualitySummary: null,
    operatingPillarScore: null,
    overallStrength: null,
    statusNote: null,
    ...over,
  } as ScoreBoardData;
}

describe('SCORE model (55 + 45 = 100)', () => {
  it('exports expected maxima and total weight', () => {
    expect(FUNDAMENTAL_MAX_SCORE_POINTS).toBe(55);
    expect(TECHNICAL_MAX_SCORE_POINTS).toBe(45);
    expect(TOTAL_SCORE_WEIGHT).toBe(100);
  });

  it('all zeros gives total 0', () => {
    const row = baseRow({ companyName: 'A', ticker: 'A' });
    const entry = new Map<string, EntryExitValuesForScore>();
    const s = calculateDetailedScore(row, [], entry);
    expect(s).toBe(0);
  });

  it('max fundamental bands without THEOENTRY still caps under 100', () => {
    const row = baseRow({
      companyName: 'A',
      ticker: 'A',
      valuationScore: 3,
      riskFlag: 'low',
      businessQualitySummary: 'pass',
      sanitySummary: 'PASS',
      forecastConfidenceVerdict: 'strong',
      operatingPillarScore: 7,
      overallStrength: 8,
    });
    const s = calculateDetailedScore(row, [], new Map());
    expect(s).toBe(55);
  });

  it('breakdown lists 7 fundamental + 1 technical items', () => {
    const row = baseRow({ companyName: 'A', ticker: 'A' });
    const b = calculateDetailedScoreBreakdown(row, [], new Map());
    expect(b.items.filter((i) => i.category === 'Fundamental')).toHaveLength(7);
    expect(b.items.filter((i) => i.category === 'Technical')).toHaveLength(1);
    expect(b.items.some((i) => i.metric === 'THEOENTRY')).toBe(true);
  });
});
