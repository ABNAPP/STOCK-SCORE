import { useTranslation } from 'react-i18next';
import { useMemo, lazy, Suspense, useEffect } from 'react';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useThresholdIndustryData } from '../../hooks/useThresholdIndustryData';
import { useSMAData } from '../../hooks/useSMAData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { EntryExitData, ScoreBoardData } from '../../types/stock';
import ProgressIndicator from '../ProgressIndicator';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { calculateDetailedScore } from '../../utils/calculateScoreDetailed';

// Lazy load table component
const ScoreTable = lazy(() => import('../ScoreTable'));

export interface ScoreData {
  companyName: string;
  ticker: string;
  score: number;
  scoreBoardData: ScoreBoardData; // Full data for breakdown calculation
}

// Inner component that uses EntryExitContext
function ScoreViewInner() {
  const { t } = useTranslation();
  const { data: scoreBoardData, loading, error, refetch } = useScoreBoardData();
  const { data: thresholdData, loading: thresholdLoading } = useThresholdIndustryData();
  const { data: smaData, loading: smaLoading } = useSMAData();
  const { data: benjaminGrahamData, loading: bgLoading } = useBenjaminGrahamData();
  const { initializeFromData, entryExitValues } = useEntryExitValues();
  
  const isLoading = loading || thresholdLoading || smaLoading || bgLoading;

  // Initialize EntryExitContext with SMAData (same as EntryExitTable)
  useEffect(() => {
    if (smaData && smaData.length > 0) {
      const entryExitData: EntryExitData[] = smaData.map((item) => ({
        companyName: item.companyName,
        ticker: item.ticker,
        currency: 'USD',
        entry1: 0,
        entry2: 0,
        exit1: 0,
        exit2: 0,
        dateOfUpdate: null,
      }));
      initializeFromData(entryExitData);
    }
  }, [smaData, initializeFromData]);

  // Match SMA data and Price data with Score Board data based on ticker, then calculate scores
  const scoreData: ScoreData[] = useMemo(() => {
    if (!scoreBoardData || scoreBoardData.length === 0) return [];

    // Create a map of Price data by ticker (case-insensitive)
    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      benjaminGrahamData.forEach(bg => {
        const tickerKey = bg.ticker.toLowerCase().trim();
        priceMap.set(tickerKey, bg.price);
      });
    }

    // Create a map of SMA data by ticker (case-insensitive)
    const smaMap = new Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>();
    if (smaData && smaData.length > 0) {
      smaData.forEach(sma => {
        const tickerKey = sma.ticker.toLowerCase().trim();
        smaMap.set(tickerKey, {
          sma100: sma.sma100,
          sma200: sma.sma200,
          smaCross: sma.smaCross,
        });
      });
    }

    // Match Score Board data with SMA data and Price data, then calculate scores
    return scoreBoardData.map(item => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const smaMatch = smaMap.get(tickerKey);
      const price = priceMap.get(tickerKey) ?? null;
      
      // Create enhanced ScoreBoardData with SMA and price
      const enhancedData = {
        ...item,
        sma100: smaMatch ? smaMatch.sma100 : null,
        sma200: smaMatch ? smaMatch.sma200 : null,
        smaCross: smaMatch ? smaMatch.smaCross : null,
        price: price,
      };

      // Calculate detailed score
      const score = calculateDetailedScore(
        enhancedData,
        thresholdData || [],
        benjaminGrahamData || [],
        entryExitValues
      );

      return {
        companyName: item.companyName,
        ticker: item.ticker,
        score: score,
        scoreBoardData: enhancedData,
      };
    });
  }, [scoreBoardData, smaData, benjaminGrahamData, thresholdData, entryExitValues]);

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">Score</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Poängsystem baserat på färgkodning (0-100)</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-lg hover:scale-105 active:scale-95 self-start sm:self-auto inline-flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
        {isLoading && (
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator isLoading={true} label="Loading data..." />
          </div>
        )}
        <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
          <Suspense fallback={<TableSkeleton rows={15} columns={4} hasStickyColumns={true} />}>
            <ScoreTable 
              data={scoreData} 
              loading={isLoading} 
              error={error}
              thresholdData={thresholdData || []}
              benjaminGrahamData={benjaminGrahamData || []}
              entryExitValues={entryExitValues}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function ScoreView() {
  return (
    <EntryExitProvider>
      <ScoreViewInner />
    </EntryExitProvider>
  );
}

