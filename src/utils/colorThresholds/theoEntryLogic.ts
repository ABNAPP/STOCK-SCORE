/**
 * TheoEntry (RR1/RR2) green logic.
 * Used by calculateScore, calculateScoreDetailed, ScoreBoardTable.
 */

import type { EntryExitValuesForScore } from '../../types/score';
import {
  PRICE_TOLERANCE_GREEN,
  RR1_GREEN_THRESHOLD_PERCENT,
} from '../../config/constants';

function calculateRR1(entry1: number, exit1: number): number | null {
  if (!entry1 || !exit1 || entry1 === 0) return null;
  const rr1 = ((exit1 - entry1) / entry1) * 100;
  return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
}

function calculateRR2(entry2: number, exit2: number): number | null {
  if (!entry2 || !exit2 || entry2 === 0) return null;
  const rr2 = ((exit2 - entry2) / entry2) * 100;
  return isNaN(rr2) || !isFinite(rr2) ? null : rr2;
}

export function isRR1Green(
  entryExitValues: EntryExitValuesForScore | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  const entry1 = entryExitValues.entry1 || 0;
  const exit1 = entryExitValues.exit1 || 0;
  const rr1 = calculateRR1(entry1, exit1);
  return (
    rr1 !== null &&
    rr1 >= RR1_GREEN_THRESHOLD_PERCENT &&
    price !== null &&
    price !== undefined &&
    price > 0 &&
    entry1 > 0 &&
    price <= entry1 * PRICE_TOLERANCE_GREEN
  );
}

export function isEntry1Green(
  entryExitValues: EntryExitValuesForScore | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  const entry1 = entryExitValues.entry1 || 0;
  return (
    entry1 > 0 &&
    price !== null &&
    price !== undefined &&
    price > 0 &&
    price <= entry1 * PRICE_TOLERANCE_GREEN
  );
}

export function isRR2GreenForTheoEntry(
  entryExitValues: EntryExitValuesForScore | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  const entry2 = entryExitValues.entry2 || 0;
  const exit2 = entryExitValues.exit2 || 0;
  const rr2 = calculateRR2(entry2, exit2);
  return (
    rr2 !== null &&
    rr2 > RR1_GREEN_THRESHOLD_PERCENT &&
    price !== null &&
    price !== undefined &&
    price > 0 &&
    entry2 > 0 &&
    price <= entry2 * PRICE_TOLERANCE_GREEN
  );
}

export function isEntry2Green(
  entryExitValues: EntryExitValuesForScore | undefined,
  price: number | null | undefined
): boolean {
  if (!entryExitValues) return false;
  const entry2 = entryExitValues.entry2 || 0;
  return (
    entry2 > 0 &&
    price !== null &&
    price !== undefined &&
    price > 0 &&
    price <= entry2 * PRICE_TOLERANCE_GREEN
  );
}

export function isTheoEntryGreen(
  entryExitValues: EntryExitValuesForScore | undefined,
  price: number | null | undefined
): boolean {
  const rr1Path = isRR1Green(entryExitValues, price) && isEntry1Green(entryExitValues, price);
  const rr2Path =
    isRR2GreenForTheoEntry(entryExitValues, price) && isEntry2Green(entryExitValues, price);
  return rr1Path || rr2Path;
}
