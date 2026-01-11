import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useAutoRefresh, AUTO_REFRESH_INTERVALS } from '../contexts/AutoRefreshContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUserRole } from '../hooks/useUserRole';
import HamburgerMenu from './HamburgerMenu';
import GlobalSearch from './GlobalSearch';
import { ViewId } from '../types/navigation';

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
  onNavigate?: (viewId: ViewId) => void;
  onOpenUserProfile?: () => void;
}

export default function Header({ onMenuToggle, isMenuOpen, onNavigate, onOpenUserProfile }: HeaderProps) {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { refreshAll, isRefreshing } = useRefresh();
  const { enabled, interval, setEnabled, setIntervalValue } = useAutoRefresh();
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

  const handleAutoRefreshChange = (value: string) => {
    const intervalValue = parseInt(value, 10);
    if (intervalValue === AUTO_REFRESH_INTERVALS.OFF) {
      setEnabled(false);
      setIntervalValue(AUTO_REFRESH_INTERVALS.MIN_30); // Keep interval even when disabled
    } else {
      setEnabled(true);
      setIntervalValue(intervalValue);
    }
  };

  const getAutoRefreshValue = () => {
    if (!enabled || !interval || interval === 0) {
      return AUTO_REFRESH_INTERVALS.OFF.toString();
    }
    // Ensure interval matches one of the valid intervals
    const validIntervals = [
      AUTO_REFRESH_INTERVALS.OFF,
      AUTO_REFRESH_INTERVALS.MIN_15,
      AUTO_REFRESH_INTERVALS.MIN_30,
      AUTO_REFRESH_INTERVALS.MIN_60,
    ];
    if (!validIntervals.includes(interval)) {
      return AUTO_REFRESH_INTERVALS.OFF.toString();
    }
    return interval.toString();
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
        {/* Auto-refresh dropdown */}
        <div className="relative flex items-center">
          <select
            value={getAutoRefreshValue()}
            onChange={(e) => handleAutoRefreshChange(e.target.value)}
            className="px-3 sm:px-3 py-2.5 sm:py-1.5 text-sm border border-gray-300 dark:border-gray-400 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer min-h-[44px] touch-manipulation pr-8"
            title={t('refresh.autoRefresh')}
          >
            <option value={AUTO_REFRESH_INTERVALS.OFF}>{t('refresh.autoRefreshOff')}</option>
            <option value={AUTO_REFRESH_INTERVALS.MIN_15}>{t('refresh.autoRefresh15Min')}</option>
            <option value={AUTO_REFRESH_INTERVALS.MIN_30}>{t('refresh.autoRefresh30Min')}</option>
            <option value={AUTO_REFRESH_INTERVALS.MIN_60}>{t('refresh.autoRefresh60Min')}</option>
          </select>
          {/* Active indicator */}
          {enabled && interval > 0 && (
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse"
              title={t('refresh.autoRefreshActive')}
            />
          )}
        </div>
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
        {currentUser && onOpenUserProfile && (
          <button
            onClick={onOpenUserProfile}
            className="px-3 sm:px-4 py-2.5 sm:py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 active:bg-gray-800 transition-all duration-200 flex items-center space-x-2 shadow-sm hover:shadow-md active:scale-95 min-h-[44px] touch-manipulation"
            title={t('profile.title')}
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="hidden sm:inline">{t('profile.title')}</span>
          </button>
        )}
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
