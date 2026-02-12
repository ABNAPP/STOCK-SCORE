import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useMemo, useEffect } from 'react';
import { useShareableHydration } from '../../contexts/ShareableHydrationContext';
import { useThresholdIndustryData } from '../../hooks/useThresholdIndustryData';
import { TableSkeleton } from '../SkeletonLoader';
import { ThresholdProvider } from '../../contexts/ThresholdContext';

// Lazy load table component
const ThresholdIndustryTable = lazy(() => import('../ThresholdIndustryTable'));

const VIEW_ID = 'threshold-industry';
const TABLE_ID = 'threshold-industry';

export default function ThresholdIndustryView() {
  const { t } = useTranslation();
  const { link, consume } = useShareableHydration();
  const { data, loading, error } = useThresholdIndustryData();

  const initialTableState = useMemo(() => {
    if (!link || link.viewId !== VIEW_ID || link.tableId !== TABLE_ID) return undefined;
    return {
      filterState: link.filterState ?? {},
      columnFilters: link.columnFilters ?? {},
      searchValue: link.searchValue ?? '',
      sortConfig: link.sortConfig,
    };
  }, [link]);

  useEffect(() => {
    if (initialTableState) consume();
  }, [initialTableState, consume]);

  return (
    <ThresholdProvider>
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
        <div className="w-full flex flex-col flex-1 min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
                {t('navigation.thresholdIndustry')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Tröskelvärden per bransch</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
            <Suspense fallback={<TableSkeleton rows={10} columns={8} hasStickyColumns={true} />}>
              <ThresholdIndustryTable data={data} loading={loading} error={error} initialTableState={initialTableState} />
            </Suspense>
          </div>
        </div>
      </div>
    </ThresholdProvider>
  );
}

