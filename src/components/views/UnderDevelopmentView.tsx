import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import type { ScoreBoardData } from '../../types/stock';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { isTheoEntryGreen } from '../../utils/colorThresholds';
import { CalendarDaysIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import TableSearchBar from '../TableSearchBar';
import EodAdjustedDailyPriceChartPanel from '../EodAdjustedDailyPriceChartPanel';

/**
 * Under-development route: same card grid as Stock Analyses; detail panel evolves independently.
 * Wrapped in `EntryExitProvider` (same pattern as ISM Posture) so currency reads via existing Entry/Exit Firestore path.
 */
function rowKey(row: ScoreBoardData): string {
  return `${row.ticker}\u0000${row.companyName}`;
}

function formatDashBoardPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** DashBoard date string → display as `yyyy-mm-dd` only (no time / T / Z). */
function isValidCalendarYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatDateOfValuationYmd(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return '—';
  const s = raw.trim();
  if (!s) return '—';

  const ymdLead = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (ymdLead) {
    const y = Number(ymdLead[1]);
    const m = Number(ymdLead[2]);
    const d = Number(ymdLead[3]);
    if (isValidCalendarYmd(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '—';
  }

  const dmyDot = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (dmyDot) {
    const d = Number(dmyDot[1]);
    const m = Number(dmyDot[2]);
    const y = Number(dmyDot[3]);
    if (isValidCalendarYmd(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmySlash) {
    const d = Number(dmySlash[1]);
    const m = Number(dmySlash[2]);
    const y = Number(dmySlash[3]);
    if (isValidCalendarYmd(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const parsedMs = Date.parse(s);
  if (!Number.isNaN(parsedMs)) {
    const dt = new Date(parsedMs);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    if (y >= 1900 && y <= 2100) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '—';
}

/**
 * True if `yyyy-mm-dd` is strictly more than 30 whole local calendar days before today.
 * Future dates → false. Invalid / not exact ymd → false.
 */
function isValuationDateOlderThanAboutOneMonth(displayYmd: string): boolean {
  if (!displayYmd || displayYmd === '—') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(displayYmd.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidCalendarYmd(y, mo, d)) return false;
  const valStart = new Date(y, mo - 1, d);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayStart.getTime() - valStart.getTime();
  if (diffMs <= 0) return false;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays > 30;
}

function dashText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const t = value.trim();
  return t.length > 0 ? t : '—';
}

function formatValuationScoreOutOfFour(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return '—';
  }
  return `${score.toFixed(1)} / 4`;
}

function formatFiveYearBeta(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function scoreBoardRowMatchesListSearch(row: ScoreBoardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (row.companyName ?? '').toLowerCase();
  const tick = (row.ticker ?? '').toLowerCase();
  const industry = (row.industry ?? '').toLowerCase();
  const beta = formatFiveYearBeta(row.fiveYearBeta).toLowerCase();
  return (
    name.includes(q) ||
    tick.includes(q) ||
    industry.includes(q) ||
    beta.includes(q)
  );
}

function finalStatusBadgeClass(status: string | null | undefined): string {
  const base =
    'inline-flex min-h-[1.75rem] max-w-full items-center justify-center rounded-md px-2.5 py-1 text-center text-xs font-bold uppercase tracking-wide text-white shadow-sm';
  if (!status || !status.trim()) {
    return `${base} bg-gray-400 dark:bg-gray-600`;
  }
  const u = status.trim().toUpperCase().replace(/\s+/g, ' ');
  if (u === 'STRONG BUY') return `${base} bg-emerald-600 dark:bg-emerald-700`;
  if (u === 'BUY') return `${base} bg-green-600 dark:bg-green-700`;
  if (u === 'WATCH') return `${base} bg-orange-500 dark:bg-orange-600`;
  if (u === 'AVOID') return `${base} bg-red-600 dark:bg-red-700`;
  return `${base} bg-gray-500 dark:bg-gray-600`;
}

function riskFlagBadgeClass(flag: string | null | undefined): string {
  const base =
    'inline-flex min-h-[1.75rem] max-w-full items-center justify-center rounded-md border px-2.5 py-1 text-center text-xs font-semibold shadow-sm';
  const neutral = `${base} border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200`;
  if (!flag || !flag.trim()) {
    return neutral;
  }
  const key = flag.trim().toUpperCase();
  if (key === 'LOW') {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100`;
  }
  if (key === 'MEDIUM') {
    return `${base} border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-100`;
  }
  if (key === 'HIGH') {
    return `${base} border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100`;
  }
  return neutral;
}

/** Forecast Confidence: text color only (no badge); STRONG / MODERATE / WEAK after trim, case-insensitive. */
function forecastConfidenceTextClass(raw: string | null | undefined): string {
  const base = 'text-sm font-medium [overflow-wrap:anywhere] ';
  const neutral = 'text-gray-800 dark:text-gray-200';
  if (!raw || !raw.trim()) {
    return base + neutral;
  }
  const key = raw.trim().toUpperCase();
  if (key === 'STRONG') {
    return base + 'text-emerald-700 dark:text-emerald-300';
  }
  if (key === 'MODERATE') {
    return base + 'text-orange-700 dark:text-orange-300';
  }
  if (key === 'WEAK') {
    return base + 'text-red-700 dark:text-red-300';
  }
  return base + neutral;
}

/** Sanity Summary: text color only (no badge); PASS / WATCH / FAIL after trim, case-insensitive — same color pattern as Forecast Confidence. */
function sanitySummaryTextClass(raw: string | null | undefined): string {
  const base = 'text-sm font-medium leading-relaxed [overflow-wrap:anywhere] ';
  const neutral = 'text-gray-800 dark:text-gray-200';
  if (!raw || !raw.trim()) {
    return base + neutral;
  }
  const key = raw.trim().toUpperCase();
  if (key === 'PASS') {
    return base + 'text-emerald-700 dark:text-emerald-300';
  }
  if (key === 'WATCH') {
    return base + 'text-orange-700 dark:text-orange-300';
  }
  if (key === 'FAIL') {
    return base + 'text-red-700 dark:text-red-300';
  }
  return base + neutral;
}

function DecisionDiagnosticsPanel({ row, t }: { row: ScoreBoardData; t: TFunction }) {
  const finalStatus = row.finalStatus ?? null;
  const riskFlag = row.riskFlag ?? null;
  const valuationScore = row.valuationScore ?? null;
  const forecast = row.forecastConfidenceVerdict ?? null;
  const sanity = row.sanitySummary ?? null;
  const note = row.statusNote ?? null;

  return (
    <div
      className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-600"
      role="region"
      aria-label={t('underDevelopmentView.decisionDiagnostics')}
    >
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {t('underDevelopmentView.decisionDiagnostics')}
      </h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('underDevelopmentView.finalStatus')}
          </span>
          <span className={finalStatusBadgeClass(finalStatus)}>
            <span className="line-clamp-2 break-words">{dashText(finalStatus)}</span>
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('underDevelopmentView.riskFlag')}
          </span>
          <span className={riskFlagBadgeClass(riskFlag)}>
            <span className="line-clamp-2 break-words">{dashText(riskFlag)}</span>
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('underDevelopmentView.valuationScore')}
          </span>
          <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {formatValuationScoreOutOfFour(valuationScore)}
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('underDevelopmentView.forecastConfidence')}
          </span>
          <span className={forecastConfidenceTextClass(forecast)}>{dashText(forecast)}</span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('underDevelopmentView.sanitySummary')}
          </span>
          <span className={sanitySummaryTextClass(sanity)}>{dashText(sanity)}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/30 sm:flex-row sm:items-start sm:gap-4">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:w-28 sm:pt-0.5">
          {t('underDevelopmentView.statusNote')}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-900 dark:text-gray-100 [overflow-wrap:anywhere]">
          {dashText(note)}
        </p>
      </div>
    </div>
  );
}

/** DashBoard `Date of Valuation` → `ScoreBoardData.dateOfValuation`; label in UI: Date of Valuation. */
function DateOfValuationSummaryPanel({ row, t }: { row: ScoreBoardData; t: TFunction }) {
  const { display, iconClassName } = useMemo(() => {
    const display = formatDateOfValuationYmd(row.dateOfValuation);
    if (display === '—') {
      return {
        display,
        iconClassName: 'text-red-600 dark:text-red-400',
      };
    }
    if (isValuationDateOlderThanAboutOneMonth(display)) {
      return {
        display,
        iconClassName: 'text-red-600 dark:text-red-400',
      };
    }
    return {
      display,
      iconClassName: 'text-blue-600 dark:text-blue-500',
    };
  }, [row.dateOfValuation]);

  return (
    <div
      className="flex w-full max-w-full flex-col rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-900/40 sm:w-auto sm:min-w-[11rem] sm:max-w-[16rem] sm:px-4 sm:py-3"
      role="group"
      aria-label={`${t('underDevelopmentView.dateOfValuation')}, ${display}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('underDevelopmentView.dateOfValuation')}
      </div>
      <div className="mt-2 flex min-w-0 flex-row items-center justify-between gap-3">
        <div className={`flex shrink-0 items-center ${iconClassName}`} aria-hidden>
          <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1 text-right text-lg font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
          {display}
        </div>
      </div>
    </div>
  );
}

/**
 * Same inputs and predicate as Score Board `theoEntry` column (`ScoreBoardTable`):
 * `getEntryExitValue(ticker, companyName)` + Benjamin Graham sheet price row match + `isTheoEntryGreen`.
 * When true, Score Board shows green "B"; here we show green "BUY".
 */
function TechnicalRecommendationPanel({ row, t }: { row: ScoreBoardData; t: TFunction }) {
  const { getEntryExitValue } = useEntryExitValues();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();

  const isBuy = useMemo(() => {
    const entryExitValues = getEntryExitValue(row.ticker, row.companyName);
    const match = benjaminGrahamData.find(
      (item) =>
        item.ticker?.toLowerCase() === row.ticker.toLowerCase() ||
        item.companyName?.toLowerCase() === row.companyName.toLowerCase()
    );
    const price = match?.price ?? null;
    return isTheoEntryGreen(entryExitValues, price);
  }, [getEntryExitValue, benjaminGrahamData, row.ticker, row.companyName]);

  return (
    <section
      className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-600"
      role="region"
      aria-label={t('underDevelopmentView.technicalRecommendation')}
    >
      <div className="w-fit max-w-full rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-900/40 sm:min-w-[12rem] sm:max-w-[18rem] sm:shrink-0 sm:px-4 sm:py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('underDevelopmentView.technicalRecommendation')}
        </div>
        <div className="mt-2 flex min-w-0 flex-row items-center justify-between gap-3">
          <div
            className={`flex shrink-0 items-center ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}
            aria-hidden
          >
            <ViewfinderCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            {isBuy ? (
              <span className="text-lg font-semibold tabular-nums tracking-wide text-green-700 dark:text-green-300">
                {t('underDevelopmentView.technicalRecommendationBuy')}
              </span>
            ) : (
              <span className="text-lg font-semibold tabular-nums text-gray-600 dark:text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function UnderDevelopmentViewInner() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useScoreBoardData();
  const { getFieldValue } = useEntryExitValues();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');

  const selectedRow = useMemo(
    () => (selectedKey == null ? null : data.find((r) => rowKey(r) === selectedKey) ?? null),
    [data, selectedKey]
  );

  const filteredListRows = useMemo(
    () => data.filter((row) => scoreBoardRowMatchesListSearch(row, listSearch)),
    [data, listSearch]
  );

  const detailPrice = useMemo(() => {
    if (!selectedRow) return '—';
    return formatDashBoardPrice(selectedRow.price);
  }, [selectedRow]);

  const detailCurrency = useMemo(() => {
    if (!selectedRow) return '—';
    const raw = getFieldValue(selectedRow.ticker, selectedRow.companyName, 'currency');
    if (typeof raw === 'string' && raw.trim() !== '') {
      return raw.trim();
    }
    return '—';
  }, [selectedRow, getFieldValue]);

  useEffect(() => {
    if (selectedKey != null && selectedRow == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI when data drops the selected company
      setSelectedKey(null);
    }
  }, [selectedKey, selectedRow]);

  const handleOpenCard = useCallback((row: ScoreBoardData) => {
    setSelectedKey(rowKey(row));
  }, []);

  const handleBack = useCallback(() => {
    setSelectedKey(null);
  }, []);

  const count = data.length;
  const filteredCount = filteredListRows.length;
  const listSearchTrimmed = listSearch.trim();
  const isListView = selectedRow == null;

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-2 tracking-tight">
          {t('navigation.underDevelopment')}
        </h1>
        {!loading && !error && count > 0 && isListView && (
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="min-w-0 shrink text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
              {listSearchTrimmed.length > 0 && filteredCount !== count
                ? t('underDevelopmentView.totalStocksFiltered', { filtered: filteredCount, total: count })
                : t('stockAnalysesView.totalStocks', { count })}
            </p>
            <div className="w-full min-w-0 sm:w-auto sm:max-w-md sm:flex-shrink-0 sm:min-w-[200px]">
              <TableSearchBar
                searchValue={listSearch}
                onSearchChange={setListSearch}
                totalRows={count}
                filteredRows={filteredCount}
                placeholder={t('underDevelopmentView.cardSearchPlaceholder')}
                showResultCount={false}
              />
            </div>
          </div>
        )}
      </div>

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
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('stockAnalysesView.noRows')}</p>
      )}

      {!loading && !error && selectedRow != null && (
        <section
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm max-w-5xl w-full"
          aria-label={t('stockAnalysesView.detailTitle')}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleBack}
                className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] -ml-1 px-1"
              >
                {t('stockAnalysesView.backToList')}
              </button>
              <h2 className="text-xl font-semibold text-black dark:text-white leading-snug mb-1">
                {selectedRow.companyName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedRow.ticker}</p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-stretch sm:justify-end">
              <DateOfValuationSummaryPanel row={selectedRow} t={t} />
              <div
                className="shrink-0 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-900/40 px-4 py-3 sm:w-auto sm:min-w-[11rem] sm:text-right"
                aria-label={`${t('underDevelopmentView.currentPrice')}, ${detailCurrency}`}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('underDevelopmentView.currentPrice')}
                </div>
                <div className="mt-1 flex min-w-0 flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:justify-end">
                  <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {detailPrice}
                  </span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                    {detailCurrency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <EodAdjustedDailyPriceChartPanel tickerRaw={selectedRow.ticker} />

          <TechnicalRecommendationPanel row={selectedRow} t={t} />

          <DecisionDiagnosticsPanel row={selectedRow} t={t} />
        </section>
      )}

      {!loading && !error && data.length > 0 && selectedRow == null && filteredCount === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400" role="status">
          {t('underDevelopmentView.noSearchMatches')}
        </p>
      )}

      {!loading && !error && data.length > 0 && selectedRow == null && filteredCount > 0 && (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          aria-label={t('navigation.underDevelopment')}
        >
          {filteredListRows.map((row) => {
            const key = rowKey(row);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => handleOpenCard(row)}
                  className="w-full text-left rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-sm min-h-[88px] flex flex-col justify-center hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-base font-semibold text-black dark:text-white leading-snug line-clamp-2">
                    {row.companyName}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-2">{row.ticker}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {t('stockAnalysesView.fiveYearBeta')}{' '}
                    <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                      {formatFiveYearBeta(row.fiveYearBeta)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function UnderDevelopmentView() {
  return (
    <EntryExitProvider>
      <UnderDevelopmentViewInner />
    </EntryExitProvider>
  );
}
