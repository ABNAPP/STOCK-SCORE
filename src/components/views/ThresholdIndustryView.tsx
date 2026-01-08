import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { useThresholdIndustryData } from '../../hooks/useThresholdIndustryData';
import { TableSkeleton } from '../SkeletonLoader';

// Lazy load table component
const ThresholdIndustryTable = lazy(() => import('../ThresholdIndustryTable'));

export default function ThresholdIndustryView() {
  const { t } = useTranslation();
  const { data, loading, error } = useThresholdIndustryData();

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
              {t('navigation.thresholdIndustry')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Tröskelvärden per bransch</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
          <Suspense fallback={<TableSkeleton rows={10} columns={8} hasStickyColumns={true} />}>
            <ThresholdIndustryTable data={data} loading={loading} error={error} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

