/**
 * ISM ingest merge: DashBoard row data + currency from ENTRY/EXIT accessor only.
 * Supports ScoreBoardData (`mergeIsmIngestRows`) and raw sheet `DataRow`s (`mergeIsmIngestFromDashboardRows`).
 */

import type { ScoreBoardData, EntryExitData } from '../../types/stock';
import type { DataRow } from '../sheets/types';
import {
  asHeaderList,
  DASHBOARD_COMPANY_NAME_COLUMNS,
  DASHBOARD_DATE_OF_UPDATE_COLUMNS,
  DASHBOARD_ISM_SECTOR_COLUMNS,
  DASHBOARD_MARKET_CAP_COLUMNS,
  DASHBOARD_TICKER_COLUMNS,
} from '../sheets/dashboardSheetContract';
import {
  getValueAllowZero,
  isValidValue,
  parseNumericValueNullable,
} from '../sheets/dataTransformers';
import { buildSymbolId, normalizeTicker, parseTickerParts } from '../../utils/ism/tickerIdentity';
import type {
  ISMIngestQualityFlags,
  ISMInstrumentIngest,
  ISMIngestSummary,
  ISMReadinessHint,
} from '../../types/ismIngest';
import { ISM_READINESS_HINTS } from '../../types/ismIngest';

export type GetIsmCurrencyFn = (
  ticker: string,
  companyName: string
) => string | number | null | undefined;

function buildQualityFromPrimitives(input: {
  tickerRaw: string;
  sectorIsm: string;
  marketCap: number | null;
  dashboardDateOfUpdate: string | null;
  currencyTrimmed: string;
  parsedNeedsReview: boolean;
}): ISMIngestQualityFlags {
  const tickerTrim = input.tickerRaw.trim();
  const sectorTrim = input.sectorIsm.trim();
  return {
    missingTicker: !isValidValue(tickerTrim),
    missingSector: !isValidValue(sectorTrim),
    missingMarketCap: input.marketCap === null || input.marketCap === undefined,
    missingCurrency: input.currencyTrimmed.length === 0,
    missingDashboardDateOfUpdate:
      input.dashboardDateOfUpdate === null ||
      input.dashboardDateOfUpdate === undefined ||
      !isValidValue(String(input.dashboardDateOfUpdate)),
    tickerNeedsReview: input.parsedNeedsReview,
  };
}

function buildQualityFromScoreBoard(
  row: ScoreBoardData,
  currencyTrimmed: string,
  parsedNeedsReview: boolean
): ISMIngestQualityFlags {
  return buildQualityFromPrimitives({
    tickerRaw: row.ticker ?? '',
    sectorIsm: row.industry ?? '',
    marketCap: row.marketCap ?? null,
    dashboardDateOfUpdate: row.dashboardDateOfUpdate ?? null,
    currencyTrimmed,
    parsedNeedsReview,
  });
}

function hintsFromQuality(q: ISMIngestQualityFlags): ISMReadinessHint[] {
  const hints: ISMReadinessHint[] = [];
  if (q.tickerNeedsReview) hints.push(ISM_READINESS_HINTS.TICKER_PARSE_REVIEW);
  if (q.missingTicker) hints.push(ISM_READINESS_HINTS.MISSING_TICKER);
  if (q.missingSector) hints.push(ISM_READINESS_HINTS.MISSING_SECTOR);
  if (q.missingMarketCap) hints.push(ISM_READINESS_HINTS.MISSING_MARKET_CAP);
  if (q.missingCurrency) hints.push(ISM_READINESS_HINTS.MISSING_CURRENCY);
  if (q.missingDashboardDateOfUpdate) hints.push(ISM_READINESS_HINTS.MISSING_DASHBOARD_DATE);
  return hints;
}

/**
 * Merge Score Board rows with ENTRY/EXIT currency using ISM ticker identity.
 * Currency is read via the same contract as tables: `getFieldValue(ticker, companyName, 'currency')`.
 */
export function mergeIsmIngestRows(
  scoreBoardRows: ScoreBoardData[],
  getCurrency: GetIsmCurrencyFn
): ISMInstrumentIngest[] {
  return scoreBoardRows.map((row) => {
    const parsed = parseTickerParts(row.ticker);
    const currencyRaw = getCurrency(row.ticker, row.companyName);
    const currency =
      typeof currencyRaw === 'string' ? currencyRaw.trim() : String(currencyRaw ?? '').trim();

    const quality = buildQualityFromScoreBoard(row, currency, parsed.needsReview);
    const readinessHints = hintsFromQuality(quality);

    return {
      tickerRaw: row.ticker,
      tickerNormalized: normalizeTicker(row.ticker),
      symbolId: buildSymbolId(row.ticker),
      companyName: row.companyName,
      sectorIsm: row.industry ?? '',
      marketCap: row.marketCap ?? null,
      dashboardDateOfUpdate: row.dashboardDateOfUpdate ?? null,
      currency,
      quality,
      readinessHints,
    };
  });
}

