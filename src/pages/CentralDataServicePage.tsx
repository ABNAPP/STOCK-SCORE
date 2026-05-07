import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCachedSheetSnapshot,
  type SheetSnapshotData,
  type SupportedSheetName,
} from '../services/sheets/sheetSnapshotService';
import TableSearchBar from '../components/TableSearchBar';
import { useDebounce } from '../hooks/useDebounce';
import { sanitizeSearchQuery } from '../utils/inputValidator';

const LOGO_HEADER_NAMES = new Set(['company logo', 'company logo url', 'logo']);

function isLogoColumnHeader(headerName: string): boolean {
  return LOGO_HEADER_NAMES.has(headerName.trim().toLowerCase());
}

/**
 * Logo column: derive safe `src` for `<img>`.
 * Accepts http(s)-prefixed strings (covers Google favicon URLs with nested query chars).
 * If `URL` parsing fails on edge cases, still returns trimmed string starting with http(s).
 * Never stringifies arbitrary objects (`[object Object]`).
 */
function extractLogoImgSrc(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null;

  let raw = typeof value === 'string' ? value.trim() : String(value).trim();
  raw = raw.replace(/^\ufeff/, '');
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  if (raw === '') return null;

  const lc = raw.toLowerCase();
  const hasHttpScheme = lc.startsWith('https://') || lc.startsWith('http://');
  if (!hasHttpScheme) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.href;
      }
    } catch {
      /* noop */
    }
    return null;
  }

  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.href;
    }
  } catch {
    /* Fallback: Sheets / favicon URLs can fail strict parsing — still attempt as image src */
  }
  return raw;
}

function SnapshotLogoCell({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed) {
    return <span className="text-gray-400 dark:text-gray-500">—</span>;
  }

  return (
    <img
      src={url}
      alt="Company logo"
      className="mx-auto h-8 w-8 object-contain"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function formatDateUtcYyyyMmDd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse sheet value to UTC calendar yyyy-mm-dd; null if unparseable. */
function tryFormatDateOfValuation(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDateUtcYyyyMmDd(value);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : formatDateUtcYyyyMmDd(d);
  }
  return null;
}

function formatSnapshotCell(
  value: unknown,
  sheetName: SupportedSheetName,
  headerName: string
): string {
  if (value === null || value === undefined || value === '') return '—';

  const headerNorm = headerName.trim().toLowerCase();

  if (
    sheetName === 'DashBoard' &&
    headerNorm === 'date of update'
  ) {
    const dateValue = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleDateString();
    }
    return String(value);
  }

  if (headerNorm === 'date of valuation') {
    return tryFormatDateOfValuation(value) ?? '—';
  }

  if (isLogoColumnHeader(headerName)) {
    const u = extractLogoImgSrc(value);
    return u ?? '—';
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

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime()) ? value.toLocaleDateString() : '—';
  }

  if (typeof value === 'object' && value !== null) {
    return '—';
  }

  return String(value);
}

const INITIAL_VISIBLE_ROWS = 100;

/** Sheet error / placeholder company names — sorted A–Z among themselves but always after normal names. */
const BAD_COMPANY_NAME_EXACT = new Set([
  '#N/A',
  '#REF!',
  '#NUM!',
  '#DIV/0!',
  'Loading...',
  '—',
]);

function isBadCompanyNameForSort(raw: string): boolean {
  const t = raw.trim();
  if (t === '') return true;
  return BAD_COMPANY_NAME_EXACT.has(t);
}

function isAntalHeader(header: string): boolean {
  return header.trim().toLowerCase() === 'antal';
}

/** Presentation columns: optional leading NO., plus sheet headers (ANTAL → NO. + row index in view). */
type PresentationCol =
  | { kind: 'presentation-no' }
  | { kind: 'data'; header: string; label: string; useViewRowNumber: boolean };

const ROW_NUMBER_HEADER = 'NO.';

