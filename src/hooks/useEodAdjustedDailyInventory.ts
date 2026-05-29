import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTION_EOD_ADJUSTED_DAILY } from '../services/ism/dailySector/eodAdjustedFirestoreCache';
import { logger } from '../utils/logger';

export type EodAdjustedDailyInventoryRow = Record<string, string | number>;

const SYSTEM_EOD_ADJUSTED_CACHE = 'eodAdjustedCache';

function lastBarDateFromBars(bars: unknown): string {
  if (!Array.isArray(bars) || bars.length === 0) return '—';
  const dates: string[] = [];
  for (const row of bars) {
    if (!row || typeof row !== 'object') continue;
    const d = (row as Record<string, unknown>).date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) dates.push(d);
  }
  if (dates.length === 0) return '—';
  dates.sort((a, b) => a.localeCompare(b));
  return dates[dates.length - 1]!;
}

function formatFirestoreTime(value: unknown): string {
  if (value == null) return '—';
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }
  return '—';
}

export type UseEodAdjustedDailyInventoryResult = {
  rows: EodAdjustedDailyInventoryRow[];
  loading: boolean;
  error: string | null;
  globalGeneration: number | null;
  docCount: number;
  refresh: () => Promise<void>;
};

export function useEodAdjustedDailyInventory(user: User | null): UseEodAdjustedDailyInventoryResult {
  const [rows, setRows] = useState<EodAdjustedDailyInventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalGeneration, setGlobalGeneration] = useState<number | null>(null);
  const [docCount, setDocCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setDocCount(0);
      setGlobalGeneration(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sysSnap = await getDoc(doc(db, 'system', SYSTEM_EOD_ADJUSTED_CACHE));
      let gen: number | null = null;
      if (sysSnap.exists()) {
        const g = sysSnap.data()?.generation;
        gen = typeof g === 'number' && Number.isFinite(g) && g > 0 ? g : null;
      }
      setGlobalGeneration(gen);

      const col = collection(db, COLLECTION_EOD_ADJUSTED_DAILY);
      const snap = await getDocs(col);
      const list: EodAdjustedDailyInventoryRow[] = [];

      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const bars = data.bars;
        const barCount = Array.isArray(bars) ? bars.length : 0;
        const range = data.range as { from?: string; to?: string } | undefined;
        const docGen = data.generation;
        const docGenNum = typeof docGen === 'number' && Number.isFinite(docGen) ? docGen : null;
        const match =
          gen == null
            ? '—'
            : docGenNum == null
              ? 'No'
              : docGenNum === gen
                ? 'Yes'
                : 'No';

        list.push({
          eodSymbol: d.id,
          docGeneration: docGenNum != null ? String(docGenNum) : '—',
          matchesGlobal: match,
          rangeFrom: range?.from && typeof range.from === 'string' ? range.from : '—',
          rangeTo: range?.to && typeof range.to === 'string' ? range.to : '—',
          barCount,
          lastBarDate: lastBarDateFromBars(bars),
          schemaVersion:
            data.schemaVersion != null && data.schemaVersion !== '' ? String(data.schemaVersion) : '—',
          fetchedAt: formatFirestoreTime(data.fetchedAt),
        });
      }

      list.sort((a, b) => String(a.eodSymbol).localeCompare(String(b.eodSymbol)));
      const numbered = list.map((row, i) => ({ ...row, no: i + 1 }));
      setRows(numbered);
      setDocCount(numbered.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('useEodAdjustedDailyInventory: load failed', { error: msg });
      setError(msg);
      setRows([]);
      setDocCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { rows, loading, error, globalGeneration, docCount, refresh };
}
