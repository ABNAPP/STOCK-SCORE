import React, { useMemo } from 'react';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import ProgressIndicator from './ProgressIndicator';
import { useTranslation } from 'react-i18next';

interface EnhancedLoadingStateProps {
  dataSourceNames?: Record<string, string>; // Map of source keys to display names
}

export default function EnhancedLoadingState({ dataSourceNames }: EnhancedLoadingStateProps) {
  const { t } = useTranslation();
  const { dataSources, totalProgress, estimatedTimeRemaining, isAnyLoading } = useLoadingProgress();

  const defaultNames: Record<string, string> = {
    'score-board': 'Score Board',
    'benjamin-graham': 'Benjamin Graham',
    'sma': 'SMA',
    'pe-industry': 'P/E Industry',
    'threshold-industry': 'Threshold Industry',
    ...dataSourceNames,
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return '< 1s';
    }
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `~${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `~${minutes}m ${remainingSeconds}s` : `~${minutes}m`;
  };

  const dataSourceList = useMemo(() => {
    return Array.from(dataSources.values()).sort((a, b) => {
      // Sort by status: loading first, then pending, then complete, then error
      const statusOrder = { loading: 0, pending: 1, complete: 2, error: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [dataSources]);

  if (!isAnyLoading && dataSourceList.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('loading.loadingData', 'Laddar data...')}
          </h3>
          {estimatedTimeRemaining > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {t('loading.estimatedTime', 'Uppskattad tid')}: {formatTime(estimatedTimeRemaining)}
            </span>
          )}
        </div>
        <ProgressIndicator
          progress={totalProgress}
          isLoading={isAnyLoading}
          showPercentage={true}
          estimatedTimeRemaining={estimatedTimeRemaining}
        />
      </div>

      {dataSourceList.length > 0 && (
        <div className="space-y-2">
          {dataSourceList.map((source) => {
            const displayName = defaultNames[source.name] || source.name;
            const isComplete = source.status === 'complete';
            const isError = source.status === 'error';
            const isLoading = source.status === 'loading' || source.status === 'pending';

            return (
              <div key={source.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {isComplete ? (
                    <svg
                      className="w-4 h-4 text-green-700 dark:text-green-200 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isError ? (
                    <svg
                      className="w-4 h-4 text-red-700 dark:text-red-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 flex-shrink-0">
                      <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <span
                    className={`font-medium truncate ${
                      isComplete
                        ? 'text-green-700 dark:text-green-400'
                        : isError
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {displayName}
                  </span>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  {source.rowsLoaded !== undefined && source.totalRows !== undefined && (
                    <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {source.rowsLoaded}/{source.totalRows} rader
                    </span>
                  )}
                  {isLoading && (
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, source.progress))}%` }}
                      />
                    </div>
                  )}
                  {isLoading && (
                    <span className="text-xs text-gray-700 dark:text-gray-300 w-10 text-right">
                      {Math.round(source.progress)}%
                    </span>
                  )}
                  {isComplete && (
                    <span className="text-xs text-green-700 dark:text-green-200">
                      {t('loading.complete', 'Klar')}
                    </span>
                  )}
                  {isError && (
                    <span className="text-xs text-red-700 dark:text-red-400">
                      {t('loading.error', 'Fel')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

