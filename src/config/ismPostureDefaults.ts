/**
 * Central defaults and limits for ISM Posture & Positioning.
 * Does not register side effects or touch runtime data paths.
 */

import type {
  ISMDetailViewLocalSettings,
  ISMSeriesToggles,
} from '../types/ismPosturePositioning';

/** Default slope lookback (bars / sessions) */
export const ISM_SLOPE_LOOKBACK_DEFAULT = 20;

/** Default sector SMA length */
export const ISM_SECTOR_SMA_LENGTH_DEFAULT = 200;

/** Default relative-strength moving average length */
export const ISM_RS_MA_LENGTH_DEFAULT = 252;

/** Default breadth threshold (percent scale 0–100 as used by the module) */
export const ISM_BREADTH_THRESHOLD_DEFAULT = 60;

/** Max symbols the user can pin in the detail/compare UI */
export const ISM_MAX_SELECTED_STOCKS = 3;

/** Minimum count of qualified symbols required before deriving a sector regime */
export const ISM_MIN_QUALIFIED_FOR_REGIME = 10;

/** Target qualified count for treating sector coverage as "full" */
export const ISM_FULL_COVERAGE_TARGET = 30;

const DEFAULT_SERIES_TOGGLES: ISMSeriesToggles = {
  showSectorSma: true,
  showRsLine: true,
  showBreadth: true,
  showPrice: true,
};

/**
 * Default chart/table series visibility for a fresh detail session.
 */
export function getDefaultISMSeriesToggles(): ISMSeriesToggles {
  return { ...DEFAULT_SERIES_TOGGLES };
}

/**
 * Full default local settings for the ISM detail view (copy-safe).
 */
export function getDefaultISMDetailViewLocalSettings(): ISMDetailViewLocalSettings {
  return {
    slopeLookback: ISM_SLOPE_LOOKBACK_DEFAULT,
    sectorSmaLength: ISM_SECTOR_SMA_LENGTH_DEFAULT,
    rsMaLength: ISM_RS_MA_LENGTH_DEFAULT,
    breadthThreshold: ISM_BREADTH_THRESHOLD_DEFAULT,
    viewMode: 'combined',
    layoutMode: 'single',
    seriesToggles: getDefaultISMSeriesToggles(),
    timeframe: '1d',
  };
}

/**
 * Numeric limits and thresholds in one object (useful for validation UI).
 */
export const ISM_POSTURE_LIMITS = {
  slopeLookbackDefault: ISM_SLOPE_LOOKBACK_DEFAULT,
  sectorSmaLengthDefault: ISM_SECTOR_SMA_LENGTH_DEFAULT,
  rsMaLengthDefault: ISM_RS_MA_LENGTH_DEFAULT,
  breadthThresholdDefault: ISM_BREADTH_THRESHOLD_DEFAULT,
  maxSelectedStocks: ISM_MAX_SELECTED_STOCKS,
  minQualifiedForRegime: ISM_MIN_QUALIFIED_FOR_REGIME,
  fullCoverageTarget: ISM_FULL_COVERAGE_TARGET,
} as const;
