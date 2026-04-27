import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableSkeleton } from '../../SkeletonLoader';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import PmiHeatmapLegend from './PmiHeatmapLegend';
import PmiHeatmapCellTooltip from './PmiHeatmapCellTooltip';
import {
  buildHeatmapColumns,
  filterAndSortHeatmapRows,
  formatChange,
  formatMonthLabel,
  formatPmiValue,
  formatYearLabel,
  getMonthColumnKey,
  getPointForColumn,
  getHeatmapTone,
  getHeatmapToneClasses,
  getStatusVs50,
  type PmiHeatmapRange,
  type PmiSortOption,
} from './pmiHeatmapUtils';
import { isPlaceholderSeriesError } from './pmiCountryDetailUtils';
import type { PmiCountryCode, PmiHeatmapData, PmiType } from '../../../services/pmi/types';

interface PmiHeatmapViewProps {
  type: PmiType;
  data: PmiHeatmapData | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  latestReleaseDate: string | null;
  lastUpdated: Date | null;
  onTypeChange: (type: PmiType) => void;
  onRetry: () => void;
  onCountrySelect: (countryCode: PmiCountryCode) => void;
}

const TYPE_BUTTONS: Array<{ value: PmiType; key: string }> = [
  { value: 'composite', key: 'composite' },
  { value: 'manufacturing', key: 'manufacturing' },
  { value: 'services', key: 'services' },
];

const SORT_OPTIONS: Array<{ value: PmiSortOption; key: string }> = [
  { value: 'biggest-improvement', key: 'biggestImprovement' },
  { value: 'biggest-deterioration', key: 'biggestDeterioration' },
  { value: 'alphabetical', key: 'alphabetical' },
];

const RANGE_OPTIONS: Array<{ value: PmiHeatmapRange; key: string }> = [
  { value: '1y', key: 'oneYearPlusThreeMonths' },
  { value: '3y', key: 'threeYearsPlusThreeMonths' },
  { value: '5y', key: 'fiveYearsPlusThreeMonths' },
];

