import { getPmiCountrySearchTokens } from '../../../services/pmi/countryAliases';
import type {
  PmiHeatmapData,
  PmiHeatmapRow,
  PmiMonthDataPoint,
  PmiYearDataPoint,
} from '../../../services/pmi/types';

export type PmiSortOption =
  | 'highest-pmi'
  | 'lowest-pmi'
  | 'biggest-improvement'
  | 'biggest-deterioration'
  | 'alphabetical';

export type PmiHeatmapTone =
  | 'dark-green'
  | 'light-green'
  | 'neutral'
  | 'light-red'
  | 'dark-red'
  | 'no-data';

export type PmiHeatmapRange = '1y' | '3y' | '5y';
export type PmiHeatmapColumnKind = 'year' | 'month';

export interface PmiHeatmapColumn {
  key: string;
  kind: PmiHeatmapColumnKind;
  value: string;
}

export interface PmiHeatmapCellPoint {
  value: number | null;
  previousValue: number | null;
  changeVsPrevious: number | null;
}

export interface PmiHeatmapDisplayRow {
  countryCode: string;
  countryName: string;
  recentMonths: PmiMonthDataPoint[];
  yearly: PmiYearDataPoint[];
  latestPoint: PmiMonthDataPoint | null;
  latestValue: number | null;
  latestChange: number | null;
  searchText: string;
  pointsByColumnKey: Map<string, PmiHeatmapCellPoint>;
}

function toSearchText(row: PmiHeatmapRow): string {
  const aliasTokens = getPmiCountrySearchTokens(row.countryCode);
  return `${row.countryName} ${aliasTokens.join(' ')}`.toLowerCase();
}

function compareNullableNumber(a: number | null, b: number | null, direction: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

export function hasVisiblePmiData(
  row: Pick<PmiHeatmapDisplayRow, 'pointsByColumnKey'>,
  visibleColumnKeys: ReadonlySet<string>
): boolean {
  for (const columnKey of visibleColumnKeys) {
    const point = row.pointsByColumnKey.get(columnKey);
    if (point && point.value !== null) {
      return true;
    }
  }
  return false;
}

function compareRowsWithinGroup(a: PmiHeatmapDisplayRow, b: PmiHeatmapDisplayRow, sortBy: PmiSortOption): number {
  if (sortBy === 'alphabetical') {
    return a.countryName.localeCompare(b.countryName);
  }
  if (sortBy === 'highest-pmi') {
    return compareNullableNumber(a.latestValue, b.latestValue, 'desc');
  }
  if (sortBy === 'lowest-pmi') {
    return compareNullableNumber(a.latestValue, b.latestValue, 'asc');
  }
  if (sortBy === 'biggest-improvement') {
    return compareNullableNumber(a.latestChange, b.latestChange, 'desc');
  }
  return compareNullableNumber(a.latestChange, b.latestChange, 'asc');
}

function sortRows(
  rows: PmiHeatmapDisplayRow[],
  sortBy: PmiSortOption,
  visibleColumnKeys: ReadonlySet<string>
): PmiHeatmapDisplayRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const aHasData = hasVisiblePmiData(a, visibleColumnKeys);
    const bHasData = hasVisiblePmiData(b, visibleColumnKeys);

    if (aHasData !== bHasData) {
      return aHasData ? -1 : 1;
    }

    if (!aHasData && !bHasData) {
      return a.countryName.localeCompare(b.countryName);
    }

    const withinGroup = compareRowsWithinGroup(a, b, sortBy);
    if (withinGroup !== 0) {
      return withinGroup;
    }

    return a.countryName.localeCompare(b.countryName);
  });
  return sorted;
}

function monthColumnKey(month: string): string {
  return `month:${month}`;
}

function yearColumnKey(year: string): string {
  return `year:${year}`;
}

export function getMonthColumnKey(month: string): string {
  return monthColumnKey(month);
}

export function getYearColumnKey(year: string): string {
  return yearColumnKey(year);
}

