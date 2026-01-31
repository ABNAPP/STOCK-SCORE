import { useMemo } from 'react';
import { BenjaminGrahamData } from '../types/stock';
import { sanitizeSearchQuery } from '../utils/inputValidator';

export interface StockSearchResult {
  companyName: string;
  ticker: string;
  price: number | null;
  benjaminGraham: number | null;
}

/**
 * Custom hook for searching stocks in benjaminGrahamData
 * 
 * Searches for stocks by ticker or company name (case-insensitive).
 * Returns matching stocks with relevant data for portfolio addition.
 * 
 * @param benjaminGrahamData - Array of Benjamin Graham data to search in
 * @param query - Search query (ticker or company name)
 * @returns Array of matching stock search results
 * 
 * @example
 * ```typescript
 * const { data: benjaminGrahamData } = useBenjaminGrahamData();
 * const results = usePortfolioSearch(benjaminGrahamData, 'AAPL');
 * ```
 */
export function usePortfolioSearch(
  benjaminGrahamData: BenjaminGrahamData[],
  query: string
): StockSearchResult[] {
  return useMemo(() => {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Sanitize search query to prevent XSS and regex injection
    const sanitizedQuery = sanitizeSearchQuery(query);
    const normalizedQuery = sanitizedQuery.toLowerCase().trim();

    if (normalizedQuery.length === 0) {
      return [];
    }

    const results: StockSearchResult[] = [];

    for (const item of benjaminGrahamData) {
      const companyName = (item.companyName || '').toLowerCase();
      const ticker = (item.ticker || '').toLowerCase();

      // Check if query matches company name or ticker
      if (companyName.includes(normalizedQuery) || ticker.includes(normalizedQuery)) {
        results.push({
          companyName: item.companyName,
          ticker: item.ticker,
          price: item.price ?? null,
          benjaminGraham: item.benjaminGraham ?? null,
        });
      }
    }

    // Limit results to 50 for performance
    return results.slice(0, 50);
  }, [benjaminGrahamData, query]);
}
