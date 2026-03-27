import { useTranslation } from 'react-i18next';
import { useMemo, lazy, Suspense, useEffect } from 'react';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useIndustryThresholdData } from '../../hooks/useIndustryThresholdData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import LastUpdated from '../LastUpdated';
import { ScoreBoardData, EntryExitData } from '../../types/stock';
import { getSMAColor } from '../../utils/colorThresholds/colorLogic';
import ProgressIndicator from '../ProgressIndicator';
import EnhancedLoadingState from '../EnhancedLoadingState';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';

// Lazy load table component
const ScoreBoardTable = lazy(() => import('../ScoreBoardTable'));

const VIEW_ID = 'score-board';
const TABLE_ID = 'score-board';

// Inner component that uses EntryExitContext
function ScoreBoardViewInner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { data, loading, error, lastUpdated, refetch } = useScoreBoardData();
  const { data: thresholdData, loading: thresholdLoading } = useIndustryThresholdData();
  const { data: benjaminGrahamData, loading: bgLoading } = useBenjaminGrahamData();
  const { initializeFromData } = useEntryExitValues();
  
  // Progressive loading: Only block rendering on main data (scoreBoardData)
  // Allow thresholdData and benjaminGrahamData to load in background
  const isLoading = loading;
  const isBackgroundLoading = thresholdLoading || bgLoading;

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

  // Match Price data with Score Board data; SMA values from SMA table, colors from price vs SMA
  const dataWithPrice: ScoreBoardData[] = useMemo(() => {
    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      benjaminGrahamData.forEach(bg => {
        const tickerKey = bg.ticker.toLowerCase().trim();
        priceMap.set(tickerKey, bg.price);
      });
    }

    return data.map(item => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const price = priceMap.get(tickerKey) ?? null;
      const sma9Color = (() => { const c = getSMAColor(price, item.sma9); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma21Color = (() => { const c = getSMAColor(price, item.sma21); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma55Color = (() => { const c = getSMAColor(price, item.sma55); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma200Color = (() => { const c = getSMAColor(price, item.sma200); return c === 'GREEN' || c === 'RED' ? c : null; })();

      return {
        ...item,
        price,
        sma9Color,
        sma21Color,
        sma55Color,
        sma200Color,
      };
    });
  }, [data, benjaminGrahamData]);

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">Score Board</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Översikt över alla aktier och deras värderingar</p>
          </div>
        </div>
        {isLoading && (
          <div className="mb-4 flex-shrink-0">
            <EnhancedLoadingState />
          </div>
        )}
        {!isLoading && isBackgroundLoading && (
          <div className="mb-2 flex-shrink-0">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t('common.loadingAdditionalData', 'Laddar ytterligare data i bakgrunden...')}
            </p>
          </div>
        )}
        {!isLoading && data.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <LastUpdated
              lastUpdated={lastUpdated}
              onRefresh={() => refetch(true)}
              loading={loading}
              isOffline={!isOnline}
              isReadOnly={!isOnline}
            />
          </div>
        )}
        <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
          {!isLoading && dataWithPrice.length > 0 ? (
            <Suspense fallback={<TableSkeleton rows={15} columns={12} hasStickyColumns={true} />}>
              <ScoreBoardTable data={dataWithPrice} loading={false} error={error} thresholdData={thresholdData} onRetry={() => refetch(true)} />
            </Suspense>
          ) : isLoading ? (
            <TableSkeleton rows={15} columns={12} hasStickyColumns={true} />
          ) : error ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{t('aria.error')}</h3>
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-4">{error}</p>
              <button
                onClick={() => refetch(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px]"
              >
                {t('offline.tryAgain')}
              </button>
            </div>
          ) : null}
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

