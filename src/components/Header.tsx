import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import HamburgerMenu from './HamburgerMenu';
import GlobalSearch from './GlobalSearch';
import { ViewId } from '../types/navigation';

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
  onNavigate?: (viewId: ViewId) => void;
}

export default function Header({ onMenuToggle, isMenuOpen, onNavigate }: HeaderProps) {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { refreshAll, isRefreshing } = useRefresh();
  const { currentUser, logout } = useAuth();
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      showToast(t('auth.logoutSuccess'), 'success');
    } catch (error: any) {
      showToast(t('auth.logoutFailed'), 'error');
    }
  };

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    localStorage.setItem('stockScoreLanguage', language);
  };

  return (
    <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-400 fixed top-0 left-0 lg:left-64 right-0 z-30 flex items-center justify-between px-4">
      {/* Hamburger menu - visible on mobile */}
      <div className="lg:hidden">
        <HamburgerMenu isOpen={isMenuOpen} onClick={onMenuToggle} />
      </div>
      
      {/* Global Search - visible on desktop and tablet */}
      <div className="hidden sm:block flex-1 max-w-md mx-2 sm:mx-4">
        {onNavigate && <GlobalSearch onNavigate={onNavigate} />}
      </div>

      {/* Right side controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {currentUser && (
          <div className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 mr-2">
            {currentUser.email}
          </div>
        )}
        <button
          onClick={refreshAll}
          disabled={isRefreshing}
          className="px-3 sm:px-4 py-2.5 sm:py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md active:scale-95 min-h-[44px] touch-manipulation"
          title={t('refresh.refreshAllTooltip')}
        >
          <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`}
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
          <span className="hidden sm:inline">{isRefreshing ? t('refresh.refreshing') : t('refresh.refreshAll')}</span>
        </button>
        {currentUser && (
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2.5 sm:py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md active:scale-95 min-h-[44px] touch-manipulation"
            title={t('auth.logout')}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden sm:inline">{t('auth.logout')}</span>
          </button>
        )}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          className="px-3 sm:px-3 py-2.5 sm:py-1.5 text-sm border border-gray-300 dark:border-gray-400 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer min-h-[44px] touch-manipulation"
        >
          <option value="system">💻 System</option>
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
        </select>
        <select
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="px-3 sm:px-3 py-2.5 sm:py-1.5 text-sm border border-gray-300 dark:border-gray-400 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer min-h-[44px] touch-manipulation"
        >
          <option value="en">🇬🇧 English</option>
          <option value="sv">🇸🇪 Svenska</option>
        </select>
      </div>
    </div>
  );
}
