/**
 * Portfolio Types
 *
 * Type definitions for Personal Portfolio feature.
 * Supports multi-broker positions per ticker with optional migration from legacy single-position items.
 */

/** Single position at one broker (quantity, invested amount and currency). */
export interface PortfolioPosition {
  broker: string;
  quantity: number;
  investedAmount?: number | null;
  investmentCurrency?: string | null;
}

export interface PortfolioItem {
  ticker: string;
  companyName: string;
  quantity: number; // Total quantity (sum of positions), kept for backward compatibility
  currency: string; // Aktiens currency (från EntryExitValues)
  price: number | null; // Från benjaminGrahamData
  averagePrice: number | null; // Average purchase price in USD (calculated from positions)
  investedAmount?: number | null; // Legacy / derived; prefer positions for per-broker data
  investmentCurrency?: string | null; // Legacy; prefer positions
  /** Per-broker positions; if missing, item is normalized from quantity/investedAmount/investmentCurrency */
  positions?: PortfolioPosition[];
  [key: string]: unknown;
}

export interface UserPortfolio {
  userId: string;
  portfolio: PortfolioItem[];
  updatedAt: Date;
}
