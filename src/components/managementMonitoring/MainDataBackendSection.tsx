import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import Button from '../ui/Button';
import { refreshMainData } from '../../services/valueInsightClient';
import type { MainDataApiResponse } from '../../types/mainDataApi';

type MainDataBackendSectionProps = {
  user: User | null;
  isAdmin: boolean;
};

function formatTimestamp(ms: number): string {
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
}

export default function MainDataBackendSection({ user, isAdmin }: MainDataBackendSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MainDataApiResponse | null>(null);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await refreshMainData(user);
      setLastResult(result);
    } catch (err) {
      setLastResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  if (!isAdmin) {
    return null;
  }

  return (
    <section className="mt-8 md:mt-10" aria-label="Backend main data">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Backend main data</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
            Force-refresh the dashboard snapshot via value-insight-be (
            <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">POST /main-data/refresh</code>
            ). Requires admin role.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={loading || !user}
          isLoading={loading}
        >
          Refresh main data
        </Button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      )}

      {!user ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sign in as admin to refresh backend cache.</p>
      ) : lastResult ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p>
            <span className="font-medium text-gray-900 dark:text-white">Rows:</span> {lastResult.rowCount}
            {' · '}
            <span className="font-medium text-gray-900 dark:text-white">Source:</span> {lastResult.source}
            {' · '}
            <span className="font-medium text-gray-900 dark:text-white">Refreshed:</span>{' '}
            {lastResult.refreshed ? 'yes' : 'no'}
          </p>
          <p>
            <span className="font-medium text-gray-900 dark:text-white">Cached at:</span>{' '}
            {formatTimestamp(lastResult.timestamp)}
            {' · '}
            <span className="font-medium text-gray-900 dark:text-white">TTL:</span>{' '}
            {Math.round(lastResult.ttl / 60000)} min
            {lastResult.version != null && (
              <>
                {' · '}
                <span className="font-medium text-gray-900 dark:text-white">Version:</span> {lastResult.version}
              </>
            )}
          </p>
        </div>
      ) : null}
    </section>
  );
}
