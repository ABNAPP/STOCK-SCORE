import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useAutoRefresh, AUTO_REFRESH_INTERVALS } from '../contexts/AutoRefreshContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useUserRole } from '../hooks/useUserRole';
import HamburgerMenu from './HamburgerMenu';
import GlobalSearch from './GlobalSearch';
import NotificationCenter from './NotificationCenter';
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
  const { unreadCount } = useNotifications();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const refreshMenuRef = useRef<HTMLDivElement>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      showToast(t('auth.logoutSuccess'), 'success');
    } catch (error: unknown) {
      showToast(t('auth.logoutFailed'), 'error');
    }
  };

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    localStorage.setItem('stockScoreLanguage', language);
  };

  const getAutoRefreshValue = () => {
    if (!enabled || !interval || interval === 0) {
      return AUTO_REFRESH_INTERVALS.OFF.toString();
    }
    // Ensure interval matches one of the valid intervals (MIN_15 removed from UI)
    const validIntervals = [
      AUTO_REFRESH_INTERVALS.OFF,
      AUTO_REFRESH_INTERVALS.MIN_30,
      AUTO_REFRESH_INTERVALS.MIN_60,
    ];
    if (!validIntervals.includes(interval)) {
      return AUTO_REFRESH_INTERVALS.OFF.toString();
    }
    return interval.toString();
  };

  const handleRefreshNow = async () => {
    setRefreshMenuOpen(false);
    await refreshAll();
  };

  const handleRefreshAutoRefreshChange = (intervalValue: number) => {
    if (intervalValue === AUTO_REFRESH_INTERVALS.OFF) {
      setEnabled(false);
      setIntervalValue(AUTO_REFRESH_INTERVALS.MIN_30); // Keep interval even when disabled
    } else {
      setEnabled(true);
      setIntervalValue(intervalValue);
    }
    setRefreshMenuOpen(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(event.target as Node)) {
        setRefreshMenuOpen(false);
      }
    };

    if (themeMenuOpen || languageMenuOpen || refreshMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [themeMenuOpen, languageMenuOpen, refreshMenuOpen]);

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        );
      case 'light':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setThemeMenuOpen(false);
  };

  const handleLanguageChange = (language: string) => {
    changeLanguage(language);
    setLanguageMenuOpen(false);
  };

  const getLanguageIcon = () => {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    );
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
        {/* Combined Refresh Button with Dropdown */}
        <div className="relative" ref={refreshMenuRef}>
          <button
            onClick={() => setRefreshMenuOpen(!refreshMenuOpen)}
            disabled={isRefreshing}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation relative"
            title={t('refresh.refreshAllTooltip')}
            aria-label={t('refresh.refreshAllTooltip')}
            aria-expanded={refreshMenuOpen}
          >
            <svg
              className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {/* Active indicator when auto-refresh is enabled */}
            {enabled && interval > 0 && (
              <div
                className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border-2 border-white dark:border-gray-800"
                title={t('refresh.autoRefreshActive')}
              />
            )}
          </button>

          {/* Dropdown Menu */}
          {refreshMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-scale-in"
              role="menu"
              aria-label={t('aria.refreshMenu')}
            >
              {/* Refresh Now */}
              <button
                onClick={handleRefreshNow}
                disabled={isRefreshing}
                className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                role="menuitem"
                aria-label={t('aria.refreshNowButton')}
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {isRefreshing ? t('refresh.refreshing') : t('refresh.refreshNow')}
                </span>
              </button>

              {/* Separator */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              {/* Auto-refresh Options */}
              <button
                onClick={() => handleRefreshAutoRefreshChange(AUTO_REFRESH_INTERVALS.OFF)}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  !enabled || interval === 0 ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.autoRefreshOff')}
                aria-checked={!enabled || interval === 0}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('refresh.autoRefreshOff')}
                </span>
              </button>
              <button
                onClick={() => handleRefreshAutoRefreshChange(AUTO_REFRESH_INTERVALS.MIN_30)}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  enabled && interval === AUTO_REFRESH_INTERVALS.MIN_30 ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.autoRefresh30Min')}
                aria-checked={enabled && interval === AUTO_REFRESH_INTERVALS.MIN_30}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('refresh.autoRefresh30Min')}
                </span>
              </button>
              <button
                onClick={() => handleRefreshAutoRefreshChange(AUTO_REFRESH_INTERVALS.MIN_60)}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  enabled && interval === AUTO_REFRESH_INTERVALS.MIN_60 ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.autoRefresh60Min')}
                aria-checked={enabled && interval === AUTO_REFRESH_INTERVALS.MIN_60}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('refresh.autoRefresh60Min')}
                </span>
              </button>
            </div>
          )}
        </div>
        {/* Language Selector */}
        <div className="relative" ref={languageMenuRef}>
          <button
            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation"
            title={t('aria.selectLanguage') || 'Välj språk'}
            aria-label={t('aria.selectLanguage') || 'Välj språk'}
            aria-expanded={languageMenuOpen}
          >
            {getLanguageIcon()}
          </button>

          {/* Dropdown Menu */}
          {languageMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-scale-in"
              role="menu"
              aria-label={t('aria.languageMenu')}
            >
              <button
                onClick={() => handleLanguageChange('en')}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  i18n.language === 'en' ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.englishLanguage')}
                aria-checked={i18n.language === 'en'}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Engelska</span>
              </button>
              <button
                onClick={() => handleLanguageChange('sv')}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  i18n.language === 'sv' ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.swedishLanguage')}
                aria-checked={i18n.language === 'sv'}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Svenska</span>
              </button>
            </div>
          )}
        </div>
        {/* Theme Selector */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation"
            title={t('aria.selectTheme') || 'Välj tema'}
            aria-label={t('aria.selectTheme') || 'Välj tema'}
            aria-expanded={themeMenuOpen}
          >
            {getThemeIcon()}
          </button>

          {/* Dropdown Menu */}
          {themeMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-scale-in"
              role="menu"
              aria-label={t('aria.themeMenu')}
            >
              <button
                onClick={() => handleThemeChange('light')}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  theme === 'light' ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.lightTheme')}
                aria-checked={theme === 'light'}
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Light Theme</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  theme === 'dark' ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.darkTheme')}
                aria-checked={theme === 'dark'}
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Dark Theme</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  theme === 'system' ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
                role="menuitem"
                aria-label={t('aria.systemTheme')}
                aria-checked={theme === 'system'}
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Device Default</span>
              </button>
            </div>
          )}
        </div>
        {currentUser && (
          <button
            onClick={handleLogout}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation"
            title={t('auth.logout')}
            aria-label={t('aria.logoutButton')}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        )}
        {currentUser && (
          <button
            onClick={() => setNotificationCenterOpen(true)}
            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation"
            title={t('notifications.title', 'Notifications')}
            aria-label={t('notifications.title', 'Notifications')}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 dark:bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
        {currentUser && onOpenUserProfile && (
          <button
            onClick={onOpenUserProfile}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] touch-manipulation"
            title={t('profile.title')}
            aria-label={t('aria.userProfileButton')}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
        )}
      </div>
      {currentUser && (
        <NotificationCenter
          isOpen={notificationCenterOpen}
          onClose={() => setNotificationCenterOpen(false)}
        />
      )}
    </div>
  );
}