function buildPresentationColumns(headers: string[]): PresentationCol[] {
  const hasAntal = headers.some(isAntalHeader);
  const cols: PresentationCol[] = [];
  if (!hasAntal) {
    cols.push({ kind: 'presentation-no' });
  }
  for (const h of headers) {
    const antal = isAntalHeader(h);
    cols.push({
      kind: 'data',
      header: h,
      label: antal ? ROW_NUMBER_HEADER : h || '—',
      useViewRowNumber: antal,
    });
  }
  return cols;
}

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
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearch = useDebounce(searchValue, 300);

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

  useEffect(() => {
    setSearchValue('');
    setVisibleRows((prev) => ({
      ...prev,
      [activeTab]: INITIAL_VISIBLE_ROWS,
    }));
  }, [activeTab]);

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
      const aBad = isBadCompanyNameForSort(aName);
      const bBad = isBadCompanyNameForSort(bName);
      if (aBad !== bBad) {
        return aBad ? 1 : -1;
      }
      return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });
  }, [activeHeaders, activeSnapshot]);

  const searchedRows = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return activeRows;
    }
    const sanitizedQuery = sanitizeSearchQuery(debouncedSearch);
    const searchLower = sanitizedQuery.toLowerCase().trim();
    if (!searchLower) {
      return activeRows;
    }

    return activeRows.filter((row) =>
      activeHeaders.some((header) => {
        const raw = row[header];
        const rawStr =
          raw !== null && raw !== undefined && typeof raw !== 'object'
            ? String(raw).toLowerCase()
            : '';
        const formatted = formatSnapshotCell(raw, activeTab, header).toLowerCase();
        return rawStr.includes(searchLower) || formatted.includes(searchLower);
      })
    );
  }, [activeRows, activeHeaders, debouncedSearch, activeTab]);

  const currentVisibleRows = visibleRows[activeTab] ?? INITIAL_VISIBLE_ROWS;
  const displayedRows = useMemo(
    () => searchedRows.slice(0, currentVisibleRows),
    [searchedRows, currentVisibleRows]
  );
  const canLoadMore = searchedRows.length > currentVisibleRows;

  const presentationColumns = useMemo(
    () => buildPresentationColumns(activeHeaders),
    [activeHeaders]
  );

  return (
    <div className="h-full min-h-0 bg-gray-100 dark:bg-gray-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 flex flex-col">
      <div className="w-full flex-1 min-h-0 flex flex-col mx-auto">
        <div className="mb-4 flex-shrink-0">
          <Link
            to="/management-monitoring"
            className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Management Monitoring
          </Link>
        </div>

        <section className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="mb-4 flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Central Data Service</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Read-only mirror of the cached Google Sheets snapshot used by the app.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-3 flex-shrink-0 w-full">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="w-full sm:w-auto sm:min-w-[220px] sm:max-w-md flex-shrink-0 sm:ml-auto">
              <TableSearchBar
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                totalRows={activeSnapshot ? activeRows.length : 0}
                filteredRows={activeSnapshot ? searchedRows.length : 0}
                placeholder="Sök efter företag eller ticker..."
                showResultCount={false}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading cached snapshot...</div>
          ) : !activeSnapshot ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No cached snapshot</div>
          ) : activeHeaders.length === 0 || activeRows.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Cached snapshot is empty</div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm flex-shrink-0">
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

              <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                Showing {Math.min(currentVisibleRows, searchedRows.length)} of {searchedRows.length}
                {searchedRows.length !== activeRows.length ? ` (filtered from ${activeRows.length})` : ''}
              </div>

              <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col min-h-[12rem]">
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="min-w-max w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/30 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {presentationColumns.map((col) => (
                          <th
                            key={
                              col.kind === 'presentation-no'
                                ? '__presentation_no__'
                                : col.header
                            }
                            className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap border-b border-gray-200 dark:border-gray-700"
                          >
                            {col.kind === 'presentation-no' ? ROW_NUMBER_HEADER : col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.map((row, idx) => {
                        const viewNumber = idx + 1;

                        return (
                          <tr
                            key={`${activeTab}-row-${idx}`}
                            className="odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60"
                          >
                            {presentationColumns.map((col) => {
                              if (col.kind === 'presentation-no') {
                                return (
                                  <td
                                    key="__presentation_no__"
                                    className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap border-b border-gray-100 dark:border-gray-700 tabular-nums"
                                  >
                                    {viewNumber}
                                  </td>
                                );
                              }
                              if (col.useViewRowNumber) {
                                return (
                                  <td
                                    key={col.header}
                                    className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap border-b border-gray-100 dark:border-gray-700 tabular-nums"
                                  >
                                    {viewNumber}
                                  </td>
                                );
                              }
                              const cellValue = row[col.header];
                              if (isLogoColumnHeader(col.header)) {
                                const logoUrl = extractLogoImgSrc(cellValue);
                                return (
                                  <td
                                    key={col.header}
                                    className="px-3 py-2 text-center align-middle border-b border-gray-100 dark:border-gray-700 min-w-[3rem]"
                                  >
                                    {logoUrl ? (
                                      <SnapshotLogoCell url={logoUrl} />
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500">—</span>
                                    )}
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={col.header}
                                  className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap border-b border-gray-100 dark:border-gray-700"
                                >
                                  {formatSnapshotCell(cellValue, activeTab, col.header)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {canLoadMore && (
                <div className="mt-1 flex-shrink-0">
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
