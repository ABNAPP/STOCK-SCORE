/**
 * Single source of truth for DashBoard tab column header aliases.
 * Consumers: Score Board transformer, Benjamin Graham, P/E sector (ISM), ISM ingest merge.
 *
 * Sheet rows are parsed as {@link DataRow}; headers must match one alias per logical field.
 */

import type { DataRow } from './types';

/** Company / issuer display name */
export const DASHBOARD_COMPANY_NAME_COLUMNS = [
  'Company Name',
  'Company',
  'company',
] as const;

/** Ticker or symbol */
export const DASHBOARD_TICKER_COLUMNS = [
  'Ticker',
  'ticker',
  'Ticket',
  'ticket',
  'Symbol',
  'symbol',
] as const;

/**
 * ISM posture ingest (`mergeIsmIngestFromDashboardRows`): sector label **only** from these columns.
 * The generic `Industry` column is intentionally not used here.
 */
export const DASHBOARD_ISM_SECTOR_COLUMNS = ['SECTOR (ISM)', 'Sector (ISM)', 'sector (ism)'] as const;

/**
 * Score Board `industry` field and P/E sector median transform: sector key may come from
 * `SECTOR (ISM)` or legacy `Industry` / `INDUSTRY` headers.
 */
export const DASHBOARD_INDUSTRY_KEY_COLUMNS = [
  'SECTOR (ISM)',
  'Sector (ISM)',
  'sector (ism)',
  'INDUSTRY',
  'Industry',
  'industry',
] as const;

export const DASHBOARD_MARKET_CAP_COLUMNS = [
  'Market Cap',
  'Market cap',
  'MARKET CAP',
  'MarketCap',
  'marketcap',
  'MARKET_CAP',
  'MarketCap.',
] as const;

export const DASHBOARD_DATE_OF_UPDATE_COLUMNS = [
  'Date of Update',
  'date of update',
  'DATE OF UPDATE',
  'Date of update',
  'DATE_OF_UPDATE',
] as const;

/** Benjamin Graham + Score Board spot price */
export const DASHBOARD_PRICE_COLUMNS = ['Price', 'price', 'PRICE'] as const;

export const DASHBOARD_PE_COLUMNS = ['P/E', 'pe', 'PE'] as const;
export const DASHBOARD_PE1_COLUMNS = ['P/E1', 'P/E 1', 'pe1', 'PE1'] as const;
export const DASHBOARD_PE2_COLUMNS = ['P/E2', 'P/E 2', 'pe2', 'PE2'] as const;

/** Score Board required-style core metrics */
export const DASHBOARD_MUNGER_QUALITY_SCORE_COLUMNS = [
  'Munger Quality Score',
  'munger quality score',
  'MUNGER QUALITY SCORE',
] as const;

export const DASHBOARD_VALUE_CREATION_COLUMNS = [
  'VALUE CREATION',
  'Value Creation',
  'value creation',
  'VALUE_CREATION',
] as const;

export const DASHBOARD_LEVERAGE_F2_COLUMNS = ['Leverage F2', 'Leverage F2', 'leverage f2', 'LEVERAGE F2'] as const;

export const DASHBOARD_CURRENT_RATIO_COLUMNS = [
  'Current Ratio',
  'Current Ratio',
  'current ratio',
  'CURRENT RATIO',
] as const;

export const DASHBOARD_CASH_SDEBT_COLUMNS = ['Cash/SDebt', 'Cash/SDebt', 'cash/sdebt', 'CASH/SDEBT'] as const;

export const DASHBOARD_DATE_OF_VALUATION_COLUMNS = [
  'Date of Valuation',
  'DATE OF VALUATION',
  'date of valuation',
  'Date_of_Valuation',
  'DateOfValuation',
] as const;

export const DASHBOARD_FIVE_YEAR_BETA_COLUMNS = ['5Y Beta', '5y beta', '5Y BETA', '5Y beta'] as const;

export const DASHBOARD_FINAL_STATUS_COLUMNS = [
  'Final Status',
  'FINAL STATUS',
  'final status',
  'Final_Status',
  'FinalStatus',
] as const;

export const DASHBOARD_RISK_FLAG_COLUMNS = [
  'Risk Flag',
  'RISK FLAG',
  'risk flag',
  'Risk_Flag',
  'RiskFlag',
] as const;

export const DASHBOARD_VALUATION_SCORE_COLUMNS = [
  'Valuation Score',
  'VALUATION SCORE',
  'valuation score',
  'Valuation_Score',
  'ValuationScore',
] as const;

