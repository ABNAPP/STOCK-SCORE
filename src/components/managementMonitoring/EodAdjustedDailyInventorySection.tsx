import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useEodAdjustedDailyInventory } from '../../hooks/useEodAdjustedDailyInventory';
import MonitoringTable from './MonitoringTable';
import Button from '../ui/Button';

const COLUMNS = [
  { key: 'no', label: 'NO.' },
  { key: 'eodSymbol', label: 'EOD symbol' },
  { key: 'source', label: 'Source' },
  { key: 'docGeneration', label: 'Generation' },
  { key: 'matchesGlobal', label: 'Matches global' },
  { key: 'rangeFrom', label: 'Range from' },
  { key: 'rangeTo', label: 'Range to' },
  { key: 'barCount', label: 'Bars' },
  { key: 'lastBarDate', label: 'Last bar date' },
  { key: 'schemaVersion', label: 'Schema' },
  { key: 'fetchedAt', label: 'Fetched at' },
] as const;

const FAILED_COLUMNS = [
  { key: 'no', label: 'NO.' },
  { key: 'eodSymbol', label: 'EOD symbol' },
  { key: 'reason', label: 'Failure reason' },
] as const;

type EodAdjustedDailyInventorySectionProps = {
  user: User | null;
};

export default function EodAdjustedDailyInventorySection({ user }: EodAdjustedDailyInventorySectionProps) {
  const {
    rows,
    failedRows,
    loading,
    error,
    globalGeneration,
    docCount,
    failedCount,
    targetSessionDate,
    refresh,
  } = useEodAdjustedDailyInventory(user);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mt-8 md:mt-10" aria-label="Daily history data">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily history data</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
            Adjusted EOD prices from value-insight-be (
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">GET /eod-adjusted-daily</code>
            , metadata only).
            {user && !loading && (
              <span className="block mt-1">
                {targetSessionDate && (
                  <>
                    Session date: <strong>{targetSessionDate}</strong>
                    {' · '}
                  </>
                )}
                {globalGeneration != null && (
                  <>
                    Generation: <strong>{globalGeneration}</strong>
                    {' · '}
                  </>
                )}
                {docCount} symbol(s)
                {failedCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-error-600 dark:text-error-400">
                      {failedCount} failed retrieval
                    </span>
                  </>
                )}
              </span>
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || !user}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      )}

      {!user ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to load cache inventory.</p>
      ) : loading && rows.length === 0 && failedRows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
          Loading EOD adjusted daily inventory…
        </div>
      ) : rows.length === 0 && failedRows.length === 0 && !error ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6">
          No symbols returned from the backend.
        </p>
      ) : (
        <div className="space-y-6">
          {rows.length > 0 && (
            <MonitoringTable title="EOD adjusted daily — symbols" columns={[...COLUMNS]} rows={rows} />
          )}
          {failedRows.length > 0 && (
            <MonitoringTable
              title="EOD adjusted daily — failed price retrieval"
              columns={[...FAILED_COLUMNS]}
              rows={failedRows}
            />
          )}
        </div>
      )}
    </section>
  );
}
