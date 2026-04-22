import { getPmiCountrySearchTokens } from '../../../services/pmi/countryAliases';
import type { PmiHeatmapData, PmiHeatmapRow, PmiMonthDataPoint } from '../../../services/pmi/types';

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

export interface PmiHeatmapDisplayRow {
  countryCode: string;
  countryName: string;
  months: PmiMonthDataPoint[];
  latestPoint: PmiMonthDataPoint | null;
  latestValue: number | null;
  latestChange: number | null;
  searchText: string;
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
  row: Pick<PmiHeatmapDisplayRow, 'months'>,
  visibleMonths: ReadonlySet<string>
): boolean {
  return row.months.some((point) => visibleMonths.has(point.month) && point.value !== null);
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
  visibleMonths: ReadonlySet<string>
): PmiHeatmapDisplayRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const aHasData = hasVisiblePmiData(a, visibleMonths);
    const bHasData = hasVisiblePmiData(b, visibleMonths);

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

export function filterAndSortHeatmapRows(
  data: PmiHeatmapData,
  sortBy: PmiSortOption,
  searchValue: string
): PmiHeatmapDisplayRow[] {
  const visibleMonths = new Set(data.months.slice(-3));
  const mapped = data.rows.map((row) => {
    const latestPoint = row.months[row.months.length - 1] ?? null;
    return {
      countryCode: row.countryCode,
      countryName: row.countryName,
      months: row.months,
      latestPoint,
      latestValue: latestPoint?.value ?? null,
      latestChange: latestPoint?.changeVsPrevious ?? null,
      searchText: toSearchText(row),
    };
  });

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filtered = normalizedSearch
    ? mapped.filter((row) => row.searchText.includes(normalizedSearch))
    : mapped;

  return sortRows(filtered, sortBy, visibleMonths);
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

