export interface BenjaminGrahamData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  price: number | null; // null means invalid/missing value, 0 means actual zero
  entryF1: number | null; // Dashboard column "ENTRY F1"; null if missing/invalid
  ivFcf?: number | null; // Optional: IV (FCF) column from Dashboard sheet
  irr1?: number | null; // Optional: Dashboard column (IRR1 etc.); shown as RR T1 in UI
}

export interface PEIndustryData extends Record<string, unknown> {
  industry: string;
  pe: number | null; // null means invalid/missing value, 0 means actual zero
  pe1: number | null;
  pe2: number | null;
  companyCount: number; // This is a counter, not from Dashboard sheet
}

export interface ScoreBoardData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  industry: string; // Added: SECTOR (ISM) from Dashboard (column alias); field name kept for compatibility
  /** DashBoard Market Cap (parsed numeric; null if missing/invalid). */
  marketCap: number | null;
  /** DashBoard "Date of Update" string — diagnostics only, not official freshness. */
  dashboardDateOfUpdate: string | null;
  mungerQualityScore: number | null;
  valueCreation: number | null; // procent-värde
  leverageF2: number | null;
  pe1Industry: number | null; // Added: procentuell skillnad mellan P/E1 från Dashboard och P/E1 SECTOR (ISM) (median)
  pe2Industry: number | null; // Added: procentuell skillnad mellan P/E2 från Dashboard och P/E2 SECTOR (ISM) (median)
  currentRatio: number | null; // Added: Current Ratio from Dashboard sheet
  cashSdebt: number | null; // Added: Cash/SDebt from Dashboard sheet
  isCashSdebtDivZero: boolean; // Added: Flag to track division-by-zero for Cash/SDebt (should be green)
  sma9: number | null; // From SMA table
  sma21: number | null; // From SMA table
  sma55: number | null; // From SMA table
  sma200: number | null; // From SMA table (Technical section)
  /** SMA colors computed in view from price vs SMA value */
  sma9Color?: 'GREEN' | 'RED' | null;
  sma21Color?: 'GREEN' | 'RED' | null;
  sma55Color?: 'GREEN' | 'RED' | null;
  sma200Color?: 'GREEN' | 'RED' | null;
  /** Dashboard column "Price" in score board transformer. Score / score-board may override with Benjamin Graham for SMA color comparison. */
  price?: number | null;
  /** Dashboard column "5Y Beta" (parsed numeric; null if missing/invalid). */
  fiveYearBeta: number | null;
}

export interface IndustryThresholdData extends Record<string, unknown> {
  industryKey: string;
  industry: string;
  leverageF2Min: number;
  leverageF2Max: number;
  cashSdebtMin: number;
  cashSdebtMax: number;
  currentRatioMin: number;
  currentRatioMax: number;
}

export interface SMAData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  sma9: number | null;
  sma21: number | null;
  sma55: number | null;
  sma200: number | null; // null means invalid/missing value, 0 means actual zero
  /** Cell background from SMA sheet: GREEN, RED, or null */
  sma9Color?: 'GREEN' | 'RED' | null;
  sma21Color?: 'GREEN' | 'RED' | null;
  sma55Color?: 'GREEN' | 'RED' | null;
  sma200Color?: 'GREEN' | 'RED' | null;
}

export interface EntryExitData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  currency: string;
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  dateOfUpdate: string | null;
}
