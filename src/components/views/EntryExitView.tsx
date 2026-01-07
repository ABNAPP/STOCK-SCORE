import { useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewId } from '../../types/navigation';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { useSMAData } from '../../hooks/useSMAData';
import { EntryExitData } from '../../types/stock';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider } from '../../contexts/EntryExitContext';

// Lazy load table components
const BenjaminGrahamTable = lazy(() => import('../BenjaminGrahamTable'));
const EntryExitTable = lazy(() => import('../EntryExitTable'));

interface EntryExitViewProps {
  viewId: ViewId;
}

export default function EntryExitView({ viewId }: EntryExitViewProps) {
  const { t } = useTranslation();
  const isBenjaminGraham = viewId === 'entry-exit-benjamin-graham';
  const isEntryExit = viewId === 'entry-exit-entry1';
  const { data: benjaminGrahamData, loading: benjaminGrahamLoading, error: benjaminGrahamError, refetch: refetchBenjaminGraham } = useBenjaminGrahamData();
  const { data: smaData, loading: entryExitLoading, error: entryExitError, refetch: refetchEntryExit } = useSMAData();
  
  // Map SMAData to EntryExitData with default values
  const entryExitData: EntryExitData[] = useMemo(() => {
    return smaData.map((item) => ({
      companyName: item.companyName,
      ticker: item.ticker,
      currency: 'USD', // Default currency
      entry1: 0,
      entry2: 0,
      exit1: 0,
      exit2: 0,
      dateOfUpdate: null,
    }));
  }, [smaData]);
  
  const getViewTitle = () => {
    const titles: Partial<Record<ViewId, string>> = {
      'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
      'entry-exit-entry1': t('navigation.tachart'),
      'entry-exit-irr1': t('navigation.irr1'),
      'entry-exit-iv-fcf': t('navigation.ivFcf'),
    };
    return titles[viewId] || t('navigation.entryExit');
  };

  if (isBenjaminGraham) {
    return (
      <EntryExitProvider>
        <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
          <div className="w-full flex flex-col flex-1 min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">{getViewTitle()}</h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Entry och exit-punkter för aktier</p>
              </div>
              <button
                onClick={() => refetchBenjaminGraham()}
                disabled={benjaminGrahamLoading}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-lg hover:scale-105 active:scale-95 self-start sm:self-auto inline-flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${benjaminGrahamLoading ? 'animate-spin' : ''}`}
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
                <span>{benjaminGrahamLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
              <Suspense fallback={<TableSkeleton rows={10} columns={5} hasStickyColumns={true} />}>
                <BenjaminGrahamTable data={benjaminGrahamData} loading={benjaminGrahamLoading} error={benjaminGrahamError} />
              </Suspense>
            </div>
          </div>
        </div>
      </EntryExitProvider>
    );
  }

  if (isEntryExit) {
    return (
      <EntryExitProvider>
        <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
          <div className="w-full flex flex-col flex-1 min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">{getViewTitle()}</h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Entry och exit-punkter för aktier</p>
              </div>
              <button
                onClick={() => refetchEntryExit()}
                disabled={entryExitLoading}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-lg hover:scale-105 active:scale-95 self-start sm:self-auto inline-flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${entryExitLoading ? 'animate-spin' : ''}`}
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
                <span>{entryExitLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
              <Suspense fallback={<TableSkeleton rows={10} columns={8} hasStickyColumns={true} />}>
                <EntryExitTable data={entryExitData} loading={entryExitLoading} error={entryExitError} />
              </Suspense>
            </div>
          </div>
        </div>
      </EntryExitProvider>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{getViewTitle()}</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-[1.01]">
          <p className="text-gray-600 dark:text-gray-400">{t('common.underConstruction')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">{t('common.viewId')} {viewId}</p>
        </div>
      </div>
    </div>
  );
}
