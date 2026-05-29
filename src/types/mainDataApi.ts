/**
 * Types for value-insight-be /main-data API (matches MainDataApiResponse on the server).
 */

export type MainDataSource = 'apps-script' | 'csv';

export type MainDataRow = Record<string, unknown>;

export interface MainDataPayload {
  headers: string[];
  rows: MainDataRow[];
  version: number | null;
  generatedAt: string | null;
}

export interface MainDataApiResponse {
  data: MainDataPayload;
  timestamp: number;
  ttl: number;
  version: number | null;
  source: MainDataSource;
  refreshed: boolean;
  rowCount: number;
}

export interface MainDataApiErrorBody {
  error?: string;
}
