import { useState, Suspense, useEffect, useCallback } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { logger } from './utils/logger';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import { ViewId } from './types/navigation';
import { getTableMetadata } from './config/tableMetadata';
import type { TableMetadata } from './types/columnMetadata';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { useUserRole } from './hooks/useUserRole';
import { RefreshProvider, useRefresh } from './contexts/RefreshContext';
import { AutoRefreshProvider } from './contexts/AutoRefreshContext';
import { LoadingProgressProvider } from './contexts/LoadingProgressContext';
import { useToast } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import LoadingFallback from './components/LoadingFallback';
import SkipLinks from './components/SkipLinks';
import OfflineIndicator from './components/OfflineIndicator';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import ShareableView from './components/views/ShareableView';
import { ShareableLink } from './services/shareableLinkService';
import { FilterValues } from './types/filters';
import { migrateCoreBoardToScoreBoard, runTruncatedCacheMigrations } from './services/firestoreCacheService';

// Lazy load view components for better performance (with retry for dev "Failed to fetch" resilience)
const ScoreBoardView = lazyWithRetry<typeof import('./components/views/ScoreBoardView').default>(() => import('./components/views/ScoreBoardView'), 'ScoreBoardView');
const ScoreView = lazyWithRetry<typeof import('./components/views/ScoreView').default>(() => import('./components/views/ScoreView'), 'ScoreView');
const EntryExitView = lazyWithRetry<typeof import('./components/views/EntryExitView').default>(() => import('./components/views/EntryExitView'), 'EntryExitView');
const FundamentalView = lazyWithRetry<typeof import('./components/views/FundamentalView').default>(() => import('./components/views/FundamentalView'), 'FundamentalView');
const ThresholdIndustryView = lazyWithRetry<typeof import('./components/views/ThresholdIndustryView').default>(() => import('./components/views/ThresholdIndustryView'), 'ThresholdIndustryView');
const PersonalPortfolioView = lazyWithRetry<typeof import('./components/views/PersonalPortfolioView').default>(() => import('./components/views/PersonalPortfolioView'), 'PersonalPortfolioView');

// Lazy load modal components
const ConditionsModal = lazyWithRetry<typeof import('./components/ConditionsModal').default>(() => import('./components/ConditionsModal'), 'ConditionsModal');
const UserProfileModal = lazyWithRetry<typeof import('./components/UserProfileModal').default>(() => import('./components/UserProfileModal'), 'UserProfileModal');

/**
 * Migrate from localStorage cache to Firestore cache
 * 
 * Clears all localStorage cache entries on first load after migration.
 * This ensures old localStorage cache is not used after switching to Firestore.
 */
function migrateFromLocalStorageCache() {
  const MIGRATION_FLAG = 'cache:migrated-to-firestore';
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) {
      return; // Already migrated
    }
    
    // Clear all cache keys (those starting with 'cache:')
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(MIGRATION_FLAG, 'true');
    
    logger.info('Migrated from localStorage cache to Firestore cache', {
      component: 'App',
      operation: 'migrateFromLocalStorageCache',
      clearedKeys: keysToRemove.length,
    });
  } catch (error) {
    logger.warn('Failed to migrate from localStorage cache', {
      component: 'App',
      operation: 'migrateFromLocalStorageCache',
      error,
    });
  }
}

