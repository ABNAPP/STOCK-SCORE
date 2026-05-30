import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  clearEodAdjustedBarsIndex,
  reloadEodAdjustedInventory,
} from '../services/eodAdjustedDataService';
import { logger } from '../utils/logger';

export type EodAdjustedDailyInventoryRow = Record<string, string | number>;

export type EodAdjustedDailyFailedRow = Record<string, string | number>;

export type UseEodAdjustedDailyInventoryResult = {
  rows: EodAdjustedDailyInventoryRow[];
  failedRows: EodAdjustedDailyFailedRow[];
  loading: boolean;
  error: string | null;
  globalGeneration: number | null;
  docCount: number;
  failedCount: number;
  targetSessionDate: string | null;
  refresh: () => Promise<void>;
};

export function useEodAdjustedDailyInventory(user: User | null): UseEodAdjustedDailyInventoryResult {
  const [rows, setRows] = useState<EodAdjustedDailyInventoryRow[]>([]);
  const [failedRows, setFailedRows] = useState<EodAdjustedDailyFailedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalGeneration, setGlobalGeneration] = useState<number | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [targetSessionDate, setTargetSessionDate] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setFailedRows([]);
      setDocCount(0);
      setGlobalGeneration(null);
      setTargetSessionDate(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setFailedRows([]);
    clearEodAdjustedBarsIndex();
    try {
      const res = await reloadEodAdjustedInventory();
      const gen =
        typeof res.generation === 'number' && Number.isFinite(res.generation) && res.generation > 0
          ? res.generation
          : null;
      setGlobalGeneration(gen);
      setTargetSessionDate(res.targetSessionDate ?? null);

      const list: EodAdjustedDailyInventoryRow[] = res.entries.map((entry, index) => {
        const docGen =
          typeof entry.generation === 'number' && Number.isFinite(entry.generation)
            ? entry.generation
            : null;
        const match =
          gen == null
            ? '—'
            : docGen == null
              ? '—'
              : docGen === gen
                ? 'Yes'
                : 'No';

        return {
          no: index + 1,
          eodSymbol: entry.eodSymbol,
          source: entry.source ?? '—',
          docGeneration: docGen != null ? String(docGen) : '—',
          matchesGlobal: match,
          rangeFrom: entry.range?.from ?? '—',
          rangeTo: entry.range?.to ?? '—',
          barCount: entry.barCount ?? (entry.bars?.length ?? 0),
          lastBarDate: entry.lastBarDate ?? '—',
          schemaVersion: entry.schemaVersion != null ? String(entry.schemaVersion) : '—',
          fetchedAt: entry.fetchedAt ?? '—',
        };
      });

      list.sort((a, b) => String(a.eodSymbol).localeCompare(String(b.eodSymbol)));
      const numbered = list.map((row, i) => ({ ...row, no: i + 1 }));
      setRows(numbered);
      setDocCount(numbered.length);

      const failedList: EodAdjustedDailyFailedRow[] = (res.failed ?? [])
        .filter((f) => typeof f.eodSymbol === 'string' && f.eodSymbol.length > 0)
        .map((f) => ({
          eodSymbol: f.eodSymbol,
          reason: typeof f.reason === 'string' && f.reason.length > 0 ? f.reason : '—',
        }));
      failedList.sort((a, b) => String(a.eodSymbol).localeCompare(String(b.eodSymbol)));
      setFailedRows(failedList.map((row, i) => ({ ...row, no: i + 1 })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('useEodAdjustedDailyInventory: load failed', { error: msg });
      setError(msg);
      setRows([]);
      setFailedRows([]);
      setDocCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    rows,
    failedRows,
    loading,
    error,
    globalGeneration,
    docCount,
    failedCount: failedRows.length,
    targetSessionDate,
    refresh,
  };
}
