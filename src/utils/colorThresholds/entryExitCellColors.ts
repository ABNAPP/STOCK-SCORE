/**
 * Entry/Exit cell color logic for SCORE table.
 * Green for Entry when price <= entry * 1.05 (includes all prices below entry).
 * Red for Exit when price >= exit * 0.95 (includes at exit and all prices above exit).
 */

import {
  PRICE_TOLERANCE_GREEN,
  PRICE_TOLERANCE_RED_EXIT_LOW,
} from '../../config/constants';

export function isEntry1GreenForCell(
  price: number | null | undefined,
  entry1: number
): boolean {
  return (
    price !== null &&
    price !== undefined &&
    price > 0 &&
    entry1 > 0 &&
    price <= entry1 * PRICE_TOLERANCE_GREEN
  );
}

export function isEntry2GreenForCell(
  price: number | null | undefined,
  entry2: number
): boolean {
  return (
    price !== null &&
    price !== undefined &&
    price > 0 &&
    entry2 > 0 &&
    price <= entry2 * PRICE_TOLERANCE_GREEN
  );
}

export function isExit1RedForCell(
  price: number | null | undefined,
  exit1: number
): boolean {
  return (
    price !== null &&
    price !== undefined &&
    price > 0 &&
    exit1 > 0 &&
    price >= exit1 * PRICE_TOLERANCE_RED_EXIT_LOW
  );
}

export function isExit2RedForCell(
  price: number | null | undefined,
  exit2: number
): boolean {
  return (
    price !== null &&
    price !== undefined &&
    price > 0 &&
    exit2 > 0 &&
    price >= exit2 * PRICE_TOLERANCE_RED_EXIT_LOW
  );
}