export const DASHBOARD_FORECAST_CONFIDENCE_COLUMNS = [
  'Forecast Confidence Verdict',
  'FORECAST CONFIDENCE VERDICT',
  'forecast confidence verdict',
  'Forecast Confidence',
  'FORECAST CONFIDENCE',
  'Forecast_Confidence_Verdict',
  'ForecastConfidenceVerdict',
] as const;

export const DASHBOARD_SANITY_SUMMARY_COLUMNS = [
  'Sanity Summary',
  'SANITY SUMMARY',
  'sanity summary',
  'Sanity_Summary',
  'SanitySummary',
] as const;

export const DASHBOARD_BUSINESS_QUALITY_SUMMARY_COLUMNS = [
  'Business Quality Summary',
  'BUSINESS QUALITY SUMMARY',
  'business quality summary',
  'Business_Quality_Summary',
  'BusinessQualitySummary',
] as const;

export const DASHBOARD_OPERATING_PILLAR_SCORE_COLUMNS = [
  'Operating Pillar Score',
  'OPERATING PILLAR SCORE',
  'operating pillar score',
  'Operating_Pillar_Score',
  'OperatingPillarScore',
] as const;

export const DASHBOARD_OVERALL_STRENGTH_COLUMNS = [
  'Overall Strength',
  'OVERALL STRENGTH',
  'overall strength',
  'Overall_Strength',
  'OverallStrength',
] as const;

export const DASHBOARD_STATUS_NOTE_COLUMNS = [
  'Status Note',
  'STATUS NOTE',
  'status note',
  'Short note',
  'SHORT NOTE',
  'short note',
  'Status_Note',
  'StatusNote',
] as const;

/** Benjamin Graham entry/exit / IV */
export const DASHBOARD_ENTRY_F1_COLUMNS = ['ENTRY F1', 'entry f1', 'Entry F1', 'ENTRY_F1'] as const;
export const DASHBOARD_EXIT_F1_COLUMNS = ['EXIT F1', 'exit f1', 'Exit F1', 'EXIT_F1'] as const;
export const DASHBOARD_EXIT_F2_COLUMNS = ['EXIT F2', 'exit f2', 'Exit F2', 'EXIT_F2'] as const;
export const DASHBOARD_IV_FCF_COLUMNS = ['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'] as const;
export const DASHBOARD_IRR1_COLUMNS = ['IRR1', 'irr1', 'IRR 1', 'irr 1', 'RR T1', 'rr t1'] as const;

/** Which logical fields each pipeline reads (for docs/tests). */
export const DASHBOARD_CONSUMER_FIELDS = {
  scoreBoard: [
    'companyName',
    'ticker',
    'mungerQualityScore',
    'valueCreation',
    'leverageF2',
    'currentRatio',
    'cashSdebt',
    'pe1',
    'pe2',
    'industry',
    'marketCap',
    'dashboardDateOfUpdate',
    'dateOfValuation',
    'price',
    'fiveYearBeta',
    'finalStatus',
    'riskFlag',
    'valuationScore',
    'forecastConfidenceVerdict',
    'sanitySummary',
    'businessQualitySummary',
    'operatingPillarScore',
    'overallStrength',
    'statusNote',
  ],
  benjaminGraham: ['companyName', 'ticker', 'price', 'entryF1', 'exitF1', 'exitF2', 'ivFcf', 'irr1'],
  peIndustry: ['companyName', 'ticker', 'industry', 'pe', 'pe1', 'pe2'],
  ismIngest: ['companyName', 'ticker', 'sectorIsm', 'marketCap', 'dashboardDateOfUpdate'],
} as const;

/** Cast readonly tuple to mutable string[] for `getValue` / `getValueAllowZero` */
export function asHeaderList(columns: readonly string[]): string[] {
  return [...columns];
}

/**
 * True if the row has at least one non-empty header matching a known DashBoard alias
 * (smoke check for parsed snapshots).
 */
export function dashboardRowHasKnownHeaders(row: DataRow): boolean {
  const keys = Object.keys(row);
  const allAliases = new Set<string>([
    ...DASHBOARD_COMPANY_NAME_COLUMNS,
    ...DASHBOARD_TICKER_COLUMNS,
    ...DASHBOARD_INDUSTRY_KEY_COLUMNS,
    ...DASHBOARD_ISM_SECTOR_COLUMNS,
  ]);
  return keys.some((k) => allAliases.has(k));
}
