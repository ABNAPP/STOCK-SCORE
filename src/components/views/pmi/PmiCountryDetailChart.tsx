import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PmiCountryDetailData } from '../../../services/pmi/types';
import { filterHistoryByRange, formatPmiNumber, type PmiTimeRange } from './pmiCountryDetailUtils';

interface PmiCountryDetailChartProps {
  data: PmiCountryDetailData | null;
  loading: boolean;
  unavailableMessage: string | null;
  locale: string;
  noDataLabel: string;
}

const TIME_OPTIONS: Array<{ value: PmiTimeRange; label: string }> = [
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'Max' },
];

export default function PmiCountryDetailChart({
  data,
  loading,
  unavailableMessage,
  locale,
  noDataLabel,
}: PmiCountryDetailChartProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [range, setRange] = useState<PmiTimeRange>('3y');

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }
    return filterHistoryByRange(data.history, range).map((point) => ({
      date: point.date,
      value: point.value,
    }));
  }, [data, range]);

  const tickFill = resolvedTheme === 'dark' ? '#e5e7eb' : '#374151';
  const gridStroke = resolvedTheme === 'dark' ? '#374151' : '#e5e7eb';

  return (
    <section
      className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4"
      aria-label={t('toolbox.pmi.detail.chart.ariaLabel')}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h4 className="text-lg font-semibold text-black dark:text-white">
          {t('toolbox.pmi.detail.chart.title')}
        </h4>
        <div
          className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden"
          role="group"
          aria-label={t('toolbox.pmi.detail.chart.rangeLabel')}
        >
          {TIME_OPTIONS.map((option) => {
            const active = range === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                aria-pressed={active}
                className={`px-3 py-2 min-h-[44px] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('toolbox.pmi.detail.states.loading')}
        </p>
      )}

      {!loading && unavailableMessage && (
        <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
          {unavailableMessage}
        </div>
      )}

      {!loading && !unavailableMessage && chartData.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('toolbox.pmi.detail.states.emptyHistory')}
        </p>
      )}

      {!loading && !unavailableMessage && chartData.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: tickFill, fontSize: 11 }}
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
                }
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: tickFill, fontSize: 11 }}
                tickFormatter={(value: number) => value.toFixed(0)}
                width={42}
              />
              <Tooltip
                formatter={(value: number | null) => {
                  const formattedValue = formatPmiNumber(value);
                  return formattedValue === '—' ? noDataLabel : formattedValue;
                }}
                labelFormatter={(label) =>
                  new Date(label as string).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  })
                }
                contentStyle={{
                  borderRadius: 8,
                  borderColor: resolvedTheme === 'dark' ? '#4b5563' : '#d1d5db',
                  backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff',
                }}
              />
              <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

