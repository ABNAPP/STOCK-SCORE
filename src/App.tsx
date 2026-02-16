import { useState, Suspense, useEffect, useCallback } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import { ViewId } from './types/navigation';
import { getTableMetadata } from './config/tableMetadata';
import { getTableId } from './config/viewTableMap';
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
import Login from './components/Login';
import SkipLinks from './components/SkipLinks';
import OfflineIndicator from './components/OfflineIndicator';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import ShareableView from './components/views/ShareableView';
import { ShareableLink } from './services/shareableLinkService';
import { runPostAuthMigrations } from './services/migrations';
import { ShareableHydrationProvider } from './contexts/ShareableHydrationContext';

// Lazy load view components for better performance (with retry for dev "Failed to fetch" resilience)
const ScoreBoardView = lazyWithRetry<typeof import('./components/views/ScoreBoardView').default>(() => import('./components/views/ScoreBoardView'), 'ScoreBoardView');
const ScoreView = lazyWithRetry<typeof import('./components/views/ScoreView').default>(() => import('./components/views/ScoreView'), 'ScoreView');
const EntryExitView = lazyWithRetry<typeof import('./components/views/EntryExitView').default>(() => import('./components/views/EntryExitView'), 'EntryExitView');
const FundamentalView = lazyWithRetry<typeof import('./components/views/FundamentalView').default>(() => import('./components/views/FundamentalView'), 'FundamentalView');
const IndustryThresholdView = lazyWithRetry<typeof import('./components/views/IndustryThresholdView').default>(() => import('./components/views/IndustryThresholdView'), 'IndustryThresholdView');
const PersonalPortfolioView = lazyWithRetry<typeof import('./components/views/PersonalPortfolioView').default>(() => import('./components/views/PersonalPortfolioView'), 'PersonalPortfolioView');

// Lazy load modal components
const ConditionsModal = lazyWithRetry<typeof import('./components/ConditionsModal').default>(() => import('./components/ConditionsModal'), 'ConditionsModal');
const UserProfileModal = lazyWithRetry<typeof import('./components/UserProfileModal').default>(() => import('./components/UserProfileModal'), 'UserProfileModal');
const HelpModal = lazyWithRetry<typeof import('./components/HelpModal').default>(() => import('./components/HelpModal'), 'HelpModal');

const MAIN_VIEW_IDS: ViewId[] = [
  'score',
  'score-board',
  'entry-exit-benjamin-graham',
  'fundamental-pe-industry',
  'industry-threshold',
  'personal-portfolio',
];

function isValidViewPath(path: string): path is ViewId {
  return (MAIN_VIEW_IDS as string[]).includes(path);
}

function App() {
  const { loading: authLoading, currentUser } = useAuth();
  const { canView, getDefaultLandingView } = useUserRole();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<ViewId>('score');
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [selectedViewForModal, setSelectedViewForModal] = useState<ViewId | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [loadedShareableLink, setLoadedShareableLink] = useState<ShareableLink | null>(null);

  const handleOpenHelpModal = useCallback(() => setHelpModalOpen(true), []);
  const handleCloseHelpModal = useCallback(() => setHelpModalOpen(false), []);

  // Run post-auth migrations and setup when user is authenticated
  useEffect(() => {
    if (!authLoading && currentUser) {
      runPostAuthMigrations();
    }
  }, [authLoading, currentUser]);

  // Sync activeView from URL and handle redirects for unauthorized access
  useEffect(() => {
    if (!currentUser) return;
    const rawPath = location.pathname.replace(/^\//, '');
    const path = rawPath || 'score';
    const defaultView = getDefaultLandingView();

    if (isValidViewPath(path)) {
      if (canView(path)) {
        setActiveView(path);
      } else {
        navigate(`/${defaultView}`, { replace: true });
        setActiveView(defaultView);
        showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
      }
      return;
    }

    // Unknown path or empty: sync to default and update URL
    if (path !== defaultView) {
      navigate(`/${defaultView}`, { replace: true });
      setActiveView(defaultView);
    }
  }, [currentUser, location.pathname, canView, getDefaultLandingView, navigate, showToast, t]);

  // Redirect if activeView becomes unauthorized (e.g. role change)
  useEffect(() => {
    if (!canView(activeView)) {
      const defaultView = getDefaultLandingView();
      setActiveView(defaultView);
      navigate(`/${defaultView}`, { replace: true });
      showToast(t('common.unauthorizedView') || 'Du har inte tillgång till denna vy', 'warning');
    }
  }, [activeView, canView, getDefaultLandingView, navigate, showToast, t]);

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

  // Expose handleViewChange for RBAC integration tests (D1)
  useEffect(() => {
    if (typeof window !== 'undefined' && import.meta.env.MODE === 'test') {
      (window as Window & { __STOCK_SCORE_TEST__?: { handleViewChange: (viewId: ViewId) => void } }).__STOCK_SCORE_TEST__ = {
        ...(window as Window & { __STOCK_SCORE_TEST__?: object }).__STOCK_SCORE_TEST__,
        handleViewChange,
      };
    }
  }, [handleViewChange]);

  // Show loading state while auth is initializing
  if (authLoading) {
    return <LoadingFallback />;
  }

  // Require login: show Login when not authenticated
  if (!currentUser) {
    const returnUrl = location.pathname + location.search;
    return <Login returnUrl={returnUrl !== '/' ? returnUrl : undefined} />;
  }

  const handleOpenConditionsModal = (viewId: ViewId) => {
    setSelectedViewForModal(viewId);
    setConditionsModalOpen(true);
  };

  const handleCloseConditionsModal = () => {
    setConditionsModalOpen(false);
    setSelectedViewForModal(null);
  };

  const getPageName = (viewId: ViewId): string => {
    const names: Partial<Record<ViewId, string>> = {
      'score-board': t('navigation.scoreBoard'),
      'score': t('navigation.score'),
      'entry-exit-benjamin-graham': t('navigation.benjaminGraham'),
      'fundamental-pe-industry': t('navigation.peIndustry'),
      'industry-threshold': t('navigation.industryThreshold'),
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

    if (activeView === 'industry-threshold') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <IndustryThresholdView />
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
                  helpModalOpen={helpModalOpen}
                  onOpenHelpModal={handleOpenHelpModal}
                  onCloseHelpModal={handleCloseHelpModal}
                  loadedShareableLink={loadedShareableLink}
                  onConsumeShareableLink={() => setLoadedShareableLink(null)}
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
  helpModalOpen,
  onOpenHelpModal,
  onCloseHelpModal,
  loadedShareableLink,
  onConsumeShareableLink,
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
  helpModalOpen: boolean;
  onOpenHelpModal: () => void;
  onCloseHelpModal: () => void;
  loadedShareableLink: ShareableLink | null;
  onConsumeShareableLink: () => void;
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
    <ShareableHydrationProvider link={loadedShareableLink} onConsume={onConsumeShareableLink}>
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SkipLinks />
      <Header 
        onNavigate={setActiveView}
        activeView={activeView}
        sidebarCollapsed={sidebarCollapsed}
        onOpenHelpModal={onOpenHelpModal}
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
      {helpModalOpen && (
        <Suspense fallback={null}>
          <HelpModal
            isOpen={helpModalOpen}
            onClose={onCloseHelpModal}
            viewId={activeView}
          />
        </Suspense>
      )}
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
    </ShareableHydrationProvider>
  );
}

export default App;
