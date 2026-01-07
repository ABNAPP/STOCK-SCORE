import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewId, NavigationSection } from '../types/navigation';
import ConditionsSidebar from './ConditionsSidebar';

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (viewId: ViewId) => void;
  onOpenConditionsModal: (viewId: ViewId) => void;
  isOpen: boolean;
  onClose: () => void;
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
    id: 'entry-exit-entry1',
    label: t('navigation.tachart'),
    items: [{ id: 'entry-exit-entry1', label: t('navigation.tachart') }],
    collapsible: false,
  },
  {
    id: 'teknikal-sma-100',
    label: t('navigation.sma100'),
    items: [{ id: 'teknikal-sma-100', label: t('navigation.sma100') }],
    collapsible: false,
  },
  {
    id: 'threshold-industry',
    label: t('navigation.thresholdIndustry'),
    items: [{ id: 'threshold-industry', label: t('navigation.thresholdIndustry') }],
    collapsible: false,
  },
];

export default function Sidebar({ activeView, onViewChange, onOpenConditionsModal, isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const navigationSections = getNavigationSections(t);
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

  const handleItemClick = (viewId: ViewId) => {
    onViewChange(viewId);
    // Close sidebar on mobile when item is clicked
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const isSectionExpanded = (sectionId: string) => expandedSections.has(sectionId);
  const isSubmenuExpanded = (itemId: string) => expandedSubmenus.has(itemId);
  const isActive = (viewId: ViewId) => activeView === viewId;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <nav
        id="navigation"
        className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-500 overflow-y-auto pt-16 z-50 transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        } lg:translate-x-0 lg:opacity-100 w-64`}
        aria-label={t('navigation.title')}
      >
        <div className="p-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">{t('navigation.title')}</h2>
        
        <nav className="space-y-2">
          {navigationSections.map((section) => (
            <div key={section.id}>
              {section.collapsible && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-3 sm:py-2.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 hover:scale-[1.02] active:scale-95 min-h-[44px] touch-manipulation"
                >
                  <span className="tracking-wide">{section.label}</span>
                  <span className="text-gray-600 dark:text-gray-300 text-xs">
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
                            <span className="text-gray-600 dark:text-gray-300 text-xs">
                              {isSubmenuExpanded(item.id) ? '▼' : '▶'}
                            </span>
                          </button>
                          {isSubmenuExpanded(item.id) && (
                            <div className="ml-4 space-y-1">
                              {item.children.map((child) => (
                                <button
                                  key={child.id}
                                  onClick={() => handleItemClick(child.id)}
                                  className={`w-full px-3 py-3 sm:py-2 text-left text-sm rounded transition-colors min-h-[44px] touch-manipulation ${
                                    isActive(child.id)
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium'
                                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-[1.02] active:scale-95'
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
                        className={`w-full px-3 py-3 sm:py-2.5 text-left text-sm rounded-md transition-colors min-h-[44px] touch-manipulation ${
                          isActive(item.id)
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95'
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
          
          {/* Conditions Section */}
          <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-500">
            <ConditionsSidebar onOpenModal={onOpenConditionsModal} />
          </div>
        </nav>
      </div>
      </nav>
    </>
  );
}
