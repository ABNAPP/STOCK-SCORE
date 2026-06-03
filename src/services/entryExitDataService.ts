/**
 * Entry/exit values via value-insight-be GET /entry-exit (no client Firestore reads).
 */

import { fetchEntryExitFromApi, updateEntryExitFromApi } from './valueInsightClient';
import type { EntryExitApiRowDto, EntryExitValuesDto } from '../types/entryExitApi';
import type { User } from 'firebase/auth';

export type EntryExitValuesRecord = Record<
  string,
  {
    entry1: number;
    entry2: number;
    exit1: number;
    exit2: number;
    currency: string;
    dateOfUpdate: string | null;
  }
>;

export function entryExitRowsToRecord(rows: EntryExitApiRowDto[]): EntryExitValuesRecord {
  const values: EntryExitValuesRecord = {};
  for (const row of rows) {
    values[row.companyName] = {
      entry1: row.entry1,
      entry2: row.entry2,
      exit1: row.exit1,
      exit2: row.exit2,
      currency: row.currency,
      dateOfUpdate: row.dateOfUpdate,
    };
  }
  return values;
}

export async function loadEntryExitValuesFromApi(): Promise<EntryExitValuesRecord | null> {
  const body = await fetchEntryExitFromApi();
  if (!body.rows.length) return null;
  return entryExitRowsToRecord(body.rows);
}

export async function saveEntryExitValuesToApi(
  user: User,
  values: EntryExitValuesRecord
): Promise<void> {
  const payload: Record<string, EntryExitValuesDto> = {};
  for (const [companyName, row] of Object.entries(values)) {
    payload[companyName] = {
      entry1: row.entry1,
      entry2: row.entry2,
      exit1: row.exit1,
      exit2: row.exit2,
      currency: row.currency,
      dateOfUpdate: row.dateOfUpdate,
    };
  }
  await updateEntryExitFromApi({ values: payload }, user);
}
