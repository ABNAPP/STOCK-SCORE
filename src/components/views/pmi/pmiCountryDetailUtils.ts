import type { PmiCountryDetailData, PmiHistoryPoint, PmiType } from '../../../services/pmi/types';

export type PmiTimeRange = '1y' | '3y' | '5y' | 'max';

export interface PmiComparisonCardModel {
  type: PmiType;
  latest: number | null;
  change: number | null;
  status: string;
  loading: boolean;
  unavailable: boolean;
}

export function isPlaceholderSeriesError(error: string | null): boolean {
  if (!error) {
    return false;
  }
  return error.includes('PMI series ID is missing');
}

export function formatPmiNumber(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function formatChange(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

export function getStatusLabel(
  value: number | null,
  labels: { unavailable: string; above50: string; below50: string }
): string {
  if (value === null) {
    return labels.unavailable;
  }
  return value >= 50 ? labels.above50 : labels.below50;
}

export function formatLastRefresh(value: Date | null, locale: string): string {
  if (!value) {
    return '—';
  }
  return value.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function filterHistoryByRange(history: PmiHistoryPoint[], range: PmiTimeRange): PmiHistoryPoint[] {
  if (range === 'max' || history.length === 0) {
    return history;
  }

  const latestDate = new Date(history[history.length - 1].date);
  const start = new Date(latestDate);
  const years = range === '1y' ? 1 : range === '3y' ? 3 : 5;
  start.setFullYear(start.getFullYear() - years);

  return history.filter((point) => new Date(point.date) >= start);
}

export function buildComparisonCardModel(
  type: PmiType,
  data: PmiCountryDetailData | null,
  loading: boolean,
  error: string | null
): PmiComparisonCardModel {
  const unavailable = !!error || !data;
  if (unavailable) {
    return {
      type,
      latest: null,
      change: null,
      status: 'unavailable',
      loading,
      unavailable: true,
    };
  }

  return {
    type,
    latest: data.latestValue,
    change: data.changeVsPrevious,
    status: data.latestValue !== null && data.latestValue >= 50 ? 'above50' : 'below50',
    loading,
    unavailable: false,
  };
}

