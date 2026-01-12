import { useTranslation } from 'react-i18next';
import { useMemo, lazy, Suspense, useEffect } from 'react';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useThresholdIndustryData } from '../../hooks/useThresholdIndustryData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { ScoreBoardData, EntryExitData } from '../../types/stock';
import ProgressIndicator from '../ProgressIndicator';
import EnhancedLoadingState from '../EnhancedLoadingState';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';

// Lazy load table component
const ScoreBoardTable = lazy(() => import('../ScoreBoardTable'));

// Inner component that uses EntryExitContext
function ScoreBoardViewInner() {
  const { t } = useTranslation();
  const { data, loading, error } = useScoreBoardData();
  const { data: thresholdData, loading: thresholdLoading } = useThresholdIndustryData();
  const { data: benjaminGrahamData, loading: bgLoading } = useBenjaminGrahamData();
  const { initializeFromData } = useEntryExitValues();
  
  const isLoading = loading || thresholdLoading || bgLoading;

  // Initialize EntryExitContext with ScoreBoardData (same as EntryExitTable)
  useEffect(() => {
    if (data && data.length > 0) {
      const entryExitData: EntryExitData[] = data.map((item) => ({
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
  }, [data, initializeFromData]);

  // Match Price data with Score Board data based on ticker (SMA(100) and SMA(200) are now fetched directly in fetchScoreBoardData)
  const dataWithPrice: ScoreBoardData[] = useMemo(() => {
    // Create a map of Price data by ticker (case-insensitive)
    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      benjaminGrahamData.forEach(bg => {
        const tickerKey = bg.ticker.toLowerCase().trim();
        priceMap.set(tickerKey, bg.price);
      });
    }

    // Match Score Board data with Price data (SMA(100) and SMA(200) are already included from fetchScoreBoardData)
    return data.map(item => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const price = priceMap.get(tickerKey) ?? null;
      
      return {
        ...item,
        price: price, // Add price for color comparison
      };
    });
  }, [data, benjaminGrahamData]);

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">Score Board</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Översikt över alla aktier och deras värderingar</p>
          </div>
        </div>
        {isLoading && (
          <div className="mb-4 flex-shrink-0">
            <EnhancedLoadingState />
          </div>
        )}
        <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
          <Suspense fallback={<TableSkeleton rows={15} columns={12} hasStickyColumns={true} />}>
            <ScoreBoardTable data={dataWithPrice} loading={isLoading} error={error} thresholdData={thresholdData} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function ScoreBoardView() {
  return (
    <EntryExitProvider>
      <ScoreBoardViewInner />
    </EntryExitProvider>
  );
}

