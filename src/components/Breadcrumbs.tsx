import { useTranslation } from 'react-i18next';
import { ViewId } from '../types/navigation';

interface BreadcrumbItem {
  id: ViewId | 'home' | 'category';
  label: string;
  isCategory?: boolean; // True if it's a category, not a clickable view
}

interface BreadcrumbsProps {
  activeView: ViewId;
  onViewChange: (viewId: ViewId) => void;
}

export default function Breadcrumbs({ activeView, onViewChange }: BreadcrumbsProps) {
  const { t } = useTranslation();

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with home/score
    breadcrumbs.push({
      id: 'score',
      label: t('navigation.score'),
    });

    // Handle different view types
    if (activeView === 'score') {
      return breadcrumbs; // Already at home
    }

    if (activeView === 'score-board') {
      breadcrumbs.push({
        id: 'score-board',
        label: t('navigation.scoreBoard'),
      });
      return breadcrumbs;
    }

    if (activeView === 'entry-exit-benjamin-graham') {
      breadcrumbs.push({
        id: 'entry-exit-benjamin-graham',
        label: t('navigation.benjaminGraham'),
      });
      return breadcrumbs;
    }

    if (activeView === 'fundamental-pe-industry') {
      breadcrumbs.push({
        id: 'fundamental-pe-industry',
        label: t('navigation.peIndustry'),
      });
      return breadcrumbs;
    }

    if (activeView === 'threshold-industry') {
      breadcrumbs.push({
        id: 'threshold-industry',
        label: t('navigation.thresholdIndustry'),
      });
      return breadcrumbs;
    }

    if (activeView === 'entry-exit-entry1') {
      breadcrumbs.push({
        id: 'entry-exit-entry1',
        label: t('navigation.tachart'),
      });
      return breadcrumbs;
    }

    if (activeView === 'teknikal-sma-100') {
      breadcrumbs.push({
        id: 'teknikal-sma-100',
        label: t('navigation.sma100'),
      });
      return breadcrumbs;
    }

    // Handle other teknikal views
    if (activeView.startsWith('teknikal-')) {
      if (activeView === 'teknikal-sma-200') {
        breadcrumbs.push({
          id: 'teknikal-sma-200',
          label: t('navigation.sma200'),
        });
      } else if (activeView === 'teknikal-sma-cross') {
        breadcrumbs.push({
          id: 'teknikal-sma-cross',
          label: t('navigation.smaCross'),
        });
      } else if (activeView === 'teknikal-tachart') {
        breadcrumbs.push({
          id: 'teknikal-tachart',
          label: t('navigation.tachart'),
        });
      }
      return breadcrumbs;
    }

    // Handle other entry-exit views
    if (activeView.startsWith('entry-exit-')) {
      const viewLabels: Partial<Record<ViewId, string>> = {
        'entry-exit-entry1': t('navigation.tachart'),
        'entry-exit-entry2': t('navigation.entry2'),
        'entry-exit-exit1': t('navigation.exit1'),
        'entry-exit-exit2': t('navigation.exit2'),
        'entry-exit-irr1': t('navigation.irr1'),
        'entry-exit-iv-fcf': t('navigation.ivFcf'),
      };

      breadcrumbs.push({
        id: activeView,
        label: viewLabels[activeView] || activeView,
      });
      return breadcrumbs;
    }

    // Handle other fundamental views
    if (activeView.startsWith('fundamental-')) {
      const viewLabels: Partial<Record<ViewId, string>> = {
        'fundamental-pe-industry': t('navigation.peIndustry'),
        'fundamental-current-ratio': t('navigation.currentRatio'),
        'fundamental-cash-sdebt': t('navigation.cashSdebt'),
        'fundamental-ro40-cy': t('navigation.ro40Cy'),
        'fundamental-ro40-f1': t('navigation.ro40F1'),
        'fundamental-ro40-f2': t('navigation.ro40F2'),
      };

      breadcrumbs.push({
        id: activeView,
        label: viewLabels[activeView] || activeView,
      });
      return breadcrumbs;
    }

    // Fallback
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if we're at home
  }

  return (
    <nav className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-500" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={crumb.id} className="flex items-center">
              {index > 0 && (
                <svg
                  className="w-4 h-4 text-gray-600 dark:text-gray-300 mx-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLast ? (
                <span className="text-gray-900 dark:text-gray-100 font-semibold inline-flex items-center gap-1.5" aria-current="page">
                  {index === 0 && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )}
                  {crumb.label}
                </span>
              ) : crumb.isCategory ? (
                <span className="text-gray-600 dark:text-gray-300">
                  {crumb.label}
                </span>
              ) : (
                <button
                  onClick={() => onViewChange(crumb.id as ViewId)}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-200 hover:underline hover:scale-105 active:scale-95 cursor-pointer font-medium py-2 px-1 -mx-1 min-h-[44px] touch-manipulation inline-flex items-center gap-1.5"
                >
                  {index === 0 && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )}
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

