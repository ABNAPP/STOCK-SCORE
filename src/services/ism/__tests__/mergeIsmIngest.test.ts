import { describe, it, expect } from 'vitest';
import type { ScoreBoardData } from '../../../types/stock';
import type { DataRow } from '../../sheets/types';
import {
  mergeIsmIngestRows,
  mergeIsmIngestFromDashboardRows,
  readDashboardSectorIsm,
  summarizeIsmIngest,
} from '../mergeIsmIngest';
import { ISM_READINESS_HINTS } from '../../../types/ismIngest';

function mockRow(partial: Partial<ScoreBoardData> & Pick<ScoreBoardData, 'companyName' | 'ticker' | 'industry'>): ScoreBoardData {
  return {
    companyName: partial.companyName,
    ticker: partial.ticker,
    industry: partial.industry,
    marketCap: partial.marketCap !== undefined ? partial.marketCap : 1e9,
    dashboardDateOfUpdate:
      partial.dashboardDateOfUpdate !== undefined ? partial.dashboardDateOfUpdate : '2024-01-01',
    dateOfValuation: partial.dateOfValuation !== undefined ? partial.dateOfValuation : null,
    mungerQualityScore: partial.mungerQualityScore ?? 50,
    valueCreation: partial.valueCreation ?? 10,
    leverageF2: partial.leverageF2 ?? 1,
    pe1Industry: partial.pe1Industry ?? null,
    pe2Industry: partial.pe2Industry ?? null,
    currentRatio: partial.currentRatio ?? 1,
    cashSdebt: partial.cashSdebt ?? 1,
    isCashSdebtDivZero: partial.isCashSdebtDivZero ?? false,
    sma9: partial.sma9 ?? null,
    sma21: partial.sma21 ?? null,
    sma55: partial.sma55 ?? null,
    sma200: partial.sma200 ?? null,
    price: partial.price ?? null,
    fiveYearBeta: partial.fiveYearBeta ?? null,
    finalStatus: partial.finalStatus ?? null,
    riskFlag: partial.riskFlag ?? null,
    valuationScore: partial.valuationScore ?? null,
    forecastConfidenceVerdict: partial.forecastConfidenceVerdict ?? null,
    sanitySummary: partial.sanitySummary ?? null,
    businessQualitySummary: partial.businessQualitySummary ?? null,
    operatingPillarScore: partial.operatingPillarScore ?? null,
    overallStrength: partial.overallStrength ?? null,
    statusNote: partial.statusNote ?? null,
  };
}

describe('mergeIsmIngestRows', () => {
  it('builds symbolId from DashBoard ticker and attaches currency from getter', () => {
    const rows = [
      mockRow({
        companyName: 'TestCo',
        ticker: 'NYSE:BAX',
        industry: 'Health Care',
      }),
    ];
    const out = mergeIsmIngestRows(rows, (_t, company) => (company === 'TestCo' ? 'USD' : ''));
    expect(out[0].symbolId).toBe('nyse_bax');
    expect(out[0].currency).toBe('USD');
    expect(out[0].quality.missingCurrency).toBe(false);
  });

  it('flags missing currency when getter returns empty', () => {
    const rows = [mockRow({ companyName: 'A', ticker: 'MMM', industry: 'Industrials' })];
    const out = mergeIsmIngestRows(rows, () => '');
    expect(out[0].symbolId).toBe('unknown_mmm');
    expect(out[0].quality.missingCurrency).toBe(true);
    expect(out[0].readinessHints).toContain(ISM_READINESS_HINTS.MISSING_CURRENCY);
  });

  it('flags missing market cap', () => {
    const rows = [mockRow({ companyName: 'A', ticker: 'LULU', industry: 'X', marketCap: null })];
    const out = mergeIsmIngestRows(rows, () => 'CAD');
    expect(out[0].quality.missingMarketCap).toBe(true);
    expect(out[0].readinessHints).toContain(ISM_READINESS_HINTS.MISSING_MARKET_CAP);
  });

  it('flags missing sector', () => {
    const rows = [mockRow({ companyName: 'A', ticker: 'LULU', industry: '' })];
    const out = mergeIsmIngestRows(rows, () => 'USD');
    expect(out[0].quality.missingSector).toBe(true);
  });

  it('flags ticker parse review from ISM parser', () => {
    const rows = [mockRow({ companyName: 'A', ticker: 'NYSE:BRK:B', industry: 'Finans' })];
    const out = mergeIsmIngestRows(rows, () => 'USD');
    expect(out[0].quality.tickerNeedsReview).toBe(true);
    expect(out[0].readinessHints).toContain(ISM_READINESS_HINTS.TICKER_PARSE_REVIEW);
  });
});

