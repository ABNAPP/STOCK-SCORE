/**
 * Types for value-insight-be /sma-data API (matches SmaDataApiResponse on the server).
 */

export type SmaDataSource = 'apps-script' | 'csv';

export type SmaDataRow = Record<string, unknown>;

export interface SmaDataPayload {
  headers: string[];
  rows: SmaDataRow[];
  version: number | null;
  generatedAt: string | null;
}

export interface SmaDataApiResponse {
  data: SmaDataPayload;
  timestamp: number;
  ttl: number;
  version: number | null;
  source: SmaDataSource;
  refreshed: boolean;
  rowCount: number;
}

export interface SmaDataApiErrorBody {
  error?: string;
}
