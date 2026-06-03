/**
 * Loads latest official sector index overview via value-insight-be (no client Firestore).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { ISMInstrumentIngest } from '../types/ismIngest';
import type { IsmOverviewSectorRow } from '../types/ismSectorOverview';
import { ismSectorIdFromName } from '../services/ism/rebalance/sectorSlug';
import { fetchIsmSectorOverviewFromApi } from '../services/valueInsightClient';

export type { IsmOverviewSectorRow } from '../types/ismSectorOverview';

export function buildIsmSectorUniverseFromIngest(rows: ISMInstrumentIngest[]): { sectorId: string; displayName: string }[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    const raw = typeof r.sectorIsm === 'string' ? r.sectorIsm.trim() : '';
    if (!raw) continue;
    const id = ismSectorIdFromName(raw);
    if (!map.has(id)) map.set(id, raw);
  }
  return [...map.entries()]
    .map(([sectorId, displayName]) => ({ sectorId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

export type UseIsmSectorOverviewDataResult = {
  sectors: IsmOverviewSectorRow[];
  firestoreLoading: boolean;
  firestoreError: string | null;
  refetch: () => Promise<void>;
};

export function useIsmSectorOverviewData(
  ingestRows: ISMInstrumentIngest[],
  ingestLoading: boolean
): UseIsmSectorOverviewDataResult {
  const { currentUser } = useAuth();
  const universe = useMemo(() => buildIsmSectorUniverseFromIngest(ingestRows), [ingestRows]);
  const sectorIds = useMemo(() => universe.map((u) => u.sectorId), [universe]);
  const [sectors, setSectors] = useState<IsmOverviewSectorRow[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) {
      setSectors([]);
      setFirestoreError(null);
      setFirestoreLoading(false);
      return;
    }
    if (ingestLoading) return;

    setFirestoreLoading(true);
    setFirestoreError(null);
    try {
      const body = await fetchIsmSectorOverviewFromApi(sectorIds.length > 0 ? sectorIds : undefined);
      const displayById = new Map(universe.map((u) => [u.sectorId, u.displayName]));
      setSectors(
        body.sectors.map((row) => ({
          ...row,
          sectorDisplayName: displayById.get(row.sectorId) ?? row.sectorDisplayName,
        }))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFirestoreError(msg);
      setSectors([]);
    } finally {
      setFirestoreLoading(false);
    }
  }, [currentUser, ingestLoading, sectorIds, universe]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sectors, firestoreLoading, firestoreError, refetch: load };
}
