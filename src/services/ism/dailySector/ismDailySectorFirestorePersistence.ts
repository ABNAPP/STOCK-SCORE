/**
 * Daily official sector index rows: `sector_index_daily/{sectorId}_{tradeDate}`.
 * Reads active weekly snapshot from `sector_rebalances/{sectorId}/snapshots/{rebalanceDate}`.
 */

import type { User } from 'firebase/auth';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logger } from '../../../utils/logger';
import { ISM_SECTOR_DAILY_SCHEMA_VERSION } from '../../../types/ismSectorDailyIndex';
import { ISM_SECTOR_REBALANCES_COLLECTION } from '../rebalance/ismRebalanceFirestorePersistence';

const SNAPSHOTS = 'snapshots';

export const ISM_SECTOR_INDEX_DAILY_COLLECTION = 'sector_index_daily';

export function ismSectorDailyDocId(sectorId: string, tradeDate: string): string {
  return `${sectorId}_${tradeDate}`;
}

/**
 * Latest active weekly rebalance snapshot for a sector (by rebalance_timestamp).
 */
export type ActiveSectorRebalanceSnapshotRead = {
  snapshot: Record<string, unknown> | null;
  usingPreviousActiveSnapshot: boolean;
};

/**
 * Returns the active snapshot plus whether a newer snapshot exists but is not active.
 */
export async function loadActiveSectorRebalanceSnapshotWithMeta(
  user: User | null,
  sectorId: string
): Promise<ActiveSectorRebalanceSnapshotRead> {
  if (!user) {
    logger.warn('loadActiveSectorRebalanceSnapshotWithMeta: no user');
    return { snapshot: null, usingPreviousActiveSnapshot: false };
  }
  const colRef = collection(db, ISM_SECTOR_REBALANCES_COLLECTION, sectorId, SNAPSHOTS);
  const snap = await getDocs(colRef);
  let bestActive: { data: Record<string, unknown>; ts: number } | null = null;
  let newestSnapshotTs = 0;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const ts = typeof data.rebalance_timestamp === 'number' ? data.rebalance_timestamp : 0;
    if (ts > newestSnapshotTs) newestSnapshotTs = ts;
    if (data.is_active !== true) continue;
    if (!bestActive || ts > bestActive.ts) bestActive = { data, ts };
  }
  return {
    snapshot: bestActive?.data ?? null,
    usingPreviousActiveSnapshot: !!bestActive && newestSnapshotTs > bestActive.ts,
  };
}

/**
 * Latest active weekly rebalance snapshot for a sector (by rebalance_timestamp).
 */
export async function loadActiveSectorRebalanceSnapshot(
  user: User | null,
  sectorId: string
): Promise<Record<string, unknown> | null> {
  const res = await loadActiveSectorRebalanceSnapshotWithMeta(user, sectorId);
  return res.snapshot;
}

export type PersistDailySectorIndexArgs = {
  user: User | null;
  sectorId: string;
  tradeDate: string;
  row: Record<string, unknown>;
};

/**
 * Writes daily row; merges `updated_at` server-side. Caller supplies `computed_at` in `row`.
 */
export async function persistDailySectorIndexDoc(args: PersistDailySectorIndexArgs): Promise<boolean> {
  if (!args.user) {
    logger.warn('persistDailySectorIndexDoc: no user');
    return false;
  }
  const docId = ismSectorDailyDocId(args.sectorId, args.tradeDate);
  if (args.row.ism_sector_daily_schema_version !== ISM_SECTOR_DAILY_SCHEMA_VERSION) {
    logger.error('persistDailySectorIndexDoc: bad schema version');
    return false;
  }
  if (args.row.sector_id !== args.sectorId || args.row.trade_date !== args.tradeDate) {
    logger.error('persistDailySectorIndexDoc: sector_id/trade_date mismatch');
    return false;
  }
  const ref = doc(db, ISM_SECTOR_INDEX_DAILY_COLLECTION, docId);
  await setDoc(
    ref,
    {
      ...args.row,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}