function formatLastUpdated(lastUpdated: Date | null, locale: string, noDataLabel: string): string {
  if (!lastUpdated) {
    return noDataLabel;
  }
  return lastUpdated.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PmiHeatmapView({
  type,
  data,
  loading,
  error,
  source,
  latestReleaseDate,
  lastUpdated,
  onTypeChange,
  onRetry,
  onCountrySelect,
}: PmiHeatmapViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'sv' ? 'sv-SE' : 'en-US';
  const [sortBy, setSortBy] = useState<PmiSortOption>('biggest-improvement');
  const [searchValue, setSearchValue] = useState('');
  const [timeRange, setTimeRange] = useState<PmiHeatmapRange>('5y');

  const rows = useMemo(() => {
    if (!data) return [];
    return filterAndSortHeatmapRows(data, sortBy, searchValue, timeRange);
  }, [data, sortBy, searchValue, timeRange]);

  const columns = useMemo(() => {
    if (!data) return [];
    return buildHeatmapColumns(data, timeRange);
  }, [data, timeRange]);

  const recentMonthColumnKeys = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.recentMonths.slice(-3).map((month) => getMonthColumnKey(month)));
  }, [data]);

  const coverage = useMemo(() => {
    if (!data) {
      return { covered: 0, total: 0 };
    }
    const covered = data.rows.filter((row) =>
      row.recentMonths.some(
        (point) => recentMonthColumnKeys.has(getMonthColumnKey(point.month)) && point.value !== null
      )
    ).length;
    return { covered, total: data.rows.length };
  }, [data, recentMonthColumnKeys]);

  const compositeUnavailable = useMemo(() => {
    return type === 'composite' && isPlaceholderSeriesError(error);
  }, [type, error]);

  const professionalError = useMemo(() => {
    if (!error) return null;
    if (compositeUnavailable) {
      return null;
    }
    if (isPlaceholderSeriesError(error)) {
      return t('toolbox.pmi.heatmap.states.seriesMapPending');
    }
    return t('toolbox.pmi.heatmap.states.genericError');
  }, [error, compositeUnavailable, t]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold text-black dark:text-white">
          {t('toolbox.pmi.heatmap.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('toolbox.pmi.heatmap.subtitle')}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
              {t('toolbox.pmi.heatmap.controls.pmiType')}
            </p>
            <div
              className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden"
              role="group"
              aria-label={t('toolbox.pmi.heatmap.controls.pmiType')}
            >
              {TYPE_BUTTONS.map((item) => {
                const active = type === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onTypeChange(item.value)}
                    aria-pressed={active}
                    className={`px-4 py-2 min-h-[44px] text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t(`toolbox.pmi.heatmap.type.${item.key}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label={t('toolbox.pmi.heatmap.controls.timeRange')}
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as PmiHeatmapRange)}
              options={RANGE_OPTIONS.map((item) => ({
                value: item.value,
                label: t(`toolbox.pmi.heatmap.range.${item.key}`),
              }))}
              fullWidth
            />
            <Select
              label={t('toolbox.pmi.heatmap.controls.sortBy')}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as PmiSortOption)}
              options={SORT_OPTIONS.map((item) => ({
                value: item.value,
                label: t(`toolbox.pmi.heatmap.sort.${item.key}`),
              }))}
              fullWidth
            />
            <div className="flex items-end">
              <div className="w-full">
                <Input
                  label={t('toolbox.pmi.heatmap.controls.searchCountry')}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={t('toolbox.pmi.heatmap.controls.searchPlaceholder')}
                  fullWidth
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {t('toolbox.pmi.heatmap.controls.resultCount', {
                    filtered: rows.length,
                    total: data?.rows.length ?? 0,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PmiHeatmapLegend />

      <div className="rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium">{t('toolbox.pmi.heatmap.metadata.title')}</p>
        {!compositeUnavailable && coverage.total > 0 && (
          <p>
            {t('toolbox.pmi.heatmap.metadata.coverage', {
              covered: coverage.covered,
              total: coverage.total,
            })}
          </p>
        )}
        <p>{t('toolbox.pmi.heatmap.metadata.source', { source: source ?? 'FRED' })}</p>
        <p>{t('toolbox.pmi.heatmap.metadata.releaseTiming')}</p>
        <p>{t('toolbox.pmi.heatmap.metadata.updateCadence')}</p>
        <p>
          {t('toolbox.pmi.heatmap.metadata.lastRefresh', {
            value: formatLastUpdated(lastUpdated, locale, t('toolbox.pmi.heatmap.common.noData')),
          })}
        </p>
        <p>
          {t('toolbox.pmi.heatmap.metadata.latestRelease', {
            value: latestReleaseDate ?? t('toolbox.pmi.heatmap.common.noData'),
          })}
        </p>
      </div>

      {loading && (
        <div role="status" aria-live="polite">
          <TableSkeleton rows={8} columns={3} hasStickyColumns />
        </div>
      )}

      {!loading && compositeUnavailable && (
        <div
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4"
          role="status"
          aria-live="polite"
        >
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t('toolbox.pmi.heatmap.states.compositeUnavailableTitle')}
          </h4>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('toolbox.pmi.heatmap.states.compositeUnavailableDescription')}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('toolbox.pmi.heatmap.states.compositeUnavailableHint')}
          </p>
        </div>
      )}

      {!loading && professionalError && (
        <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4" role="alert" aria-live="assertive">
          <h4 className="text-lg font-semibold text-red-800 dark:text-red-200">
            {t('toolbox.pmi.heatmap.states.errorTitle')}
          </h4>
          <p className="mt-1 text-sm text-red-700 dark:text-red-200">{professionalError}</p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t('toolbox.pmi.heatmap.states.retry')}
            </Button>
          </div>
        </div>
      )}

      {!loading && !compositeUnavailable && !professionalError && rows.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center" role="status" aria-live="polite">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t('toolbox.pmi.heatmap.states.emptyTitle')}
          </h4>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('toolbox.pmi.heatmap.states.emptyDescription')}
          </p>
        </div>
      )}

      {!loading && !compositeUnavailable && !professionalError && rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto overflow-y-visible">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" aria-label={t('toolbox.pmi.heatmap.table.ariaLabel')}>
            <caption className="sr-only">{t('toolbox.pmi.heatmap.table.caption')}</caption>
            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900">
              <tr>
                <th scope="col" className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  {t('toolbox.pmi.heatmap.table.country')}
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                  >
                    {column.kind === 'year'
                      ? formatYearLabel(column.value)
                      : formatMonthLabel(column.value, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr key={row.countryCode} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm min-h-[44px]"
                      onClick={() => onCountrySelect(row.countryCode as PmiCountryCode)}
                      aria-label={t('toolbox.pmi.heatmap.table.countryAriaLabel', { country: row.countryName })}
                    >
                      {row.countryName}
                    </button>
                  </td>
                  {columns.map((column) => {
                    const point = getPointForColumn(row, column.key);
                    const tone = getHeatmapTone(point?.changeVsPrevious ?? null);
                    const cellClass = getHeatmapToneClasses(tone);
                    const columnLabel =
                      column.kind === 'year'
                        ? formatYearLabel(column.value)
                        : formatMonthLabel(column.value, locale);

                    return (
                      <td key={`${row.countryCode}-${column.key}`} className="px-4 py-3 text-center">
                        <PmiHeatmapCellTooltip
                          country={row.countryName}
                          pmiType={t(`toolbox.pmi.heatmap.type.${type}`)}
                          month={columnLabel}
                          latestPmi={formatPmiValue(point?.value ?? null, t('toolbox.pmi.heatmap.common.noData'))}
                          previousPmi={formatPmiValue(point?.previousValue ?? null, t('toolbox.pmi.heatmap.common.noData'))}
                          change={formatChange(point?.changeVsPrevious ?? null, t('toolbox.pmi.heatmap.common.noData'))}
                          statusVs50={getStatusVs50(point?.value ?? null, {
                            noData: t('toolbox.pmi.heatmap.common.noData'),
                            above50: t('toolbox.pmi.heatmap.common.above50'),
                            below50: t('toolbox.pmi.heatmap.common.below50'),
                          })}
                          lastUpdated={formatLastUpdated(lastUpdated, locale, t('toolbox.pmi.heatmap.common.noData'))}
                        >
                          <div
                            className={`mx-auto w-20 rounded-md px-2 py-1 text-sm font-semibold ${cellClass}`}
                          >
                            {formatPmiValue(point?.value ?? null, t('toolbox.pmi.heatmap.common.noData'))}
                          </div>
                        </PmiHeatmapCellTooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

