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

/** Maps each ViewId to its breadcrumb label (single level: no parent). */
function getViewLabel(viewId: ViewId, t: (key: string) => string): string {
  const labels: Partial<Record<ViewId, string>> = {
    'score': t('navigation.score'),
    'score-board': t('navigation.scoreBoard'),
    'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
    'entry-exit-entry2': t('navigation.entry2'),
    'entry-exit-exit1': t('navigation.exit1'),
    'entry-exit-exit2': t('navigation.exit2'),
    'entry-exit-irr1': t('navigation.irr1'),
    'entry-exit-iv-fcf': t('navigation.ivFcf'),
    'fundamental-pe-industry': t('navigation.peIndustry'),
    'fundamental-current-ratio': t('navigation.currentRatio'),
    'fundamental-cash-sdebt': t('navigation.cashSdebt'),
    'fundamental-ro40-cy': t('navigation.ro40Cy'),
    'fundamental-ro40-f1': t('navigation.ro40F1'),
    'fundamental-ro40-f2': t('navigation.ro40F2'),
    'threshold-industry': t('navigation.thresholdIndustry'),
    'personal-portfolio': t('navigation.personalPortfolio'),
    'teknikal-tachart': t('navigation.tachart'),
  };
  return labels[viewId] ?? viewId;
}

export default function Breadcrumbs({ activeView, onViewChange }: BreadcrumbsProps) {
  const { t } = useTranslation();

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const label = getViewLabel(activeView, t);
    return [{ id: activeView, label }];
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
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
                <span className="text-black dark:text-white font-semibold inline-flex items-center gap-1.5" aria-current="page">
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
