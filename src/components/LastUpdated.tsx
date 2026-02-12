import { useTranslation } from 'react-i18next';

interface LastUpdatedProps {
  lastUpdated: Date | null;
  onRefresh: () => void;
  loading: boolean;
  isOffline?: boolean;
  isReadOnly?: boolean;
}

export default function LastUpdated({ lastUpdated, onRefresh, loading, isOffline, isReadOnly }: LastUpdatedProps) {
  const { t, i18n } = useTranslation();
  const showReadOnlyBadge = isOffline && isReadOnly;

  const formatDate = (date: Date) => {
    const locale = i18n.language === 'sv' ? 'sv-SE' : 'en-US';
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString(locale, options);
  };

  return (
    <div className="mb-6 text-sm font-medium text-gray-600 dark:text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {t('lastUpdated.lastUpdated')}:{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {lastUpdated ? formatDate(lastUpdated) : t('lastUpdated.never')}
          </span>
        </span>
        {showReadOnlyBadge && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
            role="status"
          >
            {t('offline.readOnly')}
          </span>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading || showReadOnlyBadge}
        className="ml-2 py-2 px-2 -mx-2 text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold underline disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px] touch-manipulation inline-flex items-center gap-1.5"
        aria-label={t('aria.refreshButton')}
      >
        <svg
          className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
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
        <span>{loading ? t('lastUpdated.updating') : t('lastUpdated.auto')}</span>
      </button>
    </div>
  );
}
