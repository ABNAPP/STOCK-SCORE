import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewId, NavigationSection } from '../types/navigation';
import { getTableMetadata } from '../config/tableMetadata';
import { getTableId } from '../config/viewTableMap';

interface ConditionsSidebarProps {
  onOpenModal: (viewId: ViewId) => void;
}

const getNavigationSections = (t: (key: string) => string): NavigationSection[] => [
  {
    id: 'score',
    label: t('navigation.score'),
    items: [{ id: 'score', label: t('navigation.score') }],
    collapsible: false,
  },
  {
    id: 'score-board',
    label: t('navigation.scoreBoard'),
    items: [{ id: 'score-board', label: t('navigation.scoreBoard') }],
    collapsible: false,
  },
  {
    id: 'entry-exit-benjamin-graham',
    label: t('navigation.benjaminGraham'),
    items: [{ id: 'entry-exit-benjamin-graham', label: t('navigation.benjaminGraham') }],
    collapsible: false,
  },
  {
    id: 'fundamental-pe-industry',
    label: t('navigation.peIndustry'),
    items: [{ id: 'fundamental-pe-industry', label: t('navigation.peIndustry') }],
    collapsible: false,
  },
  {
    id: 'industry-threshold',
    label: t('navigation.industryThreshold'),
    items: [{ id: 'industry-threshold', label: t('navigation.industryThreshold') }],
    collapsible: false,
  },
  {
    id: 'personal-portfolio',
    label: t('navigation.personalPortfolio'),
    items: [{ id: 'personal-portfolio', label: t('navigation.personalPortfolio') }],
    collapsible: false,
  },
];

export default function ConditionsSidebar({ onOpenModal }: ConditionsSidebarProps) {
  const { t } = useTranslation();
  const navigationSections = getNavigationSections(t);
  const [isConditionExpanded, setIsConditionExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['score'])
  );

  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleSubmenu = (itemId: string) => {
    setExpandedSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const hasMetadata = (viewId: ViewId): boolean => {
    const tableId = getTableId(viewId);
    return tableId !== null && getTableMetadata(tableId) !== undefined;
  };

  const handleItemClick = (viewId: ViewId) => {
    if (hasMetadata(viewId)) {
      onOpenModal(viewId);
    }
  };

  const isSectionExpanded = (sectionId: string) => expandedSections.has(sectionId);
  const isSubmenuExpanded = (itemId: string) => expandedSubmenus.has(itemId);

  return (
    <div>
      <button
        onClick={() => setIsConditionExpanded(!isConditionExpanded)}
        className="w-full flex items-center justify-between px-3 py-3 sm:py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all duration-200 hover:scale-[1.02] active:scale-95 min-h-[44px] touch-manipulation"
      >
        <span>{t('navigation.condition')}</span>
        <span className="text-gray-500 dark:text-gray-400 transition-transform duration-200">
          {isConditionExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isConditionExpanded && (
        <div className="ml-2 space-y-1 mt-1">
          {navigationSections.map((section) => (
        <div key={section.id}>
          {section.collapsible && (
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-3 py-3 sm:py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all duration-200 hover:scale-[1.02] active:scale-95 min-h-[44px] touch-manipulation"
            >
              <span>{section.label}</span>
              <span className="text-gray-500 dark:text-gray-400 transition-transform duration-200">
                {isSectionExpanded(section.id) ? '▼' : '▶'}
              </span>
            </button>
          )}

          {(!section.collapsible || isSectionExpanded(section.id)) && (
            <div className="ml-2 space-y-1">
              {section.items.map((item) => {
                if (item.children) {
                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => toggleSubmenu(item.id)}
                        className="w-full flex items-center justify-between px-3 py-3 sm:py-2 text-left text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-all duration-200 hover:scale-[1.02] active:scale-95 min-h-[44px] touch-manipulation"
                      >
                        <span>{item.label}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs transition-transform duration-200">
                          {isSubmenuExpanded(item.id) ? '▼' : '▶'}
                        </span>
                      </button>
                      {isSubmenuExpanded(item.id) && (
                        <div className="ml-4 space-y-1">
                          {item.children.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => handleItemClick(child.id)}
                              disabled={!hasMetadata(child.id)}
                              className={`w-full px-3 py-3 sm:py-2 text-left text-sm rounded transition-all duration-200 min-h-[44px] touch-manipulation ${
                                hasMetadata(child.id)
                                  ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-[1.02] active:scale-95'
                                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              }`}
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    disabled={!hasMetadata(item.id)}
                    className={`w-full px-3 py-3 sm:py-2 text-left text-sm rounded transition-all duration-200 min-h-[44px] touch-manipulation ${
                      hasMetadata(item.id)
                        ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-[1.02] active:scale-95'
                        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
        </div>
      )}
    </div>
  );
}
