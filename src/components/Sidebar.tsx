import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewId, NavigationSection } from '../types/navigation';
import ConditionsSidebar from './ConditionsSidebar';
import { useUserRole } from '../hooks/useUserRole';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { useAuth } from '../contexts/AuthContext';
import { 
  TrophyIcon, 
  ChartBarIcon, 
  CursorArrowRaysIcon, 
  ChartPieIcon,
  BuildingOfficeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (viewId: ViewId) => void;
  onOpenConditionsModal: (viewId: ViewId) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenUserProfile?: () => void;
}

const getAllNavigationSections = (t: (key: string) => string): NavigationSection[] => [
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
    id: 'threshold-industry',
    label: t('navigation.thresholdIndustry'),
    items: [{ id: 'threshold-industry', label: t('navigation.thresholdIndustry') }],
    collapsible: false,
  },
];

// Icon mapping for each view
const getViewIcon = (viewId: ViewId) => {
  switch (viewId) {
    case 'score':
      return TrophyIcon;
    case 'score-board':
      return ChartBarIcon;
    case 'entry-exit-benjamin-graham':
      return CursorArrowRaysIcon;
    case 'fundamental-pe-industry':
      return ChartPieIcon;
    case 'threshold-industry':
      return BuildingOfficeIcon;
    default:
      return null;
  }
};

export default function Sidebar({ activeView, onViewChange, onOpenConditionsModal, isOpen, onClose, isCollapsed, onToggleCollapse, onOpenUserProfile }: SidebarProps) {
  const { t } = useTranslation();
  const { canView, isAdmin } = useUserRole();
  const { currentUser } = useAuth();
  
  // Filter navigation sections based on user permissions
  const navigationSections = useMemo(() => {
    const allSections = getAllNavigationSections(t);
    
    // Filter sections based on what views user can access
    return allSections.filter(section => {
      // Check if user can view any item in this section
      return section.items.some(item => canView(item.id));
    });
  }, [t, canView]);
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

  // Swipe gesture for mobile: close sidebar when swiping left
  const sidebarRef = useSwipeGesture({
    onSwipeLeft: () => {
      // Only close on mobile when sidebar is open
      if (isOpen && window.innerWidth < 1024) {
        onClose();
      }
    },
  });

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
        ref={sidebarRef}
        id="navigation"
        className={`fixed top-0 left-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-500 overflow-y-auto pt-6 z-50 transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        } lg:translate-x-0 lg:opacity-100 ${isCollapsed ? 'w-16' : 'w-64'}`}
        aria-label={t('navigation.title')}
      >
        <div className={`${isCollapsed ? 'px-2' : 'px-4'} pb-4 pt-0 flex flex-col flex-1`}>
          {/* Toggle button */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} mb-4`}>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
              aria-label={isCollapsed ? t('aria.expandSidebar') : t('aria.collapseSidebar')}
              title={isCollapsed ? t('aria.expandSidebar') : t('aria.collapseSidebar')}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
          
          {/* Title */}
          {!isCollapsed && (
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6 tracking-tight">
              {t('navigation.title')}
            </h2>
          )}
        
        <nav className="space-y-2 flex-1 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.id}>
              {section.collapsible && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-3 sm:py-2.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 hover:scale-[1.02] active:scale-95 min-h-[44px] touch-manipulation"
                  aria-expanded={isSectionExpanded(section.id)}
                  aria-label={`${section.label}, ${isSectionExpanded(section.id) ? t('aria.closeMenu') : t('aria.openMenu')}`}
                >
                  <span className="tracking-wide">{section.label}</span>
                  <span className="text-gray-600 dark:text-gray-300 text-xs" aria-hidden="true">
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
                            aria-expanded={isSubmenuExpanded(item.id)}
                            aria-label={`${item.label}, ${isSubmenuExpanded(item.id) ? t('aria.closeMenu') : t('aria.openMenu')}`}
                          >
                            <span>{item.label}</span>
                            <span className="text-gray-600 dark:text-gray-300 text-xs" aria-hidden="true">
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
                                  aria-label={`${t('aria.navigateTo')} ${child.label}`}
                                  aria-current={isActive(child.id) ? 'page' : undefined}
                                >
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const IconComponent = getViewIcon(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full ${isCollapsed ? 'px-2 justify-center' : 'px-3'} py-3 sm:py-2.5 ${isCollapsed ? '' : 'text-left'} text-sm rounded-md transition-colors min-h-[44px] touch-manipulation flex items-center gap-3 ${
                          isActive(item.id)
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95'
                        }`}
                        aria-label={`${t('aria.navigateTo')} ${item.label}`}
                        aria-current={isActive(item.id) ? 'page' : undefined}
                        title={isCollapsed ? item.label : undefined}
                      >
                        {IconComponent && (
                          <IconComponent className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
                        )}
                        {!isCollapsed && <span>{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          
          {/* Conditions Section */}
          {!isCollapsed && (
            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-500">
              <ConditionsSidebar onOpenModal={onOpenConditionsModal} />
            </div>
          )}
        </nav>
        
        {/* Profile Button - at bottom */}
        {currentUser && onOpenUserProfile && (
          <div className="mt-auto pt-4 border-t border-gray-300 dark:border-gray-500">
            <button
              onClick={() => {
                onOpenUserProfile();
                // Close sidebar on mobile when profile is clicked
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
              className={`w-full ${isCollapsed ? 'px-2 justify-center' : 'px-3'} py-3 sm:py-2.5 ${isCollapsed ? '' : 'text-left'} text-sm rounded-md transition-colors min-h-[44px] touch-manipulation flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95`}
              title={isCollapsed ? t('profile.title') : undefined}
              aria-label={t('aria.userProfileButton')}
            >
              <UserIcon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
              {!isCollapsed && <span>{t('profile.title')}</span>}
            </button>
          </div>
        )}
      </div>
      </nav>
    </>
  );
}
