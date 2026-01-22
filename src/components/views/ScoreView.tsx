import { useTranslation } from 'react-i18next';
import { useMemo, lazy, Suspense, useEffect } from 'react';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useThresholdIndustryData } from '../../hooks/useThresholdIndustryData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { EntryExitData, ScoreBoardData } from '../../types/stock';
import ProgressIndicator from '../ProgressIndicator';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { calculateDetailedScore } from '../../utils/calculateScoreDetailed';
import ScoreDashboard from '../ScoreDashboard';

// Lazy load table component
const ScoreTable = lazy(() => import('../ScoreTable'));

export interface ScoreData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  currency: string;
  price: number | null;
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  score: number;
  scoreBoardData: ScoreBoardData; // Full data for breakdown calculation
}

// Inner component that uses EntryExitContext
function ScoreViewInner() {
  const { t } = useTranslation();
  const { data: scoreBoardData, loading, error } = useScoreBoardData();
  const { data: thresholdData, loading: thresholdLoading } = useThresholdIndustryData();
  const { data: benjaminGrahamData, loading: bgLoading } = useBenjaminGrahamData();
  const { initializeFromData, entryExitValues } = useEntryExitValues();
  
  // Progressive loading: Only block rendering on main data (scoreBoardData)
  // Allow thresholdData and benjaminGrahamData to load in background
  const isLoading = loading;
  const isBackgroundLoading = thresholdLoading || bgLoading;

  // Initialize EntryExitContext with ScoreBoardData (same as EntryExitTable)
  useEffect(() => {
    if (scoreBoardData && scoreBoardData.length > 0) {
      const entryExitData: EntryExitData[] = scoreBoardData.map((item) => ({
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
  }, [scoreBoardData, initializeFromData]);

  // Match Price data with Score Board data based on ticker, then calculate scores
  // SMA data is already included in ScoreBoardData from fetchScoreBoardData
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

    // Match Score Board data with Price data, then calculate scores
    // SMA data (sma100, sma200, smaCross) is already included in ScoreBoardData
    return scoreBoardData.map(item => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const price = priceMap.get(tickerKey) ?? null;
      
      // Create enhanced ScoreBoardData with price
      const enhancedData = {
        ...item,
        price: price,
      };

      // Get currency and entry/exit values from entryExitValues
      const key = `${item.ticker}-${item.companyName}`;
      const entryExitValue = entryExitValues.get(key);
      const currency = entryExitValue?.currency || 'USD';
      const entry1 = entryExitValue?.entry1 || 0;
      const entry2 = entryExitValue?.entry2 || 0;
      const exit1 = entryExitValue?.exit1 || 0;
      const exit2 = entryExitValue?.exit2 || 0;

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
        currency: currency,
        price: price,
        entry1: entry1,
        entry2: entry2,
        exit1: exit1,
        exit2: exit2,
        score: score,
        scoreBoardData: enhancedData,
      };
    });
  }, [scoreBoardData, benjaminGrahamData, thresholdData, entryExitValues]);

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">Score</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Poängsystem baserat på färgkodning (0-100)</p>
          </div>
        </div>
        {isLoading && (
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator isLoading={true} label="Loading data..." />
          </div>
        )}
        {!isLoading && isBackgroundLoading && (
          <div className="mb-2 flex-shrink-0">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t('common.loadingAdditionalData', 'Laddar ytterligare data i bakgrunden...')}
            </p>
          </div>
        )}
        {!isLoading && scoreData.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 transition-all duration-300 ease-in-out">
            {/* Left side: Table */}
            <div className="flex-[3] min-h-0 min-w-0">
              <Suspense fallback={<TableSkeleton rows={15} columns={4} hasStickyColumns={true} />}>
                <ScoreTable 
                  data={scoreData} 
                  loading={false}
                  error={error}
                  thresholdData={thresholdData || []}
                  benjaminGrahamData={benjaminGrahamData || []}
                  entryExitValues={entryExitValues}
                />
              </Suspense>
            </div>
            {/* Right side: Dashboard with Heatmap and Scatter Plot */}
            <div className="flex-[2] lg:flex-shrink-0 flex flex-col min-h-0">
              <ScoreDashboard 
                data={scoreData} 
                loading={false}
                thresholdData={thresholdData || []}
                benjaminGrahamData={benjaminGrahamData || []}
                entryExitValues={entryExitValues}
              />
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 min-h-0">
            <TableSkeleton rows={15} columns={4} hasStickyColumns={true} />
          </div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 p-4">{error}</div>
        ) : null}
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