describe('mergeIsmIngestFromDashboardRows', () => {
  it('uses SECTOR (ISM) only; Industry is ignored even when SECTOR (ISM) is empty', () => {
    const row: DataRow = {
      'Company Name': 'Contoso Mining',
      Ticker: 'CRC',
      Industry: 'Mining',
      'SECTOR (ISM)': '',
      'Market Cap': '1000000',
      'Date of Update': '2024-06-01',
    };
    const out = mergeIsmIngestFromDashboardRows([row], () => 'USD');
    expect(out).toHaveLength(1);
    expect(out[0].sectorIsm).toBe('');
    expect(out[0].quality.missingSector).toBe(true);
  });

  it('uses SECTOR (ISM) when set', () => {
    const row: DataRow = {
      'Company Name': 'OtherCo',
      Ticker: 'NYSE:FOO',
      Industry: 'Consumer',
      'SECTOR (ISM)': 'Technology',
      'Market Cap': '2000000',
      'Date of Update': '2024-06-02',
    };
    const out = mergeIsmIngestFromDashboardRows([row], () => 'USD');
    expect(out[0].sectorIsm).toBe('Technology');
  });

  it('uses SECTOR (ISM) when Industry differs (Industry ignored)', () => {
    const row: DataRow = {
      'Company Name': 'DualCo',
      Ticker: 'DUAL',
      Industry: 'Energy',
      'SECTOR (ISM)': 'Utilities',
      'Market Cap': '500000',
      'Date of Update': '2024-01-15',
    };
    expect(readDashboardSectorIsm(row)).toBe('Utilities');
    const out = mergeIsmIngestFromDashboardRows([row], () => 'CAD');
    expect(out[0].sectorIsm).toBe('Utilities');
  });

  it('currency comes only from getter, not from sheet', () => {
    const row: DataRow = {
      'Company Name': 'CurCo',
      Ticker: 'CUR',
      Industry: 'X',
      'SECTOR (ISM)': 'Materials',
      Currency: 'JPY',
      'Market Cap': '1',
      'Date of Update': '2024-01-01',
    };
    const out = mergeIsmIngestFromDashboardRows([row], () => 'EUR');
    expect(out[0].currency).toBe('EUR');
  });

  it('skips rows with invalid company or ticker', () => {
    const rows: DataRow[] = [
      {
        'Company Name': '#N/A',
        Ticker: 'ABC',
        Industry: 'A',
        'SECTOR (ISM)': 'A',
        'Market Cap': '1',
        'Date of Update': '2024-01-01',
      },
      {
        'Company Name': 'Good',
        Ticker: 'OK',
        Industry: 'B',
        'SECTOR (ISM)': 'B',
        'Market Cap': '2',
        'Date of Update': '2024-01-02',
      },
    ];
    const out = mergeIsmIngestFromDashboardRows(rows, () => 'USD');
    expect(out).toHaveLength(1);
    expect(out[0].companyName).toBe('Good');
  });
});

describe('summarizeIsmIngest', () => {
  it('aggregates counts', () => {
    const rows = mergeIsmIngestRows(
      [
        mockRow({ companyName: 'A', ticker: 'A', industry: 'S1', marketCap: null }),
        mockRow({ companyName: 'B', ticker: 'B', industry: 'S2' }),
      ],
      (t, c) => (c === 'A' ? '' : 'SEK')
    );
    const s = summarizeIsmIngest(rows);
    expect(s.rowCount).toBe(2);
    expect(s.withMissingCurrency).toBe(1);
    expect(s.withMissingMarketCap).toBe(1);
  });
});