function App() {
  const { loading: authLoading, currentUser } = useAuth();
  const { canView } = useUserRole();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<ViewId>('score');
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [selectedViewForModal, setSelectedViewForModal] = useState<ViewId | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [loadedShareableLink, setLoadedShareableLink] = useState<ShareableLink | null>(null);

  // Run migration on app start
  useEffect(() => {
    migrateFromLocalStorageCache();
  }, []);

  // Run Firestore cache migrations after user is authenticated
  useEffect(() => {
    if (!authLoading && currentUser) {
      // Run migrations asynchronously in background - don't block app start
      migrateCoreBoardToScoreBoard().catch((error) => {
        logger.warn('Firestore cache migration failed', {
          component: 'App',
          operation: 'migrateCoreBoardToScoreBoard',
          error,
        });
      });
      runTruncatedCacheMigrations().catch((error) => {
        logger.warn('Firestore truncated cache migrations failed', {
          component: 'App',
          operation: 'runTruncatedCacheMigrations',
          error,
        });
      });
    }
  }, [authLoading, currentUser]);

  // Redirect viewers if they try to access unauthorized views
  // This useEffect must be called before any early returns to maintain hook order
  useEffect(() => {
    if (!canView(activeView)) {
      setActiveView('score');
      showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
    }
  }, [activeView, canView, showToast, t]);

  // Background sync and cache warming disabled - using Firestore cache instead

  // IMPORTANT: All hooks (including useCallback, useMemo) must be called BEFORE any early returns
  // This ensures hooks are always called in the same order on every render
  const handleLoadShareableLink = useCallback((link: ShareableLink) => {
    setLoadedShareableLink(link);
    setActiveView(link.viewId as ViewId);
    // Apply filter state and sort config from link
    // This will be handled by the view components
  }, []);

  const handleViewChange = useCallback((viewId: ViewId) => {
    // Check if viewer is trying to access unauthorized view
    if (!canView(viewId)) {
      showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
      return;
    }
    setActiveView(viewId);
    // Update URL without navigation
    navigate(`/${viewId}`, { replace: true });
  }, [canView, showToast, t, navigate]);

  // Show loading state while auth is initializing
  if (authLoading) {
    return <LoadingFallback />;
  }

  // App now works without authentication (viewers can use it without login)

  const handleOpenConditionsModal = (viewId: ViewId) => {
    setSelectedViewForModal(viewId);
    setConditionsModalOpen(true);
  };

  const handleCloseConditionsModal = () => {
    setConditionsModalOpen(false);
    setSelectedViewForModal(null);
  };

  const getTableId = (viewId: ViewId): string | null => {
    if (viewId === 'score-board') return 'score-board';
    if (viewId === 'score') return 'score';
    if (viewId === 'entry-exit-benjamin-graham') return 'benjamin-graham';
    if (viewId === 'fundamental-pe-industry') return 'pe-industry';
    if (viewId === 'threshold-industry') return 'threshold-industry';
    return null;
  };

  const getPageName = (viewId: ViewId): string => {
    const names: Partial<Record<ViewId, string>> = {
      'score-board': t('navigation.scoreBoard'),
      'score': t('navigation.score'),
      'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
      'fundamental-pe-industry': t('navigation.peIndustry'),
      'threshold-industry': t('navigation.thresholdIndustry'),
      'personal-portfolio': t('navigation.personalPortfolio'),
    };
    return names[viewId] || viewId;
  };

  const renderView = () => {
    if (activeView === 'score') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ScoreView />
        </Suspense>
      );
    }

    if (activeView === 'score-board') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ScoreBoardView />
        </Suspense>
      );
    }

    if (activeView.startsWith('entry-exit-')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <EntryExitView viewId={activeView} />
        </Suspense>
      );
    }

    if (activeView.startsWith('fundamental-')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <FundamentalView viewId={activeView} />
        </Suspense>
      );
    }

    if (activeView === 'threshold-industry') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ThresholdIndustryView />
        </Suspense>
      );
    }

    if (activeView === 'personal-portfolio') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <PersonalPortfolioView />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LoadingFallback />}>
        <ScoreView />
      </Suspense>
    );
  };

  const tableId = selectedViewForModal ? getTableId(selectedViewForModal) : null;
  const metadata: TableMetadata | null = tableId ? getTableMetadata(tableId) ?? null : null;
  const pageName = selectedViewForModal ? getPageName(selectedViewForModal) : '';

  // CRITICAL: Provider order is essential for context availability
  // Order MUST be: LoadingProgressProvider (outermost) → RefreshProvider → AutoRefreshProvider (innermost)
  // AutoRefreshProvider requires RefreshProvider to be its direct parent
  // DO NOT change this order without understanding the context dependencies!
  return (
    <Routes>
      <Route
        path="/share/:linkId"
        element={
          <LoadingProgressProvider>
            <RefreshProvider>
              <AutoRefreshProvider>
                <Suspense fallback={<LoadingFallback />}>
                  <ShareableView onLoadLink={handleLoadShareableLink} />
                </Suspense>
              </AutoRefreshProvider>
            </RefreshProvider>
          </LoadingProgressProvider>
        }
      />
      <Route
        path="/*"
        element={
          <LoadingProgressProvider>
            <RefreshProvider>
              <AutoRefreshProvider>
                <AppContent
                  activeView={activeView}
                  setActiveView={handleViewChange}
                  sidebarCollapsed={sidebarCollapsed}
                  setSidebarCollapsed={setSidebarCollapsed}
                  conditionsModalOpen={conditionsModalOpen}
                  handleOpenConditionsModal={handleOpenConditionsModal}
                  handleCloseConditionsModal={handleCloseConditionsModal}
                  selectedViewForModal={selectedViewForModal}
                  renderView={renderView}
                  metadata={metadata}
                  pageName={pageName}
                  userProfileOpen={userProfileOpen}
                  setUserProfileOpen={setUserProfileOpen}
                  loadedShareableLink={loadedShareableLink}
                />
              </AutoRefreshProvider>
            </RefreshProvider>
          </LoadingProgressProvider>
        }
      />
    </Routes>
  );
}

