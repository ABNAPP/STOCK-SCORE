import { useMemo } from 'react';
import { useScoreBoardData } from './useScoreBoardData';
import { useBenjaminGrahamData } from './useBenjaminGrahamData';
import { usePEIndustryData } from './usePEIndustryData';
import { useThresholdIndustryData } from './useThresholdIndustryData';
import { ViewId } from '../types/navigation';

export interface SearchResult {
  id: string;
  type: 'score-board' | 'benjamin-graham' | 'pe-industry' | 'entry-exit' | 'threshold-industry';
  viewId: ViewId;
  label: string;
  companyName?: string;
  ticker?: string;
  industry?: string;
  matchField: string; // Which field matched the search
}

export function useGlobalSearch() {
  const { data: scoreBoardData } = useScoreBoardData();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();
  const { data: peIndustryData } = usePEIndustryData();
  const { data: thresholdIndustryData } = useThresholdIndustryData();

  const search = useMemo(() => {
    return (query: string): SearchResult[] => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const normalizedQuery = query.toLowerCase().trim();
      const results: SearchResult[] = [];

      // Search in ScoreBoardData
      scoreBoardData.forEach((item, index) => {
        const companyName = item.companyName?.toLowerCase() || '';
        const ticker = item.ticker?.toLowerCase() || '';
        const industry = item.industry?.toLowerCase() || '';

        if (companyName.includes(normalizedQuery)) {
          results.push({
            id: `score-board-${index}`,
            type: 'score-board',
            viewId: 'score-board',
            label: item.companyName,
            companyName: item.companyName,
            ticker: item.ticker,
            industry: item.industry,
            matchField: 'companyName',
          });
        } else if (ticker.includes(normalizedQuery)) {
          results.push({
            id: `score-board-${index}`,
            type: 'score-board',
            viewId: 'score-board',
            label: `${item.companyName} (${item.ticker})`,
            companyName: item.companyName,
            ticker: item.ticker,
            industry: item.industry,
            matchField: 'ticker',
          });
        } else if (industry.includes(normalizedQuery)) {
          results.push({
            id: `score-board-${index}`,
            type: 'score-board',
            viewId: 'score-board',
            label: `${item.industry} - ${item.companyName}`,
            companyName: item.companyName,
            ticker: item.ticker,
            industry: item.industry,
            matchField: 'industry',
          });
        }
      });

      // Search in BenjaminGrahamData
      benjaminGrahamData.forEach((item, index) => {
        const companyName = item.companyName?.toLowerCase() || '';
        const ticker = item.ticker?.toLowerCase() || '';

        if (companyName.includes(normalizedQuery) || ticker.includes(normalizedQuery)) {
          results.push({
            id: `benjamin-graham-${index}`,
            type: 'benjamin-graham',
            viewId: 'entry-exit-benjamin-graham',
            label: companyName.includes(normalizedQuery) ? item.companyName : `${item.companyName} (${item.ticker})`,
            companyName: item.companyName,
            ticker: item.ticker,
            matchField: companyName.includes(normalizedQuery) ? 'companyName' : 'ticker',
          });
        }
      });

      // Search in PEIndustryData
      peIndustryData.forEach((item, index) => {
        const industry = item.industry?.toLowerCase() || '';
        if (industry.includes(normalizedQuery)) {
          results.push({
            id: `pe-industry-${index}`,
            type: 'pe-industry',
            viewId: 'fundamental-pe-industry',
            label: item.industry,
            industry: item.industry,
            matchField: 'industry',
          });
        }
      });

      // Search in ThresholdIndustryData
      thresholdIndustryData.forEach((item, index) => {
        const industry = item.industry?.toLowerCase() || '';
        if (industry.includes(normalizedQuery)) {
          results.push({
            id: `threshold-industry-${index}`,
            type: 'threshold-industry',
            viewId: 'threshold-industry',
            label: item.industry,
            industry: item.industry,
            matchField: 'industry',
          });
        }
      });

      // Remove only exact duplicates (same id) to allow same company in different tables
      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex((r) => r.id === result.id)
      );

      // Limit to 50 results for performance (increased from 20 since we show all tables)
      return uniqueResults.slice(0, 50);
    };
  }, [scoreBoardData, benjaminGrahamData, peIndustryData, thresholdIndustryData]);

  return { search };
}

