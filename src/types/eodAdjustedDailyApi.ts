/**
 * Types for value-insight-be GET /eod-adjusted-daily.
 */

export interface EodAdjustedDailyBarDto {
  date: string;
  adjustedClose: number;
}

export interface EodAdjustedDailyEntryDto {
  eodSymbol: string;
  source?: 'cache' | 'refreshed' | string;
  barCount?: number;
  lastBarDate?: string | null;
  sessionDate?: string | null;
  range?: { from: string; to: string };
  bars?: EodAdjustedDailyBarDto[];
  schemaVersion?: number;
  generation?: number;
  fetchedAt?: string | null;
}

export interface EodAdjustedDailyFailedDto {
  eodSymbol: string;
  reason: string;
}

export interface EodAdjustedDailyApiResponse {
  targetSessionDate?: string;
  from?: string;
  to?: string;
  generation?: number | null;
  refreshedCount?: number;
  cachedCount?: number;
  failed?: EodAdjustedDailyFailedDto[];
  entries: EodAdjustedDailyEntryDto[];
}

export interface EodAdjustedDailyApiErrorBody {
  error?: string;
}
