/**
 * Portfolio Types
 * 
 * Type definitions for Personal Portfolio feature.
 * Columns and additional fields will be defined step by step.
 */

export interface PortfolioItem {
  ticker: string;
  companyName?: string;
  // Additional columns will be defined step by step
}

export interface UserPortfolio {
  userId: string;
  portfolio: PortfolioItem[];
  updatedAt: Date;
}
