import { useState, Suspense, lazy } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import ConditionsModal from './components/ConditionsModal';
import AuthContainer from './components/AuthContainer';
import WaitingApproval from './components/WaitingApproval';
import { ViewId } from './types/navigation';
import { getTableMetadata } from './config/tableMetadata';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { useUserRole } from './hooks/useUserRole';
import { RefreshProvider } from './contexts/RefreshContext';
import { AutoRefreshProvider } from './contexts/AutoRefreshContext';
import { LoadingProgressProvider } from './contexts/LoadingProgressContext';
import { useToast } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import LoadingFallback from './components/LoadingFallback';
import SkipLinks from './components/SkipLinks';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';

// Lazy load view components for better performance
const ScoreBoardView = lazy(() => import('./components/views/ScoreBoardView'));
const ScoreView = lazy(() => import('./components/views/ScoreView'));
const EntryExitView = lazy(() => import('./components/views/EntryExitView'));
const FundamentalView = lazy(() => import('./components/views/FundamentalView'));
const TeknikalView = lazy(() => import('./components/views/TeknikalView'));
const ThresholdIndustryView = lazy(() => import('./components/views/ThresholdIndustryView'));

function App() {
  const { currentUser } = useAuth();
  const { hasRole } = useUserRole();
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ViewId>('score');
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [selectedViewForModal, setSelectedViewForModal] = useState<ViewId | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  // Show login/signup if user is not authenticated
  if (!currentUser) {
    return <AuthContainer />;
  }

  // Show waiting approval screen if user has no role
  if (!hasRole) {
    return <WaitingApproval />;
  }

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
    if (viewId === 'teknikal-sma-100') return 'sma-100';
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
      'teknikal-sma-100': t('navigation.sma100'),
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

    if (activeView.startsWith('teknikal-')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <TeknikalView viewId={activeView} />
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
  const metadata = tableId ? getTableMetadata(tableId) : null;
  const pageName = selectedViewForModal ? getPageName(selectedViewForModal) : '';

  // CRITICAL: Provider order is essential for context availability
  // Order MUST be: LoadingProgressProvider (outermost) → RefreshProvider → AutoRefreshProvider (innermost)
  // AutoRefreshProvider requires RefreshProvider to be its direct parent
  // DO NOT change this order without understanding the context dependencies!
  return (
    <LoadingProgressProvider>
      <RefreshProvider>
        <AutoRefreshProvider>
          <AppContent
            activeView={activeView}
            setActiveView={setActiveView}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            conditionsModalOpen={conditionsModalOpen}
            handleOpenConditionsModal={handleOpenConditionsModal}
            handleCloseConditionsModal={handleCloseConditionsModal}
            selectedViewForModal={selectedViewForModal}
            renderView={renderView}
            metadata={metadata}
            pageName={pageName}
            adminPanelOpen={adminPanelOpen}
            setAdminPanelOpen={setAdminPanelOpen}
            userProfileOpen={userProfileOpen}
            setUserProfileOpen={setUserProfileOpen}
          />
        </AutoRefreshProvider>
      </RefreshProvider>
    </LoadingProgressProvider>
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
  adminPanelOpen,
  setAdminPanelOpen,
  userProfileOpen,
  setUserProfileOpen,
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
  metadata: any;
  pageName: string;
  adminPanelOpen: boolean;
  setAdminPanelOpen: (open: boolean) => void;
  userProfileOpen: boolean;
  setUserProfileOpen: (open: boolean) => void;
}) {
  const { toasts, removeToast } = useToast();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <SkipLinks />
      <Header 
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        isMenuOpen={sidebarOpen}
        onNavigate={setActiveView}
        onOpenAdminPanel={() => setAdminPanelOpen(true)}
        onOpenUserProfile={() => setUserProfileOpen(true)}
      />
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        onOpenConditionsModal={handleOpenConditionsModal}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main id="main-content" className="flex-1 lg:ml-64 mt-16 overflow-hidden flex flex-col w-full" role="main" aria-label={useTranslation().t('aria.mainContent', 'Huvudinnehåll')}>
        <Breadcrumbs activeView={activeView} onViewChange={setActiveView} />
        <div className="h-full transition-all duration-300 ease-in-out animate-fade-in" aria-live="polite" aria-atomic="true" role="region">
          {renderView()}
        </div>
      </main>
      <ConditionsModal
        isOpen={conditionsModalOpen}
        onClose={handleCloseConditionsModal}
        metadata={metadata}
        pageName={pageName}
      />
      {/* Admin Panel Modal */}
      {adminPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 animate-fade-in transition-opacity duration-300 p-4 overflow-y-auto"
          onClick={() => setAdminPanelOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8 animate-scale-in transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <AdminPanel onClose={() => setAdminPanelOpen(false)} />
          </div>
        </div>
      )}
      {/* User Profile Modal */}
      {userProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 animate-fade-in transition-opacity duration-300 p-4 overflow-y-auto"
          onClick={() => setUserProfileOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 animate-scale-in transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <UserProfile onClose={() => setUserProfileOpen(false)} />
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
