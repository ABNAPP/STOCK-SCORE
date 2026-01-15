import { useState, Suspense, lazy, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { warmCache } from './services/cacheWarmingService';
import { logger } from './utils/logger';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import AuthContainer from './components/AuthContainer';
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

// Lazy load view components for better performance
const ScoreBoardView = lazy(() => import('./components/views/ScoreBoardView'));
const ScoreView = lazy(() => import('./components/views/ScoreView'));
const EntryExitView = lazy(() => import('./components/views/EntryExitView'));
const FundamentalView = lazy(() => import('./components/views/FundamentalView'));
const ThresholdIndustryView = lazy(() => import('./components/views/ThresholdIndustryView'));

// Lazy load modal components
const ConditionsModal = lazy(() => import('./components/ConditionsModal'));
const UserProfileModal = lazy(() => import('./components/UserProfileModal'));

function App() {
  const { currentUser } = useAuth();
  const { hasRole, userRole } = useUserRole();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<ViewId>('score');
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [selectedViewForModal, setSelectedViewForModal] = useState<ViewId | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [loadedShareableLink, setLoadedShareableLink] = useState<ShareableLink | null>(null);

  // Redirect viewer2 users if they try to access unauthorized views
  // This useEffect must be called before any early returns to maintain hook order
  useEffect(() => {
    if (userRole === 'viewer2') {
      const allowedViews: ViewId[] = ['score', 'score-board'];
      if (!allowedViews.includes(activeView)) {
        setActiveView('score');
        showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
      }
    }
  }, [activeView, userRole, showToast, t]);

  // Cache warming: Preload cache data in background when user is authenticated
  useEffect(() => {
    if (currentUser) {
      // Warm cache in background (fire-and-forget)
      warmCache().catch(error => {
        // Silently fail - cache warming is not critical
        if (import.meta.env.DEV) {
          logger.debug('Cache warming failed', { component: 'App', operation: 'warmCache', error });
        }
      });
    }
  }, [currentUser]);

  // Show login/signup if user is not authenticated
  if (!currentUser) {
    return <AuthContainer />;
  }

  const handleViewChange = (viewId: ViewId) => {
    // Check if viewer2 is trying to access unauthorized view
    if (userRole === 'viewer2') {
      const allowedViews: ViewId[] = ['score', 'score-board'];
      if (!allowedViews.includes(viewId)) {
        showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
        return;
      }
    }
    setActiveView(viewId);
    // Update URL without navigation
    navigate(`/${viewId}`, { replace: true });
  };

  const handleLoadShareableLink = useCallback((link: ShareableLink) => {
    setLoadedShareableLink(link);
    setActiveView(link.viewId as ViewId);
    // Apply filter state and sort config from link
    // This will be handled by the view components
  }, []);

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
    if (viewId === 'entry-exit-entry1') return 'entry-exit-entry1';
    if (viewId === 'fundamental-pe-industry') return 'pe-industry';
    if (viewId === 'threshold-industry') return 'threshold-industry';
    return null;
  };

  const getPageName = (viewId: ViewId): string => {
    const names: Partial<Record<ViewId, string>> = {
      'score-board': t('navigation.scoreBoard'),
      'score': t('navigation.score'),
      'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
      'entry-exit-entry1': t('navigation.tachart'),
      'fundamental-pe-industry': t('navigation.peIndustry'),
      'threshold-industry': t('navigation.thresholdIndustry'),
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
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
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
  sidebarOpen,
  setSidebarOpen,
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
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
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
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        isMenuOpen={sidebarOpen}
        onNavigate={setActiveView}
        onOpenUserProfile={() => setUserProfileOpen(true)}
      />
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        onOpenConditionsModal={handleOpenConditionsModal}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main 
        ref={containerRef as React.RefObject<HTMLElement>}
        id="main-content" 
        className="flex-1 lg:ml-64 mt-16 overflow-y-auto overflow-x-hidden flex flex-col w-full relative" 
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
