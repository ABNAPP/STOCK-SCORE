import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import type { PmiCountryCode, PmiType } from '../../../services/pmi/types';
import { usePmiData } from '../../../hooks/usePmiData';
import { buildPmiInsight } from './pmiCountryInsight';
import PmiCountryDetailChart from './PmiCountryDetailChart';
import {
  buildComparisonCardModel,
  formatChange,
  formatLastRefresh,
  formatPmiNumber,
  getStatusLabel,
  isPlaceholderSeriesError,
} from './pmiCountryDetailUtils';

interface PmiCountryDetailPageProps {
  countryCode: PmiCountryCode;
  countryName: string;
  type: PmiType;
  onBack: () => void;
  onTypeChange: (type: PmiType) => void;
}

const TYPE_OPTIONS: Array<{ type: PmiType; key: string }> = [
  { type: 'composite', key: 'composite' },
  { type: 'manufacturing', key: 'manufacturing' },
  { type: 'services', key: 'services' },
];

export default function PmiCountryDetailPage({
  countryCode,
  countryName,
  type,
  onBack,
  onTypeChange,
}: PmiCountryDetailPageProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'sv' ? 'sv-SE' : 'en-US';

  const composite = usePmiData({ mode: 'countryDetail', type: 'composite', country: countryCode });
  const manufacturing = usePmiData({ mode: 'countryDetail', type: 'manufacturing', country: countryCode });
  const services = usePmiData({ mode: 'countryDetail', type: 'services', country: countryCode });

  const active = type === 'composite' ? composite : type === 'manufacturing' ? manufacturing : services;
  const activeData = active.data && 'history' in active.data ? active.data : null;

  const comparisonCards = useMemo(
    () => [
      buildComparisonCardModel(
        'composite',
        composite.data && 'history' in composite.data ? composite.data : null,
        composite.loading,
        composite.error
      ),
      buildComparisonCardModel(
        'manufacturing',
        manufacturing.data && 'history' in manufacturing.data ? manufacturing.data : null,
        manufacturing.loading,
        manufacturing.error
      ),
      buildComparisonCardModel(
        'services',
        services.data && 'history' in services.data ? services.data : null,
        services.loading,
        services.error
      ),
    ],
    [composite, manufacturing, services]
  );

  const insightLines = useMemo(
    () =>
      buildPmiInsight({
        activeType: type,
        cards: comparisonCards,
        labels: {
          noInsight: t('toolbox.pmi.detail.states.emptyInsight'),
          stable: t('toolbox.pmi.detail.insight.direction.stable'),
          improving: t('toolbox.pmi.detail.insight.direction.improving'),
          softening: t('toolbox.pmi.detail.insight.direction.softening'),
          expansionTerritory: t('toolbox.pmi.detail.insight.territory.expansion'),
          contractionTerritory: t('toolbox.pmi.detail.insight.territory.contraction'),
          sentenceOne: ({ typeLabel, latest, territory, direction }) =>
            t('toolbox.pmi.detail.insight.templates.primary', {
              typeLabel,
              latest,
              territory,
              direction,
            }),
          sentenceTwo: ({ change }) =>
            t('toolbox.pmi.detail.insight.templates.momentum', {
              change,
            }),
          sentenceThree: ({ bestType, bestValue, worstType, worstValue }) =>
            t('toolbox.pmi.detail.insight.templates.comparison', {
              bestType,
              bestValue,
              worstType,
              worstValue,
            }),
          typeLabel: (value) => t(`toolbox.pmi.heatmap.type.${value}`),
        },
      }),
    [type, comparisonCards, t]
  );

  const unavailableMessage = useMemo(() => {
    if (!active.error) {
      return null;
    }
    if (isPlaceholderSeriesError(active.error)) {
      return t('toolbox.pmi.detail.states.seriesMapPending');
    }
    return t('toolbox.pmi.detail.states.unavailableType');
  }, [active.error, t]);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="outline" size="sm" onClick={onBack}>
              {t('toolbox.pmi.detail.backToHeatmap')}
            </Button>
            <h3 className="mt-3 text-2xl font-semibold text-black dark:text-white">{countryName}</h3>
          </div>
          <div
            className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden"
            role="group"
            aria-label={t('toolbox.pmi.detail.controls.typeLabel')}
          >
            {TYPE_OPTIONS.map((option) => {
              const activeType = type === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => onTypeChange(option.type)}
                  aria-pressed={activeType}
                  className={`px-4 py-2 min-h-[44px] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    activeType
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`toolbox.pmi.heatmap.type.${option.key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3" aria-label={t('toolbox.pmi.detail.kpi.ariaLabel')}>
        <Card variant="elevated" padding="md" className="md:col-span-2">
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('toolbox.pmi.detail.kpi.latestPmi')}
            </p>
            <p className="mt-1 text-3xl font-bold text-black dark:text-white">
              {formatPmiNumber(activeData?.latestValue ?? null)}
            </p>
          </CardContent>
        </Card>
        <Card variant="outlined" padding="md">
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('toolbox.pmi.detail.kpi.change')}
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-white">
              {formatChange(activeData?.changeVsPrevious ?? null)}
            </p>
          </CardContent>
        </Card>
        <Card variant="outlined" padding="md">
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('toolbox.pmi.detail.kpi.previousPmi')}
            </p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-white">
              {formatPmiNumber(activeData?.previousValue ?? null)}
            </p>
          </CardContent>
        </Card>
        <Card variant="outlined" padding="md">
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('toolbox.pmi.detail.kpi.status')}
            </p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-white">
              {getStatusLabel(activeData?.latestValue ?? null, {
                unavailable: t('toolbox.pmi.detail.common.unavailable'),
                above50: t('toolbox.pmi.detail.common.above50'),
                below50: t('toolbox.pmi.detail.common.below50'),
              })}
            </p>
          </CardContent>
        </Card>
        <Card variant="outlined" padding="md">
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('toolbox.pmi.detail.kpi.lastUpdate')}
            </p>
            <p className="mt-1 text-sm font-medium text-black dark:text-white">
              {formatLastRefresh(active.lastUpdated, locale)}
            </p>
          </CardContent>
        </Card>
      </section>

      <PmiCountryDetailChart
        data={activeData}
        loading={active.loading}
        unavailableMessage={unavailableMessage}
        locale={locale}
        noDataLabel={t('toolbox.pmi.detail.common.noData')}
      />

      <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
        <h4 className="text-lg font-semibold text-black dark:text-white mb-3">
          {t('toolbox.pmi.detail.comparison.title')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {comparisonCards.map((card) => {
            const isActive = card.type === type;
            return (
              <button
                key={card.type}
                type="button"
                onClick={() => onTypeChange(card.type)}
                aria-pressed={isActive}
                className={`rounded-md border p-3 text-left transition-colors min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <p className="text-sm font-semibold text-black dark:text-white">
                  {t(`toolbox.pmi.heatmap.type.${card.type}`)}
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                  {t('toolbox.pmi.detail.comparison.latest')}:{' '}
                  {card.loading ? t('toolbox.pmi.detail.states.loadingShort') : formatPmiNumber(card.latest)}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {t('toolbox.pmi.detail.comparison.change')}:{' '}
                  {card.loading ? t('toolbox.pmi.detail.states.loadingShort') : formatChange(card.change)}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {t('toolbox.pmi.detail.comparison.status')}:{' '}
                  {card.loading
                    ? t('toolbox.pmi.detail.states.loadingShort')
                    : card.status === 'above50'
                      ? t('toolbox.pmi.detail.common.above50')
                      : card.status === 'below50'
                        ? t('toolbox.pmi.detail.common.below50')
                        : t('toolbox.pmi.detail.common.unavailable')}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4" aria-live="polite">
        <h4 className="text-lg font-semibold text-black dark:text-white mb-2">
          {t('toolbox.pmi.detail.insight.title')}
        </h4>
        {insightLines.length > 0 ? (
          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {insightLines.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('toolbox.pmi.detail.states.emptyInsight')}
          </p>
        )}
      </section>

      <section className="rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium">{t('toolbox.pmi.detail.metadata.title')}</p>
        <p>{t('toolbox.pmi.detail.metadata.source', { source: active.source ?? 'FRED' })}</p>
        <p>
          {t('toolbox.pmi.detail.metadata.latestRelease', {
            value: active.latestReleaseDate ?? t('toolbox.pmi.detail.common.unavailable'),
          })}
        </p>
        <p>
          {t('toolbox.pmi.detail.metadata.lastRefresh', {
            value: formatLastRefresh(active.lastUpdated, locale),
          })}
        </p>
        <p>{t('toolbox.pmi.detail.metadata.releaseTiming')}</p>
      </section>
    </div>
  );
}