const DASHBOARD_COMPANY_ALIASES = asHeaderList(DASHBOARD_COMPANY_NAME_COLUMNS);
const DASHBOARD_TICKER_ALIASES = asHeaderList(DASHBOARD_TICKER_COLUMNS);
const DASHBOARD_MARKET_CAP_ALIASES = asHeaderList(DASHBOARD_MARKET_CAP_COLUMNS);
const DASHBOARD_DATE_UPDATE_ALIASES = asHeaderList(DASHBOARD_DATE_OF_UPDATE_COLUMNS);

/**
 * Reads ISM sector string from DashBoard row (SECTOR (ISM) only; never Industry).
 */
export function readDashboardSectorIsm(row: DataRow): string {
  for (const col of DASHBOARD_ISM_SECTOR_COLUMNS) {
    const v = getValueAllowZero([col], row);
    if (isValidValue(v)) return v.trim();
  }
  return '';
}

function readValidDashboardTickerAndCompany(row: DataRow): { ticker: string; companyName: string } | null {
  const companyName = getValueAllowZero(DASHBOARD_COMPANY_ALIASES, row);
  const ticker = getValueAllowZero(DASHBOARD_TICKER_ALIASES, row);
  if (!isValidValue(companyName) || !isValidValue(ticker)) return null;
  return { ticker, companyName };
}

/**
 * Minimal ENTRY/EXIT seed rows from DashBoard snapshot (same filter as ISM merge).
 * Call `initializeFromData` before merging so `getFieldValue(..., 'currency')` resolves.
 */
export function buildEntryExitStubsFromDashboardRows(rows: DataRow[]): EntryExitData[] {
  const out: EntryExitData[] = [];
  for (const row of rows) {
    const hit = readValidDashboardTickerAndCompany(row);
    if (!hit) continue;
    out.push({
      companyName: hit.companyName,
      ticker: hit.ticker,
      currency: '',
      entry1: 0,
      entry2: 0,
      exit1: 0,
      exit2: 0,
      dateOfUpdate: null,
    });
  }
  return out;
}

/**
 * Merge official DashBoard `DataRow`s (Central Data Service / sheet snapshot) with ENTRY/EXIT currency only.
 */
export function mergeIsmIngestFromDashboardRows(
  rows: DataRow[],
  getCurrency: GetIsmCurrencyFn
): ISMInstrumentIngest[] {
  const out: ISMInstrumentIngest[] = [];
  for (const row of rows) {
    const base = readValidDashboardTickerAndCompany(row);
    if (!base) continue;

    const parsed = parseTickerParts(base.ticker);
    const currencyRaw = getCurrency(base.ticker, base.companyName);
    const currency =
      typeof currencyRaw === 'string' ? currencyRaw.trim() : String(currencyRaw ?? '').trim();

    const sectorIsm = readDashboardSectorIsm(row);
    const marketCapStr = getValueAllowZero(DASHBOARD_MARKET_CAP_ALIASES, row);
    const marketCap = parseNumericValueNullable(marketCapStr);
    const dashboardDateOfUpdateStr = getValueAllowZero(DASHBOARD_DATE_UPDATE_ALIASES, row);
    const dashboardDateOfUpdate = isValidValue(dashboardDateOfUpdateStr)
      ? dashboardDateOfUpdateStr.trim()
      : null;

    const quality = buildQualityFromPrimitives({
      tickerRaw: base.ticker,
      sectorIsm,
      marketCap,
      dashboardDateOfUpdate,
      currencyTrimmed: currency,
      parsedNeedsReview: parsed.needsReview,
    });
    const readinessHints = hintsFromQuality(quality);

    out.push({
      tickerRaw: base.ticker,
      tickerNormalized: normalizeTicker(base.ticker),
      symbolId: buildSymbolId(base.ticker),
      companyName: base.companyName,
      sectorIsm,
      marketCap,
      dashboardDateOfUpdate,
      currency,
      quality,
      readinessHints,
    });
  }
  return out;
}

export function summarizeIsmIngest(rows: ISMInstrumentIngest[]): ISMIngestSummary {
  return {
    rowCount: rows.length,
    withMissingCurrency: rows.filter((r) => r.quality.missingCurrency).length,
    withMissingMarketCap: rows.filter((r) => r.quality.missingMarketCap).length,
    withMissingSector: rows.filter((r) => r.quality.missingSector).length,
    withTickerNeedsReview: rows.filter((r) => r.quality.tickerNeedsReview).length,
  };
}
