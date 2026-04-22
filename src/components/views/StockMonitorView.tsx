import { useTranslation } from 'react-i18next';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import type { ScoreBoardData } from '../../types/stock';

function rowKey(row: ScoreBoardData): string {
  return `${row.ticker}\u0000${row.companyName}`;
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Simple overview table: same Dashboard-backed stream as Stock Analyses (useScoreBoardData). No new fetch path.
 */
export default function StockMonitorView() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useScoreBoardData();
  const count = data.length;

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-2 tracking-tight">
        {t('navigation.stockMonitor')}
      </h1>

      {loading && (
        <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          {t('common.loading', 'Laddar...')}
        </p>
      )}

      {!loading && error && (
        <div
          className="rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 p-4 shadow-sm"
          role="alert"
        >
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">{t('aria.error', 'Error')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => void refetch(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px]"
          >
            {t('offline.tryAgain', 'Try again')}
          </button>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('stockMonitorView.noRows')}</p>
      )}

      {!loading && !error && data.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3" aria-live="polite">
            {t('stockMonitorView.totalRows', { count })}
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm max-w-5xl">
            <table
              className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm"
              aria-label={t('stockMonitorView.tableAriaLabel')}
            >
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-14"
                  >
                    {t('stockMonitorView.columnIndex')}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  >
                    {t('stockMonitorView.columnCompany')}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  >
                    {t('stockMonitorView.columnTicker')}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {t('stockMonitorView.columnPrice')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((row, index) => (
                  <tr key={rowKey(row)} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 tabular-nums w-14">{index + 1}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-white">{row.companyName}</td>
                    <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200 font-mono">{row.ticker}</td>
                    <td className="px-3 py-2.5 text-right text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap">
                      {formatPrice(row.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
