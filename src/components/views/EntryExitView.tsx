import { lazy, Suspense, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ViewId } from '../../types/navigation';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { EntryExitData } from '../../types/stock';
import { mergeScoreBoardWithBenjaminGrahamForEntryExit } from '../../utils/mergeEntryExitDashboardRows';

// Lazy load table components
const EntryExitTable = lazy(() => import('../EntryExitTable'));

interface EntryExitViewProps {
  viewId: ViewId;
}

/** Benjamin Graham ENTRY/EXIT: DashBoard-derived row list + BG column merge + Firestore manuals (inside provider). */
function EntryExitBenjaminGrahamInner() {
  const { t } = useTranslation();
  const { data: scoreBoardData, loading: scoreLoading, error: scoreError } = useScoreBoardData();
  const { data: benjaminGrahamData, error: benjaminGrahamError } = useBenjaminGrahamData();
  const { initializeFromData } = useEntryExitValues();

  useEffect(() => {
    if (scoreBoardData && scoreBoardData.length > 0) {
      const entryExitData: EntryExitData[] = scoreBoardData.map((item) => ({
        companyName: item.companyName,
        ticker: item.ticker,
        currency: '',
        entry1: 0,
        entry2: 0,
        exit1: 0,
        exit2: 0,
        dateOfUpdate: null,
      }));
      initializeFromData(entryExitData);
    }
  }, [scoreBoardData, initializeFromData]);

  const mergedData = useMemo(
    () => mergeScoreBoardWithBenjaminGrahamForEntryExit(scoreBoardData ?? [], benjaminGrahamData ?? []),
    [scoreBoardData, benjaminGrahamData],
  );

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="mb-4 flex-shrink-0">
          <Link
            to="/management-monitoring"
            className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
          >
            ← Back to Management Monitoring
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
              {t('navigation.benjaminGraham')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Entry och exit-punkter för aktier</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col transition-all duration-300 ease-in-out">
          {scoreLoading ? (
            <TableSkeleton rows={10} columns={5} hasStickyColumns={true} />
          ) : scoreError ? (
            <div className="text-red-600 dark:text-red-400 p-4">{scoreError}</div>
          ) : mergedData.length > 0 ? (
            <Suspense fallback={<TableSkeleton rows={10} columns={5} hasStickyColumns={true} />}>
              <EntryExitTable data={mergedData} loading={false} error={benjaminGrahamError} />
            </Suspense>
          ) : (
            <div className="text-gray-600 dark:text-gray-400 p-4">No score board data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EntryExitView({ viewId }: EntryExitViewProps) {
  const { t } = useTranslation();
  const isBenjaminGraham = viewId === 'entry-exit-benjamin-graham';

  const getViewTitle = () => {
    const titles: Partial<Record<ViewId, string>> = {
      'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
      'entry-exit-irr1': t('navigation.irr1'),
      'entry-exit-iv-fcf': t('navigation.ivFcf'),
    };
    return titles[viewId] || t('navigation.entryExit');
  };

  if (isBenjaminGraham) {
    return (
      <EntryExitProvider>
        <EntryExitBenjaminGrahamInner />
      </EntryExitProvider>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-6">{getViewTitle()}</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-[1.01]">
          <p className="text-gray-600 dark:text-gray-400">{t('common.underConstruction')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">{t('common.viewId')} {viewId}</p>
        </div>
      </div>
    </div>
  );
}
