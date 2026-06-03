/**
 * Types for value-insight-be GET /entry-exit
 */

export interface EntryExitApiRowDto {
  companyName: string;
  docId: string;
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  currency: string;
  dateOfUpdate: string | null;
}

export interface EntryExitApiResponse {
  rows: EntryExitApiRowDto[];
  rowCount: number;
  loadedAt: number;
}

export interface EntryExitApiErrorBody {
  error?: string;
}

export type EntryExitValuesDto = {
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  currency: string;
  dateOfUpdate: string | null;
};

export interface EntryExitUpdateApiRequest {
  values: Record<string, EntryExitValuesDto>;
}

export interface EntryExitUpdateApiResponse {
  ok: true;
  writtenCount: number;
}
