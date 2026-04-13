/**
 * Prepared rows for the ISM sector detail constituent table (active weekly basket only).
 * Shaped for `BaseTable`-style consumers: stable keys, sortable numerics, booleans.
 */

export type IsmBasketConstituentTableRow = {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  /** Floating cap weight within active priced basket (0–100), null if no usable last close. */
  currentWeightPct: number | null;
  /** (last / SMA − 1) × 100 using local SMA length on own closes. */
  priceVsSmaPct: number | null;
  /** SMA(price) rising over `slopeLookback` sessions (local). */
  smaSlopeRising: boolean | null;
  /** Price above SMA and SMA rising (local), same rule as official daily breadth per name. */
  inBreadth: boolean | null;
  /**
   * Contribution to headline weighted breadth in percentage points:
   * `inBreadth ? (w / breadthDen) * 100 : 0` for breadth-eligible names; null if excluded from breadth denominator.
   */
  breadthContributionPct: number | null;
  /** True when this basket symbol is in chart `stockIds` (selection is orthogonal to basket membership). */
  isSelected: boolean;
} & Record<string, unknown>;
