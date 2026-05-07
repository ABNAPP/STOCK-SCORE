import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScoreBreakdown,
  FUNDAMENTAL_MAX_SCORE_POINTS,
  TECHNICAL_MAX_SCORE_POINTS,
} from '../utils/calculateScoreDetailed';
import { formatScoreMetricLabel } from '../utils/scoreMetricLabels';
import { useTheme } from '../contexts/ThemeContext';

interface ScoreBreakdownRowProps {
  breakdown: ScoreBreakdown;
}

const FUNDAMENTAL_METRIC_ORDER = [
  'VALUATION_SCORE',
  'RISK_FLAG',
  'BUSINESS_QUALITY_SUMMARY',
  'SANITY_SUMMARY',
  'FORECAST_CONFIDENCE',
  'OPERATING_PILLAR_SCORE',
  'OVERALL_STRENGTH',
] as const;

const TECHNICAL_METRIC_ORDER = ['THEOENTRY'] as const;

export default function ScoreBreakdownRow({ breakdown }: ScoreBreakdownRowProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const metricDisplayLabel = (metric: string) => formatScoreMetricLabel(metric, t);

  // Group metrics by category and keep a stable, explicit order.
  // Important: zero-contribution metrics must still be rendered (red cards).
  const fundamentalItems = useMemo(() => {
    const items = breakdown.items.filter((item) => item.category === 'Fundamental');
    const orderIndex = new Map<string, number>(
      FUNDAMENTAL_METRIC_ORDER.map((metric, index) => [metric, index])
    );
    return [...items].sort((a, b) => {
      const ai = orderIndex.get(a.metric) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.metric) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.metric.localeCompare(b.metric);
    });
  }, [breakdown.items]);

  const technicalItems = useMemo(() => {
    const items = breakdown.items.filter((item) => item.category === 'Technical');
    const orderIndex = new Map<string, number>(
      TECHNICAL_METRIC_ORDER.map((metric, index) => [metric, index])
    );
    return [...items].sort((a, b) => {
      const ai = orderIndex.get(a.metric) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.metric) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.metric.localeCompare(b.metric);
    });
  }, [breakdown.items]);

  const safePoints = (value: number) => (Number.isFinite(value) ? value : 0);
  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

  const totalScore = safePoints(breakdown.totalScore);
  const fundamentalTotal = safePoints(breakdown.fundamentalTotal);
  const technicalTotal = safePoints(breakdown.technicalTotal);

  const donutPercent = clampPercent(totalScore);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (donutPercent / 100) * circumference;

  const fundamentalPercent = clampPercent((fundamentalTotal / FUNDAMENTAL_MAX_SCORE_POINTS) * 100);
  const technicalPercent = clampPercent((technicalTotal / TECHNICAL_MAX_SCORE_POINTS) * 100);

  const getDonutColor = (score: number) => {
    if (score >= 70) {
      return isDarkMode ? '#86efac' : '#16a34a';
    }
    if (score >= 50) {
      return isDarkMode ? '#fcd34d' : '#d97706';
    }
    return isDarkMode ? '#fca5a5' : '#dc2626';
  };

  const getCardStatusClass = (pointsRaw: number, weightRaw: number) => {
    const points = safePoints(pointsRaw);
    const weight = safePoints(weightRaw);
    const eps = 1e-6;
    if (weight > 0 && points >= weight - eps) {
      return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40';
    }
    if (points > eps) {
      return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40';
    }
    return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40';
  };

  const renderMetricCard = (item: ScoreBreakdown['items'][number], accent: 'blue' | 'green') => {
    const points = safePoints(item.points);
    const weight = safePoints(item.weight);
    const accentClass =
      accent === 'blue'
        ? 'border-l-4 border-l-blue-400'
        : 'border-l-4 border-l-green-400';
    const statusClass = getCardStatusClass(points, weight);

    return (
      <div
        key={`${item.metric}-${item.category}`}
        className={`rounded-lg border ${statusClass} ${accentClass} p-2`}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
              {metricDisplayLabel(item.metric)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Contribution
            </p>
          </div>
        </div>
        <div className="mt-1 flex items-end justify-between gap-1.5">
          <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
            {points.toFixed(1)} / {weight.toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">w: {weight.toFixed(2)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.2fr] gap-3 p-3 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center justify-center h-full">
        <div className="w-full">
          <h4 className="text-sm font-semibold text-black dark:text-white mb-2 text-center lg:text-left">
            Score overview
          </h4>
          <div className="w-full lg:max-w-3xl mx-auto min-h-[188px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-[18px] flex items-center">
            <div className="w-full grid grid-cols-1 sm:grid-cols-[184px_1fr] gap-4 sm:gap-5 items-center">
              <div className="flex justify-center">
                <div className="relative w-[142px] h-[142px]">
                  <svg className="w-[142px] h-[142px] -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={getDonutColor(totalScore)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-none">
                      {totalScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">out of 100</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fundamental</span>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {fundamentalTotal.toFixed(1)} / {FUNDAMENTAL_MAX_SCORE_POINTS}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400"
                      style={{ width: `${fundamentalPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Technical</span>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                      {technicalTotal.toFixed(1)} / {TECHNICAL_MAX_SCORE_POINTS}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
                    <div
                      className="h-full bg-green-500 dark:bg-green-400"
                      style={{ width: `${technicalPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Fundamental</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {safePoints(breakdown.fundamentalTotal).toFixed(1)} / {FUNDAMENTAL_MAX_SCORE_POINTS}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
            {fundamentalItems.map((item) => renderMetricCard(item, 'blue'))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-sm font-semibold text-green-700 dark:text-green-300">Technical</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {safePoints(breakdown.technicalTotal).toFixed(1)} / {TECHNICAL_MAX_SCORE_POINTS}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
            {technicalItems.map((item) => renderMetricCard(item, 'green'))}
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">w = weight</p>
        </div>
      </div>
    </div>
  );
}
