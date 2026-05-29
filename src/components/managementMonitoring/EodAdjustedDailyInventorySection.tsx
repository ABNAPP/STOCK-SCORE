import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useEodAdjustedDailyInventory } from '../../hooks/useEodAdjustedDailyInventory';
import MonitoringTable from './MonitoringTable';
import Button from '../ui/Button';

const COLUMNS = [
  { key: 'no', label: 'NO.' },
  { key: 'eodSymbol', label: 'EOD symbol' },
  { key: 'docGeneration', label: 'Doc generation' },
  { key: 'matchesGlobal', label: 'Matches global gen.' },
  { key: 'rangeFrom', label: 'Range from' },
  { key: 'rangeTo', label: 'Range to' },
  { key: 'barCount', label: 'Bars' },
  { key: 'lastBarDate', label: 'Last bar date' },
  { key: 'schemaVersion', label: 'Schema' },
  { key: 'fetchedAt', label: 'Fetched at' },
] as const;

type EodAdjustedDailyInventorySectionProps = {
  user: User | null;
};

export default function EodAdjustedDailyInventorySection({ user }: EodAdjustedDailyInventorySectionProps) {
  const { rows, loading, error, globalGeneration, docCount, refresh } = useEodAdjustedDailyInventory(user);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="mt-8 md:mt-10" aria-label="Daily history data">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily history data</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
            Documents in Firestore <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">eodAdjustedDaily</code>{' '}
            (EODHD adjusted daily cache). Global generation comes from{' '}
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">system/eodAdjustedCache</code>.
            {user && !loading && (
              <span className="block mt-1">
                {globalGeneration != null && (
                  <>
                    Current global generation: <strong>{globalGeneration}</strong>
                    {' · '}
                  </>
                )}
                {docCount} symbol doc(s) in collection
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
          {/permission|insufficient/i.test(error)
            ? ' — Ensure your account has the Management Monitoring, SCORE BOARD, ISM Posture, or legacy Score Board permission, and deploy the latest Firestore rules if you just updated them.'
            : ''}
        </p>
      )}

      {!user ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to load cache inventory.</p>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
          Loading eodAdjustedDaily…
        </div>
      ) : rows.length === 0 && !error ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6">
          No documents found in <code className="text-xs">eodAdjustedDaily</code>.
        </p>
      ) : (
        <MonitoringTable title="eodAdjustedDaily — symbol documents" columns={[...COLUMNS]} rows={rows} />
      )}
    </section>
  );
}
