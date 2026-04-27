import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCachedSheetSnapshot,
  type SheetSnapshotData,
  type SupportedSheetName,
} from '../services/sheets/sheetSnapshotService';

function formatSnapshotCell(
  value: unknown,
  sheetName: SupportedSheetName,
  headerName: string
): string {
  if (value === null || value === undefined || value === '') return '—';

  if (
    sheetName === 'DashBoard' &&
    headerName.trim().toLowerCase() === 'date of update'
  ) {
    const dateValue = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleDateString();
    }
    return String(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isErrorCell =
      trimmed === '#REF!' ||
      trimmed === '#DIV/0!' ||
      trimmed === '#NUM!' ||
      trimmed === 'Loading...';
    if (isErrorCell) {
      return value;
    }

    if (trimmed !== '') {
      const numericValue = Number(trimmed);
      if (Number.isFinite(numericValue)) {
        return numericValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    }
  }

  return String(value);
}

const INITIAL_VISIBLE_ROWS = 100;

function formatGeneratedAt(value: string | null): string {
  if (!value) return '—';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const hours = String(parsedDate.getHours()).padStart(2, '0');
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default function CentralDataServicePage() {
  const [activeTab, setActiveTab] = useState<SupportedSheetName>('DashBoard');
  const [snapshotData, setSnapshotData] = useState<Record<SupportedSheetName, SheetSnapshotData | null>>({
    DashBoard: null,
    SMA: null,
  });
  const [loading, setLoading] = useState(false);
  const [visibleRows, setVisibleRows] = useState<Record<SupportedSheetName, number>>({
    DashBoard: INITIAL_VISIBLE_ROWS,
    SMA: INITIAL_VISIBLE_ROWS,
  });

  useEffect(() => {
    let isMounted = true;

    const loadCachedSnapshots = async () => {
      setLoading(true);
      try {
        const [dashboardCached, smaCached] = await Promise.all([
          getCachedSheetSnapshot('DashBoard'),
          getCachedSheetSnapshot('SMA'),
        ]);
        if (!isMounted) return;
        setSnapshotData({
          DashBoard: dashboardCached,
          SMA: smaCached,
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadCachedSnapshots();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeSnapshot = snapshotData[activeTab];
  const activeHeaders = activeSnapshot?.headers ?? [];
  const activeRows = useMemo(() => {
    const rows = activeSnapshot?.rows ?? [];
    const companyHeader = activeHeaders.find(
      (header) => header.trim().toLowerCase() === 'company name'
    );

    if (!companyHeader) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aName = String(a[companyHeader] ?? '').trim();
      const bName = String(b[companyHeader] ?? '').trim();
      const aEmpty = aName === '';
      const bEmpty = bName === '';

      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });
  }, [activeHeaders, activeSnapshot]);
  const currentVisibleRows = visibleRows[activeTab] ?? INITIAL_VISIBLE_ROWS;
  const displayedRows = useMemo(
    () => activeRows.slice(0, currentVisibleRows),
    [activeRows, currentVisibleRows]
  );
  const canLoadMore = activeRows.length > currentVisibleRows;

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            to="/management-monitoring"
            className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Management Monitoring
          </Link>
        </div>

        <section className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Central Data Service</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Read-only mirror of the cached Google Sheets snapshot used by the app.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3">
            {(['DashBoard', 'SMA'] as SupportedSheetName[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  activeTab === tab
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading cached snapshot...</div>
          ) : !activeSnapshot ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No cached snapshot</div>
          ) : activeHeaders.length === 0 || activeRows.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Cached snapshot is empty</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 text-sm">
                <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Row count</div>
                  <div className="font-medium text-gray-900 dark:text-white">{activeRows.length}</div>
                </div>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Column count</div>
                  <div className="font-medium text-gray-900 dark:text-white">{activeHeaders.length}</div>
                </div>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Generated at</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatGeneratedAt(activeSnapshot.generatedAt)}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>
                  <div className="font-medium text-gray-900 dark:text-white">{activeSnapshot.version ?? '—'}</div>
                </div>
              </div>

              <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Showing {Math.min(currentVisibleRows, activeRows.length)} of {activeRows.length}
              </div>

              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/30">
                    <tr>
                      {activeHeaders.map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap border-b border-gray-200 dark:border-gray-700"
                        >
                          {header || '—'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row, idx) => (
                      <tr
                        key={`${activeTab}-row-${idx}`}
                        className="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60"
                      >
                        {activeHeaders.map((header) => (
                          <td
                            key={`${activeTab}-${idx}-${header}`}
                            className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap border-b border-gray-100 dark:border-gray-700"
                          >
                            {formatSnapshotCell(row[header], activeTab, header)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canLoadMore && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleRows((prev) => ({
                        ...prev,
                        [activeTab]: prev[activeTab] + 100,
                      }))
                    }
                    className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
