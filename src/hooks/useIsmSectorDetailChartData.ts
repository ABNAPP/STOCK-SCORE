import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchIsmSectorDailySeriesFromApi } from '../services/valueInsightClient';
import { addCalendarDays, isoTodayUtc } from '../services/ism/fetchEngine/dateUtils';
import { dailyRowsToChartPoints, type IsmSectorChartPoint } from '../components/ism/ismSectorChartModel';
import type { ParsedSectorIndexDaily } from '../services/ism/dailySector/readSectorIndexDaily';

export type IsmChartTimeframeYears = 1 | 2 | 3 | 4 | 5;

export function isoRangeForChartYears(years: IsmChartTimeframeYears): { fromIso: string; toIso: string } {
  const toIso = isoTodayUtc();
  const fromIso = addCalendarDays(toIso, -Math.round(365.25 * years));
  return { fromIso, toIso };
}

export type UseIsmSectorDetailChartDataResult = {
  points: IsmSectorChartPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useIsmSectorDetailChartData(
  sectorId: string | null,
  years: IsmChartTimeframeYears,
  enabled: boolean
): UseIsmSectorDetailChartDataResult {
  const [rows, setRows] = useState<IsmSectorChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fromIso, toIso } = useMemo(() => isoRangeForChartYears(years), [years]);

  const load = useCallback(async () => {
    if (!sectorId || !enabled) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await fetchIsmSectorDailySeriesFromApi(sectorId, fromIso, toIso);
      setRows(dailyRowsToChartPoints(body.rows as ParsedSectorIndexDaily[]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sectorId, fromIso, toIso, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { points: rows, loading, error, refetch: load };
}
