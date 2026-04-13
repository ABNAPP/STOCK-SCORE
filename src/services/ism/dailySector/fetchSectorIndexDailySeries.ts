/**
 * Load many official `sector_index_daily` points for charting (read-only).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { addCalendarDays } from '../fetchEngine/dateUtils';
import { ISM_SECTOR_INDEX_DAILY_COLLECTION, ismSectorDailyDocId } from './ismDailySectorFirestorePersistence';
import { parseSectorIndexDailyDocument, type ParsedSectorIndexDaily } from './readSectorIndexDaily';

const CHUNK = 45;

function enumerateIsoDatesInclusive(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let d = fromIso;
  while (d <= toIso) {
    out.push(d);
    d = addCalendarDays(d, 1);
  }
  return out;
}

/**
 * Fetches one doc per calendar day in [fromIso, toIso]; skips missing days.
 */
export async function fetchSectorIndexDailyInRange(
  sectorId: string,
  fromIso: string,
  toIso: string,
  signal?: AbortSignal
): Promise<ParsedSectorIndexDaily[]> {
  const dates = enumerateIsoDatesInclusive(fromIso, toIso);
  const parsed: ParsedSectorIndexDaily[] = [];
  for (let i = 0; i < dates.length; i += CHUNK) {
    if (signal?.aborted) break;
    const slice = dates.slice(i, i + CHUNK);
    const chunk = await Promise.all(
      slice.map(async (iso) => {
        const ref = doc(db, ISM_SECTOR_INDEX_DAILY_COLLECTION, ismSectorDailyDocId(sectorId, iso));
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const data = snap.data() as Record<string, unknown>;
        if (data.sector_id !== sectorId || data.trade_date !== iso) return null;
        return parseSectorIndexDailyDocument(data);
      })
    );
    for (const row of chunk) {
      if (row) parsed.push(row);
    }
  }
  return parsed.sort((a, b) => (a.trade_date ?? '').localeCompare(b.trade_date ?? ''));
}
