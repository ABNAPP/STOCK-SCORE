import { useEffect, useMemo, useState } from 'react';
import { createScoreBoardTransformer, type SMADataMapEntry } from '../services/sheets/scoreBoardService';
import { transformBenjaminGrahamData } from '../services/sheets/benjaminGrahamService';
import { transformPEIndustryData } from '../services/sheets/peIndustryService';
import { transformSMAData } from '../services/sheets/smaService';
import { getMainData } from '../services/mainDataService';
import { getSmaData } from '../services/smaDataService';
import type { ScoreBoardData, BenjaminGrahamData, PEIndustryData } from '../types/stock';
import { ViewId } from '../types/navigation';
import { logger } from '../utils/logger';

export interface SearchResult {
  id: string;
  type: 'score-board' | 'benjamin-graham' | 'pe-industry' | 'entry-exit';
  viewId: ViewId;
  label: string;
  companyName?: string;
  ticker?: string;
  industry?: string;
  matchField: string; // Which field matched the search
}

export function useGlobalSearch() {
  const [scoreBoardData, setScoreBoardData] = useState<ScoreBoardData[]>([]);
  const [benjaminGrahamData, setBenjaminGrahamData] = useState<BenjaminGrahamData[]>([]);
  const [peIndustryData, setPeIndustryData] = useState<PEIndustryData[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadSearchData = async () => {
      try {
        const [mainData, smaSheet] = await Promise.all([getMainData(), getSmaData()]);

        const peData = transformPEIndustryData({
          data: mainData.rows,
          meta: { fields: mainData.headers },
        });

        const industryPe1Map = new Map<string, number>();
        const industryPe2Map = new Map<string, number>();
        peData.forEach((pe) => {
          if (pe.pe1 !== null) industryPe1Map.set(pe.industry.toLowerCase(), pe.pe1);
          if (pe.pe2 !== null) industryPe2Map.set(pe.industry.toLowerCase(), pe.pe2);
        });

        const smaData = transformSMAData({
          data: smaSheet.rows,
          meta: { fields: smaSheet.headers },
        });
        const smaDataMap = new Map<string, SMADataMapEntry>();
        smaData.forEach((sma) => {
          smaDataMap.set(sma.ticker.toLowerCase().trim(), {
            sma9: sma.sma9,
            sma21: sma.sma21,
            sma55: sma.sma55,
            sma200: sma.sma200,
          });
        });

        const scoreBoardTransformer = createScoreBoardTransformer(
          industryPe1Map,
          industryPe2Map,
          smaDataMap
        );
        const scoreData = scoreBoardTransformer({
          data: mainData.rows,
          meta: { fields: mainData.headers },
        });

        const bgData = transformBenjaminGrahamData({
          data: mainData.rows,
          meta: { fields: mainData.headers },
        });

        if (!mounted) return;
        setScoreBoardData(scoreData);
        setBenjaminGrahamData(bgData);
        setPeIndustryData(peData);
      } catch (error) {
        logger.warn('Failed to load global search data from snapshots', {
          component: 'useGlobalSearch',
          operation: 'loadSearchData',
          error,
        });
      }
    };

    loadSearchData();

    return () => {
      mounted = false;
    };
  }, []);

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
            viewId: 'score',
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
            viewId: 'score',
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
            viewId: 'score',
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

      // Remove only exact duplicates (same id) to allow same company in different tables
      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex((r) => r.id === result.id)
      );

      // Limit to 50 results for performance (increased from 20 since we show all tables)
      return uniqueResults.slice(0, 50);
    };
  }, [scoreBoardData, benjaminGrahamData, peIndustryData]);

  return { search };
}

