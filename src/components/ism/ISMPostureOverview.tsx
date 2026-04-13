import { useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { IsmOverviewSectorRow } from '../../types/ismSectorOverview';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader } from '../ui/Card';

function breadthSort(a: IsmOverviewSectorRow, b: IsmOverviewSectorRow): number {
  return (b.weighted_breadth_pct ?? -1) - (a.weighted_breadth_pct ?? -1);
}

function partitionSectors(sectors: IsmOverviewSectorRow[]) {
  const dataBuilding = sectors
    .filter((s) => s.missingDailyDoc || s.coverage_status === 'data_building')
    .sort((a, b) => {
      if (a.missingDailyDoc !== b.missingDailyDoc) return a.missingDailyDoc ? 1 : -1;
      return breadthSort(a, b);
    });

  const eligible = sectors.filter(
    (s) =>
      !s.missingDailyDoc &&
      s.coverage_status !== 'data_building' &&
      (s.coverage_status === 'limited' || s.coverage_status === 'full')
  );

  const strong = eligible.filter((s) => s.regime === 'strong').sort(breadthSort);
  const weak = eligible.filter((s) => s.regime === 'weak').sort(breadthSort);
  const transition = eligible.filter((s) => s.regime !== 'strong' && s.regime !== 'weak').sort(breadthSort);

  return { strong, transition, weak, dataBuilding };
}

function formatPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 10) / 10}%`;
}

function formatDateTime(ms: number | null, locale: string): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toLocaleString(locale === 'sv' ? 'sv-SE' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

type ISMPostureOverviewProps = {
  sectors: IsmOverviewSectorRow[];
  /** Distinct sectors from ingest (before Firestore); drives empty vs loading. */
  expectedSectorCount: number;
  ingestLoading: boolean;
  firestoreLoading: boolean;
  firestoreError: string | null;
  ingestError: string | null;
  onOpenSector: (row: IsmOverviewSectorRow) => void;
};

export default function ISMPostureOverview({
  sectors,
  expectedSectorCount,
  ingestLoading,
  firestoreLoading,
  firestoreError,
  ingestError,
  onOpenSector,
}: ISMPostureOverviewProps) {
  const { t, i18n } = useTranslation();
  const { strong, transition, weak, dataBuilding } = useMemo(() => partitionSectors(sectors), [sectors]);

  const summary = useMemo(() => {
    const buildingCount = sectors.filter((s) => s.missingDailyDoc || s.coverage_status === 'data_building').length;
    const withBreadth = sectors.filter((s) => !s.missingDailyDoc && s.weighted_breadth_pct != null);
    const avgBreadth =
      withBreadth.length > 0
        ? withBreadth.reduce((a, s) => a + (s.weighted_breadth_pct as number), 0) / withBreadth.length
        : null;
    const withComputed = sectors.filter((s) => !s.missingDailyDoc && s.computed_at != null);
    const lastComputed = withComputed.length
      ? Math.max(...withComputed.map((s) => s.computed_at as number))
      : null;
    const withReb = sectors.filter((s) => !s.missingDailyDoc && s.active_rebalance_timestamp != null);
    let activeRebalanceDate: string | null = null;
    if (withReb.length > 0) {
      const best = withReb.reduce((a, s) =>
        (s.active_rebalance_timestamp as number) > (a.active_rebalance_timestamp as number) ? s : a
      );
      activeRebalanceDate = best.active_rebalance_date;
    }
    return {
      strongCount: strong.length,
      transitionCount: transition.length,
      weakCount: weak.length,
      buildingCount,
      avgBreadth,
      lastComputed,
      activeRebalanceDate,
    };
  }, [sectors, strong, transition, weak]);

  const pageLoading = ingestLoading || (firestoreLoading && expectedSectorCount > 0);
  const locale = i18n.language?.startsWith('sv') ? 'sv' : 'en';

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col">
      <div className="w-full flex flex-col flex-1 min-h-0 max-w-7xl mx-auto">
        <header className="flex-shrink-0 mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight">
            {t('navigation.ismPosturePositioning')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('ism.overview.subtitle')}
          </p>
        </header>

        {(ingestError || firestoreError) && (
          <p className="text-sm text-error-600 dark:text-error-400 mb-3" role="alert">
            {ingestError ?? firestoreError}
          </p>
        )}

        {pageLoading && expectedSectorCount === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        )}

        {pageLoading && expectedSectorCount > 0 && sectors.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('ism.overview.loadingDaily')}</p>
        )}

        {!pageLoading && expectedSectorCount === 0 && !ingestError && !firestoreError && (
          <Card variant="outlined" padding="md">
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('ism.overview.emptyUniverse')}</p>
            </CardContent>
          </Card>
        )}

        {!pageLoading && expectedSectorCount > 0 && sectors.length > 0 && (
          <>
            <section
              className="flex flex-wrap gap-2 sm:gap-3 mb-5 p-3 sm:p-4 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-gray-800"
              aria-label={t('ism.overview.summaryAria')}
            >
              <SummaryChip label={t('ism.overview.strong')} value={String(summary.strongCount)} variant="success" />
              <SummaryChip label={t('ism.overview.transition')} value={String(summary.transitionCount)} variant="warning" />
              <SummaryChip label={t('ism.overview.weak')} value={String(summary.weakCount)} variant="error" />
              <SummaryChip label={t('ism.overview.building')} value={String(summary.buildingCount)} variant="info" />
              <SummaryChip
                label={t('ism.overview.avgBreadth')}
                value={summary.avgBreadth == null ? '—' : formatPct(summary.avgBreadth)}
                variant="default"
              />
              <SummaryChip
                label={t('ism.overview.lastUpdate')}
                value={formatDateTime(summary.lastComputed, locale)}
                variant="default"
              />
              <SummaryChip
                label={t('ism.overview.activeRebalance')}
                value={summary.activeRebalanceDate ?? '—'}
                variant="primary"
              />
            </section>

            <div className="flex-1 min-h-0 space-y-8 overflow-y-auto">
              <SectorSection title={t('ism.overview.sectionStrong')} rows={strong} onOpenSector={onOpenSector} />
              <SectorSection title={t('ism.overview.sectionTransition')} rows={transition} onOpenSector={onOpenSector} />
              <SectorSection title={t('ism.overview.sectionWeak')} rows={weak} onOpenSector={onOpenSector} />
              <SectorSection title={t('ism.overview.sectionDataBuilding')} rows={dataBuilding} onOpenSector={onOpenSector} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: ComponentProps<typeof Badge>['variant'];
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[7rem]">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <Badge variant={variant} size="sm">
        {value}
      </Badge>
    </div>
  );
}

function SectorSection({
  title,
  rows,
  onOpenSector,
}: {
  title: string;
  rows: IsmOverviewSectorRow[];
  onOpenSector: (row: IsmOverviewSectorRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <SectorCard key={row.sectorId} row={row} onOpenSector={onOpenSector} />
        ))}
      </div>
    </section>
  );
}

function SectorCard({ row, onOpenSector }: { row: IsmOverviewSectorRow; onOpenSector: (row: IsmOverviewSectorRow) => void }) {
  const { t } = useTranslation();
  const isDataBuildingCard = row.missingDailyDoc || row.coverage_status === 'data_building';

  const regimeVariant: ComponentProps<typeof Badge>['variant'] =
    isDataBuildingCard
      ? 'default'
      : row.regime === 'strong'
      ? 'success'
      : row.regime === 'weak'
        ? 'error'
        : row.regime === 'transition'
          ? 'warning'
          : 'default';

  const rsLabel =
    row.rs_above_rs_ma_252 == null
      ? t('ism.overview.rsUnknown')
      : row.rs_above_rs_ma_252
        ? t('ism.overview.rsAboveMa')
        : t('ism.overview.rsBelowMa');

  const trendLabel =
    row.sector_above_sma_200 == null
      ? t('ism.overview.trendUnknown')
      : row.sector_above_sma_200
        ? row.sector_sma_200_rising
          ? t('ism.overview.trendAboveRising')
          : t('ism.overview.trendAboveFalling')
        : row.sector_sma_200_rising
          ? t('ism.overview.trendBelowRising')
          : t('ism.overview.trendBelowFalling');

  const breadthVerdict =
    row.breadth_confirmed == null
      ? t('ism.overview.breadthUnknown')
      : row.breadth_confirmed
        ? t('ism.overview.breadthConfirmed')
        : t('ism.overview.breadthNotMet');

  const coverageKey =
    row.missingDailyDoc || row.coverage_status == null
      ? 'ism.overview.coveragePending'
      : row.coverage_status === 'full'
        ? 'ism.overview.coverageFull'
        : row.coverage_status === 'limited'
          ? 'ism.overview.coverageLimited'
          : 'ism.overview.coverageDataBuilding';
  const coverageVariant: ComponentProps<typeof Badge>['variant'] =
    row.missingDailyDoc || row.coverage_status == null
      ? 'default'
      : row.coverage_status === 'full'
        ? 'success'
        : row.coverage_status === 'limited'
          ? 'warning'
          : 'info';

  const sizingKey =
    row.allowed_sizing == null
      ? 'ism.overview.sizingUnknown'
      : row.allowed_sizing === 'core_allowed'
        ? 'ism.overview.sizingCore'
        : row.allowed_sizing === 'probe_only'
          ? 'ism.overview.sizingProbe'
          : 'ism.overview.sizingNoNew';

  const regimeLabel =
    isDataBuildingCard
      ? t('ism.overview.regimeNotAvailable')
      : row.regime == null
        ? t('ism.overview.regimeUnknown')
        : t(`ism.overview.regime.${row.regime}`);

  return (
    <Card
      variant="outlined"
      padding="md"
      className="flex flex-col cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors focus-within:ring-2 focus-within:ring-primary-500"
      role="button"
      tabIndex={0}
      onClick={() => onOpenSector(row)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenSector(row);
        }
      }}
    >
      <CardHeader
        title={row.sectorDisplayName}
        subtitle={
          row.missingDailyDoc
            ? t('ism.overview.cardPendingDoc')
            : row.coverage_status === 'data_building'
              ? t('ism.overview.cardDataBuilding')
            : row.docTradeDate
              ? t('ism.overview.cardTradeDate', { date: row.docTradeDate })
              : undefined
        }
      />
      <CardContent className="flex flex-wrap gap-1.5 items-start">
        <Badge variant={regimeVariant} size="sm">
          {regimeLabel}
        </Badge>
        <Badge variant={coverageVariant} size="sm">
          <LabelWithHint
            text={`${t('ism.overview.coverageLabel')}: ${t(coverageKey)}`}
            hint={t('ism.overview.tipCoverage')}
          />
        </Badge>
        <Badge variant="info" size="sm">
          <LabelWithHint
            text={t('ism.overview.breadthPct', { value: formatPct(row.weighted_breadth_pct) })}
            hint={t('ism.overview.tipBreadth')}
          />
        </Badge>
        <Badge variant="default" size="sm">
          <LabelWithHint text={t(sizingKey)} hint={t('ism.overview.tipAllowedSizing')} />
        </Badge>
        <Badge variant={row.rs_above_rs_ma_252 ? 'success' : 'default'} size="sm">
          <LabelWithHint text={rsLabel} hint={t('ism.overview.tipRs')} />
        </Badge>
        <Badge variant={row.sector_above_sma_200 ? 'primary' : 'warning'} size="sm">
          <LabelWithHint text={trendLabel} hint={t('ism.overview.tipAbsTrend')} />
        </Badge>
        <Badge variant={row.breadth_confirmed ? 'success' : 'warning'} size="sm">
          {breadthVerdict}
        </Badge>
      </CardContent>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">{t('ism.overview.statusNote')}:</span>{' '}
        {row.missingDailyDoc
          ? t('ism.overview.statusAwaitingDaily')
          : row.coverage_status === 'data_building'
            ? t('ism.overview.statusDataBuilding')
            : row.status_note ?? '—'}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 px-1">
        {t('ism.overview.coverageLabel')}: {t(coverageKey)}
      </p>
    </Card>
  );
}

function LabelWithHint({ text, hint }: { text: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{text}</span>
      <CompactInfoHint hint={hint} />
    </span>
  );
}

function CompactInfoHint({ hint }: { hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-400 text-[9px] leading-none text-gray-600 dark:text-gray-300 dark:border-gray-500"
        title={hint}
        aria-label={hint}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
        }}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-5 z-20 w-44 rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-[11px] normal-case tracking-normal text-gray-700 dark:text-gray-200 shadow"
        >
          {hint}
        </span>
      )}
    </span>
  );
}
