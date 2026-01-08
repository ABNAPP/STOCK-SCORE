import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { ViewId } from '../../types/navigation';
import { usePEIndustryData } from '../../hooks/usePEIndustryData';
import { TableSkeleton } from '../SkeletonLoader';

// Lazy load table component
const PEIndustryTable = lazy(() => import('../PEIndustryTable'));

interface FundamentalViewProps {
  viewId: ViewId;
}

export default function FundamentalView({ viewId }: FundamentalViewProps) {
  const { t } = useTranslation();
  const isPEIndustry = viewId === 'fundamental-pe-industry';
  const { data, loading, error } = usePEIndustryData();
  
  const getViewTitle = () => {
    const titles: Partial<Record<ViewId, string>> = {
      'fundamental-pe-industry': t('navigation.peIndustry'),
      'fundamental-current-ratio': t('navigation.currentRatio'),
      'fundamental-cash-sdebt': t('navigation.cashSdebt'),
      'fundamental-ro40-cy': t('navigation.ro40Cy'),
      'fundamental-ro40-f1': t('navigation.ro40F1'),
      'fundamental-ro40-f2': t('navigation.ro40F2'),
    };
    return titles[viewId] || t('navigation.fundamental');
  };

  if (isPEIndustry) {
    return (
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
        <div className="w-full flex flex-col flex-1 min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">{getViewTitle()}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Fundamentala analyser per bransch</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
            <Suspense fallback={<TableSkeleton rows={10} columns={5} hasStickyColumns={true} />}>
              <PEIndustryTable data={data} loading={loading} error={error} />
            </Suspense>
          </div>
        </div>
      </div>
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
