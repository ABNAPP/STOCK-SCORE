/**
 * Types for ISM Posture & Positioning (sector posture, coverage, regime, sizing).
 * Data fetching and UI wiring are implemented separately; this module is types-only.
 */

// --- Coverage / regime / sizing (enums as string unions) ---

export type ISMSectorCoverageStatus = 'data_building' | 'limited' | 'full';

export type ISMRegime = 'strong' | 'transition' | 'weak' | 'not_available';

export type ISMAllowedSizing = 'core_allowed' | 'probe_only' | 'no_new_buys';

// --- Symbol pipeline ---

export type ISMSymbolReadiness =
  | 'detected'
  | 'identity_ready'
  | 'currency_ready'
  | 'data_ready'
  | 'qualified';

// --- Exclusion & review (stable string codes for logs, UI, and persistence) ---

export const ISM_EXCLUSION_REASON_CODES = {
  TICKER_UNRESOLVED: 'ticker_unresolved',
  COMPANY_IDENTITY_MISMATCH: 'company_identity_mismatch',
  CURRENCY_MISSING_OR_UNSUPPORTED: 'currency_missing_or_unsupported',
  INSUFFICIENT_PRICE_HISTORY: 'insufficient_price_history',
  STALE_OR_MISSING_QUOTE: 'stale_or_missing_quote',
  SECTOR_UNMAPPED: 'sector_unmapped',
  THRESHOLD_FAILED: 'threshold_failed',
  MANUAL_EXCLUDE: 'manual_exclude',
  DUPLICATE_OR_SHADOW: 'duplicate_or_shadow',
  OTHER: 'other',
} as const;

export type ISMExclusionReasonCode =
  (typeof ISM_EXCLUSION_REASON_CODES)[keyof typeof ISM_EXCLUSION_REASON_CODES];

export const ISM_REVIEW_REASON_CODES = {
  BORDERLINE_BREADTH: 'borderline_breadth',
  REGIME_AMBIGUOUS: 'regime_ambiguous',
  SPARSE_SECTOR_MEMBERS: 'sparse_sector_members',
  DATA_FRESHNESS_BORDERLINE: 'data_freshness_borderline',
  CROSS_CHECK_REQUIRED: 'cross_check_required',
  OTHER: 'other',
} as const;

export type ISMReviewReasonCode = (typeof ISM_REVIEW_REASON_CODES)[keyof typeof ISM_REVIEW_REASON_CODES];

// --- Sector overview (grid / summary row) ---

/**
 * One row in the sector overview (ISM posture summary).
 * Numeric fields are optional until the data module populates them.
 */
export interface ISMSectorOverviewItem extends Record<string, unknown> {
  sectorId: string;
  sectorName: string;
  coverageStatus: ISMSectorCoverageStatus;
  regime: ISMRegime;
  allowedSizing: ISMAllowedSizing;
  /** Count of symbols at or past `qualified` readiness within the sector */
  qualifiedSymbolCount?: number;
  /** Total symbols detected for the sector (any readiness) */
  detectedSymbolCount?: number;
  /** Optional display rank / sort key */
  sortIndex?: number;
}

// --- Sector detail panel state (client UI state machine) ---

export type ISMSectorDetailPhase = 'unset' | 'hydrating' | 'ready' | 'stale' | 'error';

/**
 * Client-side state for the sector detail view (loading, errors, identity of sector).
 */
export interface ISMSectorDetailState {
  sectorId: string | null;
  phase: ISMSectorDetailPhase;
  lastFetchedAt: number | null;
  lastError: string | null;
}

// --- Selected symbols (compare / drill-down) ---

export interface ISMSelectedStockItem extends Record<string, unknown> {
  ticker: string;
  companyName: string;
  readiness: ISMSymbolReadiness;
  sectorId?: string;
  /** When symbol was added to selection (ms since epoch) */
  selectedAt?: number;
  /** Exclusion or review flags for this symbol */
  exclusionReasons?: ISMExclusionReasonCode[];
  reviewReasons?: ISMReviewReasonCode[];
}

// --- Diagnostics (panel / dev / user-facing messages) ---

export type ISMDiagnosticLevel = 'info' | 'warn' | 'error';

export interface ISMDiagnosticEntry {
  level: ISMDiagnosticLevel;
  code: string;
  message: string;
  /** Optional structured context (timestamps, counts, ids) */
  meta?: Record<string, unknown>;
}

export interface ISMDiagnosticsBundle {
  entries: ISMDiagnosticEntry[];
  /** When diagnostics were computed (ms since epoch) */
  generatedAt?: number;
  /** Correlation id for a single refresh / fetch cycle */
  correlationId?: string;
}

// --- Local detail-view settings (persisted in UI layer later) ---

export type ISMDetailViewMode = 'sector' | 'relative_strength' | 'breadth' | 'combined';

export type ISMLayoutMode = 'single' | 'split' | 'stacked';

export type ISMDetailTimeframe = '1d' | '1w' | '1m' | '3m';

export interface ISMSeriesToggles extends Record<string, unknown> {
  showSectorSma: boolean;
  showRsLine: boolean;
  showBreadth: boolean;
  showPrice: boolean;
}

/**
 * User-tunable parameters for the ISM detail chart/table area.
 * Defaults live in `src/config/ismPostureDefaults.ts`.
 */
export interface ISMDetailViewLocalSettings extends Record<string, unknown> {
  slopeLookback: number;
  sectorSmaLength: number;
  rsMaLength: number;
  breadthThreshold: number;
  viewMode: ISMDetailViewMode;
  layoutMode: ISMLayoutMode;
  seriesToggles: ISMSeriesToggles;
  timeframe: ISMDetailTimeframe;
}
