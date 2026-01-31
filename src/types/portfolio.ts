/**
 * Portfolio Types
 * 
 * Type definitions for Personal Portfolio feature.
 * Columns and additional fields will be defined step by step.
 */

export interface PortfolioItem {
  ticker: string;
  companyName: string;
  quantity: number; // Antal - manuell input
  currency: string; // Aktiens currency (från EntryExitValues)
  price: number | null; // Från benjaminGrahamData
  averagePrice: number | null; // Average purchase price in USD (calculated)
  investedAmount?: number | null; // Total invested amount in investment currency (optional for backward compatibility)
  investmentCurrency?: string | null; // Currency used for investment (e.g., 'SEK', 'EUR') (optional for backward compatibility)
  // Extensible: Additional columns can be added here in the future
  [key: string]: unknown; // Allow for future extensibility
}

export interface UserPortfolio {
  userId: string;
  portfolio: PortfolioItem[];
  updatedAt: Date;
}
