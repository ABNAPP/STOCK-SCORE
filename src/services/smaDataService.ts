/**
 * SMA sheet data from value-insight-be GET /sma-data.
 * Server-side cache only — no Firestore or client snapshot cache.
 */

import { fetchSmaData } from './valueInsightClient';
import type { SmaDataRow } from '../types/smaDataApi';
import type { DataRow } from './sheets/types';

export interface SmaSheetData {
  headers: string[];
  rows: DataRow[];
  version: number | null;
  generatedAt: string | null;
}

let inFlight: Promise<SmaSheetData> | null = null;

function toDataRow(row: SmaDataRow): DataRow {
  const out: DataRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = undefined;
    } else if (typeof value === 'string' || typeof value === 'number') {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

async function loadSmaData(): Promise<SmaSheetData> {
  const response = await fetchSmaData();
  const { data } = response;
  return {
    headers: data.headers,
    rows: data.rows.map(toDataRow),
    version: data.version ?? response.version,
    generatedAt: data.generatedAt,
  };
}

/** Fetch SMA sheet rows (dedupes concurrent calls). */
export async function getSmaData(): Promise<SmaSheetData> {
  if (!inFlight) {
    inFlight = loadSmaData().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