function AppContent({
  activeView,
  setActiveView,
  sidebarCollapsed,
  setSidebarCollapsed,
  conditionsModalOpen,
  handleOpenConditionsModal,
  handleCloseConditionsModal,
  selectedViewForModal: _selectedViewForModal,
  renderView,
  metadata,
  pageName,
  userProfileOpen,
  setUserProfileOpen,
  loadedShareableLink,
}: {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  conditionsModalOpen: boolean;
  handleOpenConditionsModal: (viewId: ViewId) => void;
  handleCloseConditionsModal: () => void;
  selectedViewForModal: ViewId | null;
  renderView: () => JSX.Element;
  metadata: TableMetadata | null;
  pageName: string;
  userProfileOpen: boolean;
  setUserProfileOpen: (open: boolean) => void;
  loadedShareableLink: ShareableLink | null;
}) {
  const { toasts, removeToast } = useToast();
  const { t } = useTranslation();
  const { refreshAll, isRefreshing } = useRefresh();

  // Pull-to-refresh for mobile
  const { containerRef, pullDistance, pullProgress, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: refreshAll,
    disabled: isRefreshing,
    enabled: true,
  });

  const isRefreshingAny = isRefreshing || isPullRefreshing;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SkipLinks />
      <Header 
        onNavigate={setActiveView}
        activeView={activeView}
        sidebarCollapsed={sidebarCollapsed}
      />
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        onOpenConditionsModal={handleOpenConditionsModal}
        isOpen={true}
        onClose={() => {}}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenUserProfile={() => setUserProfileOpen(true)}
      />
      <main 
        ref={containerRef as React.RefObject<HTMLElement>}
        id="main-content" 
        className={`flex-1 mt-16 overflow-y-auto overflow-x-hidden flex flex-col w-full relative ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}
        role="main" 
        aria-label={t('aria.mainContent', 'Huvudinnehåll')}
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance, 80)}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div 
            className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 z-50"
            style={{ 
              opacity: Math.min(pullProgress, 1),
              transform: `translateY(${-pullDistance}px)`,
            }}
          >
            <div className="flex flex-col items-center gap-2">
              {isRefreshingAny ? (
                <>
                  <svg
                    className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin"
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
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {t('pullToRefresh.refreshing', 'Uppdaterar...')}
                  </span>
                </>
              ) : (
                <>
                  <svg
                    className={`w-6 h-6 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${pullProgress >= 1 ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {pullProgress >= 1 
                      ? t('pullToRefresh.release', 'Släpp för att uppdatera')
                      : t('pullToRefresh.pull', 'Dra för att uppdatera')
                    }
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        <Breadcrumbs activeView={activeView} onViewChange={setActiveView} />
        <div className="h-full transition-all duration-300 ease-in-out animate-fade-in" aria-live="polite" aria-atomic="true" role="region">
          {renderView()}
        </div>
      </main>
      {conditionsModalOpen && (
        <Suspense fallback={null}>
          <ConditionsModal
            isOpen={conditionsModalOpen}
            onClose={handleCloseConditionsModal}
            metadata={metadata}
            pageName={pageName}
          />
        </Suspense>
      )}
      {userProfileOpen && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={userProfileOpen}
            onClose={() => setUserProfileOpen(false)}
          />
        </Suspense>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <OfflineIndicator />
    </div>
  );
}

export default App;
