/**
 * Main dashboard data from value-insight-be GET /main-data.
 * Server-side cache only — no Firestore or client snapshot cache.
 */

import { fetchMainData } from './valueInsightClient';
import type { MainDataRow } from '../types/mainDataApi';
import type { DataRow } from './sheets/types';

export interface MainData {
  headers: string[];
  rows: DataRow[];
  version: number | null;
  generatedAt: string | null;
}

let inFlight: Promise<MainData> | null = null;

function toDataRow(row: MainDataRow): DataRow {
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

async function loadMainData(): Promise<MainData> {
  const response = await fetchMainData();
  const { data } = response;
  return {
    headers: data.headers,
    rows: data.rows.map(toDataRow),
    version: data.version ?? response.version,
    generatedAt: data.generatedAt,
  };
}

/** Fetch main dashboard rows (dedupes concurrent calls). */
export async function getMainData(): Promise<MainData> {
  if (!inFlight) {
    inFlight = loadMainData().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
