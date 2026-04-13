/**
 * Orchestrates one official daily sector row: active weekly snapshot + shared row metrics + pure daily math + persist.
 */

import type { User } from 'firebase/auth';
import { ISM_FULL_COVERAGE_TARGET } from '../../../config/ismPostureDefaults';
import type { RebalanceRowInput } from '../rebalance/computeWeeklySectorRebalance';
import { computeIsmRebalanceRowMetrics } from '../rebalance/ismRebalanceRowMetrics';
import { computeDailySectorIndexRow, sliceActiveRebalanceFromFirestore } from './computeDailySectorIndex';
import { loadActiveSectorRebalanceSnapshot, persistDailySectorIndexDoc } from './ismDailySectorFirestorePersistence';

export type RunDailyIsmSectorIndexArgs = {
  user: User | null;
  sectorId: string;
  tradeDate: string;
  /** Same row shape as weekly rebalance (cap/FX/qualification via `computeIsmRebalanceRowMetrics`). */
  rows: RebalanceRowInput[];
  latestCloseBySymbolId: Record<string, number | null | undefined>;
  spy_close_history: number[];
  sector_index_history: number[];
  constituent_close_history_by_symbol_id: Record<string, number[]>;
  /** Optional; defaults to first bar in `sector_index_history`. */
  reference_sector_index?: number;
  /** Optional; defaults to first bar in `spy_close_history`. */
  reference_spy_close?: number;
  price_snapshot_timestamp_ms?: number | null;
  fx_snapshot_timestamp_ms?: number | null;
};

export type RunDailyIsmSectorIndexResult = { ok: true } | { ok: false; error: string };

/**
 * Loads latest active `sector_rebalances/.../snapshots`, derives qualified/top counts like weekly logic, computes daily row, persists `sector_index_daily/{sectorId}_{tradeDate}`.
 */
export async function runDailyIsmSectorIndex(args: RunDailyIsmSectorIndexArgs): Promise<RunDailyIsmSectorIndexResult> {
  const snapRaw = await loadActiveSectorRebalanceSnapshot(args.user, args.sectorId);
  if (!snapRaw) return { ok: false, error: 'no_active_snapshot' };
  const slice = sliceActiveRebalanceFromFirestore(snapRaw);
  if (!slice || slice.sector_id !== args.sectorId) return { ok: false, error: 'bad_snapshot' };

  const metrics = args.rows.map((r) =>
    computeIsmRebalanceRowMetrics({
      ingest: r.ingest,
      hasEntryExitRow: r.hasEntryExitRow,
      usdPerUnitLocalCurrency: r.usdPerUnitLocalCurrency,
      fetchState: r.fetchState,
      latestPriceDateIso: r.latestPriceDateIso,
    })
  );
  const qualified = metrics.filter((m) => m.qualified);
  const ranked = [...qualified].sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));
  const top = ranked.slice(0, ISM_FULL_COVERAGE_TARGET);
  const qualified_count = qualified.length;
  const excluded_count = args.rows.length - top.length;
  const needs_review_count = metrics.filter((x) => x.needsReview).length;

  const refS = args.reference_sector_index ?? args.sector_index_history[0];
  const refP = args.reference_spy_close ?? args.spy_close_history[0];
  if (refS == null || !Number.isFinite(refS) || refS <= 0 || refP == null || !Number.isFinite(refP) || refP <= 0) {
    return { ok: false, error: 'bad_reference_for_rs' };
  }

  const row = computeDailySectorIndexRow({
    trade_date: args.tradeDate,
    snapshot: slice,
    latestCloseBySymbolId: args.latestCloseBySymbolId,
    spy_close_history: args.spy_close_history,
    sector_index_history: args.sector_index_history,
    constituent_close_history_by_symbol_id: args.constituent_close_history_by_symbol_id,
    qualified_count,
    excluded_count,
    needs_review_count,
    reference_sector_index: refS,
    reference_spy_close: refP,
    computed_at_ms: Date.now(),
    price_snapshot_timestamp_ms: args.price_snapshot_timestamp_ms,
    fx_snapshot_timestamp_ms: args.fx_snapshot_timestamp_ms,
  });

  const ok = await persistDailySectorIndexDoc({
    user: args.user,
    sectorId: args.sectorId,
    tradeDate: args.tradeDate,
    row,
  });
  return ok ? { ok: true } : { ok: false, error: 'persist_failed' };
}
