export interface BenjaminGrahamData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  price: number | null; // null means invalid/missing value, 0 means actual zero
  benjaminGraham: number | null;
  ivFcf?: number | null; // Optional: IV (FCF) column from Dashboard sheet
  irr1?: number | null; // Optional: IRR1 column from Dashboard sheet
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
  industry: string; // Added: Industry from Dashboard sheet for threshold matching
  irr: number | null; // null means invalid/missing value, 0 means actual zero
  mungerQualityScore: number | null;
  valueCreation: number | null; // procent-värde
  tbSPrice: number | null; // Added: (TB/Share) / Price from Dashboard sheet
  ro40Cy: number | null;
  ro40F1: number | null;
  ro40F2: number | null;
  leverageF2: number | null;
  pe1Industry: number | null; // Added: procentuell skillnad mellan P/E1 från Dashboard och P/E1 INDUSTRY (median)
  pe2Industry: number | null; // Added: procentuell skillnad mellan P/E2 från Dashboard och P/E2 INDUSTRY (median)
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
  price?: number | null; // From ENTRY/EXIT (Benjamin Graham) for SMA color comparison
}

export interface IndustryThresholdData extends Record<string, unknown> {
  industryKey: string;
  industry: string;
  irr: number;
  leverageF2Min: number;
  leverageF2Max: number;
  ro40Min: number;
  ro40Max: number;
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