export function buildHeatmapColumns(data: PmiHeatmapData, range: PmiHeatmapRange): PmiHeatmapColumn[] {
  const yearCount = range === '1y' ? 1 : range === '3y' ? 3 : 5;
  const yearColumns = data.years.slice(-yearCount).map((year) => ({
    key: yearColumnKey(year),
    kind: 'year' as const,
    value: year,
  }));
  const monthColumns = data.recentMonths.slice(-3).map((month) => ({
    key: monthColumnKey(month),
    kind: 'month' as const,
    value: month,
  }));
  return [...yearColumns, ...monthColumns];
}

export function getPointForColumn(
  row: Pick<PmiHeatmapDisplayRow, 'pointsByColumnKey'>,
  columnKey: string
): PmiHeatmapCellPoint | null {
  return row.pointsByColumnKey.get(columnKey) ?? null;
}

export function filterAndSortHeatmapRows(
  data: PmiHeatmapData,
  sortBy: PmiSortOption,
  searchValue: string,
  range: PmiHeatmapRange
): PmiHeatmapDisplayRow[] {
  const visibleColumnKeys = new Set(buildHeatmapColumns(data, range).map((column) => column.key));
  const mapped = data.rows.map((row) => {
    const latestPoint = row.recentMonths[row.recentMonths.length - 1] ?? null;
    const pointsByColumnKey = new Map<string, PmiHeatmapCellPoint>();
    row.yearly.forEach((point) => {
      pointsByColumnKey.set(yearColumnKey(point.year), {
        value: point.value,
        previousValue: point.previousValue,
        changeVsPrevious: point.changeVsPrevious,
      });
    });
    row.recentMonths.forEach((point) => {
      pointsByColumnKey.set(monthColumnKey(point.month), {
        value: point.value,
        previousValue: point.previousValue,
        changeVsPrevious: point.changeVsPrevious,
      });
    });
    return {
      countryCode: row.countryCode,
      countryName: row.countryName,
      recentMonths: row.recentMonths,
      yearly: row.yearly,
      latestPoint,
      latestValue: latestPoint?.value ?? null,
      latestChange: latestPoint?.changeVsPrevious ?? null,
      searchText: toSearchText(row),
      pointsByColumnKey,
    };
  });

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filtered = normalizedSearch
    ? mapped.filter((row) => row.searchText.includes(normalizedSearch))
    : mapped;

  return sortRows(filtered, sortBy, visibleColumnKeys);
}

export function getHeatmapTone(change: number | null): PmiHeatmapTone {
  if (change === null) return 'no-data';
  if (change >= 1.0) return 'dark-green';
  if (change >= 0.3) return 'light-green';
  if (change <= -1.0) return 'dark-red';
  if (change <= -0.3) return 'light-red';
  return 'neutral';
}

export function getHeatmapToneClasses(tone: PmiHeatmapTone): string {
  if (tone === 'dark-green') return 'bg-green-700 text-white';
  if (tone === 'light-green') return 'bg-green-200 text-green-900';
  if (tone === 'dark-red') return 'bg-red-700 text-white';
  if (tone === 'light-red') return 'bg-red-200 text-red-900';
  if (tone === 'neutral') return 'bg-secondary-200 text-secondary-900 dark:bg-secondary-600 dark:text-secondary-50';
  return 'bg-secondary-300 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200';
}

export function formatMonthLabel(month: string, locale: string = 'en-US'): string {
  const [year, monthPart] = month.split('-');
  if (!year || !monthPart) {
    return month;
  }
  const date = new Date(`${year}-${monthPart}-01T00:00:00Z`);
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatYearLabel(year: string): string {
  return year;
}

export function formatPmiValue(value: number | null, noDataLabel: string): string {
  return value === null ? noDataLabel : value.toFixed(1);
}

export function formatChange(change: number | null, noDataLabel: string): string {
  if (change === null) return noDataLabel;
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(1)}`;
}

export function getStatusVs50(
  value: number | null,
  labels: { noData: string; above50: string; below50: string }
): string {
  if (value === null) return labels.noData;
  if (value >= 50) return labels.above50;
  return labels.below50;
}

