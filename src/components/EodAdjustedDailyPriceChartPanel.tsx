import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { fetchEodAdjustedDailyPriceSeriesForAppTicker } from '../services/eodAdjustedDataService';
import {
  filterEodPointsByPreset,
  type EodAdjustedDailyRangePreset,
} from '../utils/eodAdjustedDailyRangeFilter';

type Props = {
  /** Score Board / DashBoard ticker as shown in the app (e.g. `VOLV-B`, `AAPL`). */
  tickerRaw: string;
};

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export default function EodAdjustedDailyPriceChartPanel({ tickerRaw }: Props) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const tickFill = isDark ? '#e5e7eb' : '#374151';
  const gridStroke = isDark ? '#374151' : '#e5e7eb';

  const [preset, setPreset] = useState<EodAdjustedDailyRangePreset>('1y');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allPoints, setAllPoints] = useState<{ date: string; price: number }[]>([]);
  const [staleGeneration, setStaleGeneration] = useState(false);

  const load = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setAllPoints([]);
      setStaleGeneration(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setAllPoints([]);
    setStaleGeneration(false);
    try {
      const res = await fetchEodAdjustedDailyPriceSeriesForAppTicker(trimmed);
      if (!res) {
        setLoadError(t('underDevelopmentView.adjustedDailyChartLoadError'));
        return;
      }
      setAllPoints(res.points);
      setStaleGeneration(res.staleGeneration);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setPreset('1y');
  }, [tickerRaw]);

  useEffect(() => {
    void load(tickerRaw);
  }, [tickerRaw, load]);

  const chartData = useMemo(() => filterEodPointsByPreset(allPoints, preset), [allPoints, preset]);

  const presets: { id: EodAdjustedDailyRangePreset; label: string }[] = [
    { id: '5y', label: t('underDevelopmentView.adjustedDailyRange5y') },
    { id: '1y', label: t('underDevelopmentView.adjustedDailyRange1y') },
    { id: 'ytd', label: t('underDevelopmentView.adjustedDailyRangeYtd') },
    { id: 'mtd', label: t('underDevelopmentView.adjustedDailyRangeMtd') },
  ];

  return (
    <section
      className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-600"
      role="region"
      aria-labelledby="score-board-adjusted-daily-chart-title"
    >
      <h3
        id="score-board-adjusted-daily-chart-title"
        className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
      >
        {t('underDevelopmentView.adjustedDailyChartTitle')}
      </h3>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
        {t('underDevelopmentView.adjustedDailyChartSubtitle')}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              preset === p.id
                ? 'bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-500'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {staleGeneration && !loading && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          {t('underDevelopmentView.adjustedDailyStaleGeneration')}
        </p>
      )}
      {loadError && (
        <p className="text-sm text-error-600 dark:text-error-400 mb-3" role="alert">
          {loadError}
        </p>
      )}
      {loading && (
        <div className="h-[280px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          {t('underDevelopmentView.adjustedDailyChartLoading')}
        </div>
      )}
      {!loading && !loadError && chartData.length === 0 && (
        <div className="h-[160px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 text-center px-4">
          {t('underDevelopmentView.adjustedDailyChartEmpty')}
        </div>
      )}
      {!loading && chartData.length > 0 && (
        <div className="w-full h-[320px] min-h-[240px] sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fill: tickFill, fontSize: 10 }}
                minTickGap={28}
                angle={-35}
                textAnchor="end"
                height={48}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: tickFill, fontSize: 10 }}
                width={56}
                tickFormatter={(v) => formatPrice(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#fff',
                  border: `1px solid ${gridStroke}`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: tickFill }}
                formatter={(value: number) => [formatPrice(value), t('underDevelopmentView.adjustedDailyTooltipSeries')]}
                labelFormatter={(label) => `${t('underDevelopmentView.adjustedDailyTooltipDate')}: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="price"
                name={t('underDevelopmentView.adjustedDailyTooltipSeries')}
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                isAnimationActive={chartData.length < 400}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
