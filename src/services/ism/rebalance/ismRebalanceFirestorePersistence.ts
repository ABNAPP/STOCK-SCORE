/**
 * Persist validated weekly sector rebalance snapshots under `sector_rebalances/{sectorId}/snapshots/{rebalanceDate}`.
 * Invalid snapshots are not activated; prior `is_active` docs for that sector are left unchanged on failure.
 */

import type { User } from 'firebase/auth';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logger } from '../../../utils/logger';
import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import type { IsmFetchEngineState } from '../fetchEngine/types';
import {
  computeSectorRebalanceSnapshot,
  type PreviousSectorRebalanceMeta,
  type RebalanceRowInput,
} from './computeWeeklySectorRebalance';
import { validateSectorRebalanceSnapshot } from './validateRebalanceSnapshot';
import { ismSectorIdFromName } from './sectorSlug';

export const ISM_SECTOR_REBALANCES_COLLECTION = 'sector_rebalances';
const SNAPSHOTS = 'snapshots';

export type RunWeeklyIsmRebalanceArgs = {
  rows: ISMInstrumentIngest[];
  rebalanceDate: string;
  rebalanceTimestampMs: number;
  marketCapSnapshotTimestampMs: number;
  priceSnapshotTimestampMs: number;
  fxSnapshotTimestampMs: number;
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean;
  usdPerUnitByCurrency: Map<string, number | null>;
  fetchEngineState: IsmFetchEngineState | null;
  latestPriceDateBySymbolId?: Record<string, string | null>;
  latestCloseBySymbolId?: Record<string, number | null>;
  previousBySectorId: Map<string, PreviousSectorRebalanceMeta>;
};

export type SectorRebalanceRunItem = {
  sector_id: string;
  persisted: boolean;
  errors?: string[];
};

function groupBySector(rows: ISMInstrumentIngest[]): Map<string, ISMInstrumentIngest[]> {
  const m = new Map<string, ISMInstrumentIngest[]>();
  for (const r of rows) {
    const key = r.sectorIsm.trim() || 'Unknown';
    const list = m.get(key) ?? [];
    list.push(r);
    m.set(key, list);
  }
  return m;
}

function toRowInputs(
  sectorRows: ISMInstrumentIngest[],
  args: RunWeeklyIsmRebalanceArgs
): RebalanceRowInput[] {
  return sectorRows.map((ingest) => {
    const cur = ingest.currency.trim().toUpperCase();
    const usd =
      ingest.currency.trim().length > 0 ? args.usdPerUnitByCurrency.get(cur) ?? null : null;
    return {
      ingest,
      hasEntryExitRow: args.getHasEntryExitRow(ingest.tickerRaw, ingest.companyName),
      usdPerUnitLocalCurrency: usd,
      fetchState: args.fetchEngineState?.perSymbol[ingest.symbolId],
      latestPriceDateIso: args.latestPriceDateBySymbolId?.[ingest.symbolId],
    };
  });
}

export async function persistValidatedSectorRebalanceSnapshot(
  user: User | null,
  sectorId: string,
  rebalanceDate: string,
  snapshot: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (!user) return { ok: false, errors: ['no_user'] };
  const v = validateSectorRebalanceSnapshot(snapshot);
  if (!v.ok) {
    logger.warn('ISM sector rebalance snapshot rejected by validation', {
      component: 'ismRebalanceFirestore',
      sectorId,
      rebalanceDate,
      errors: v.errors,
    });
    return { ok: false, errors: v.errors };
  }

  try {
    const snapCol = collection(db, ISM_SECTOR_REBALANCES_COLLECTION, sectorId, SNAPSHOTS);
    const existing = await getDocs(snapCol);
    const batch = writeBatch(db);
    const newRef = doc(snapCol, rebalanceDate);

    existing.forEach((s) => {
      if (s.id !== rebalanceDate && s.data()?.is_active === true) {
        batch.update(s.ref, { is_active: false, updated_at: serverTimestamp() });
      }
    });

    batch.set(
      newRef,
      {
        ...snapshot,
        is_active: true,
        snapshot_valid: true,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('ISM sector rebalance persist failed', e instanceof Error ? e : new Error(msg), {
      component: 'ismRebalanceFirestore',
      sectorId,
      rebalanceDate,
    });
    return { ok: false, errors: [msg] };
  }
}

/**
 * Computes and persists one snapshot per sector. Skips persist when validation fails (prior active unchanged).
 */
export async function runWeeklyIsmSectorRebalances(
  user: User | null,
  args: RunWeeklyIsmRebalanceArgs
): Promise<SectorRebalanceRunItem[]> {
  if (!user || args.rows.length === 0) return [];

  const grouped = groupBySector(args.rows);
  const out: SectorRebalanceRunItem[] = [];

  for (const [sectorName, sectorRows] of grouped) {
    const sectorId = ismSectorIdFromName(sectorName);
    const rowInputs = toRowInputs(sectorRows, args);
    const snapshot = computeSectorRebalanceSnapshot({
      sectorName,
      rows: rowInputs,
      rebalanceDate: args.rebalanceDate,
      rebalanceTimestampMs: args.rebalanceTimestampMs,
      marketCapSnapshotTimestampMs: args.marketCapSnapshotTimestampMs,
      priceSnapshotTimestampMs: args.priceSnapshotTimestampMs,
      fxSnapshotTimestampMs: args.fxSnapshotTimestampMs,
      fetchEngineState: args.fetchEngineState,
      previous: args.previousBySectorId.get(sectorId) ?? null,
      latestCloseBySymbolId: args.latestCloseBySymbolId,
    });

    const res = await persistValidatedSectorRebalanceSnapshot(user, sectorId, args.rebalanceDate, snapshot);
    out.push({
      sector_id: sectorId,
      persisted: res.ok,
      errors: res.ok ? undefined : res.errors,
    });
  }

  return out;
}
