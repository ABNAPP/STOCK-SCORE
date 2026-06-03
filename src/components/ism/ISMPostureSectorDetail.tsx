import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';
import type { User } from 'firebase/auth';
import type { ISMInstrumentIngest } from '../../types/ismIngest';
import type { ParsedSectorIndexDaily } from '../../services/ism/dailySector/readSectorIndexDaily';
import { useIsmSectorDetailData, type IsmConstituentTableRow } from '../../hooks/useIsmSectorDetailData';
import { useToast } from '../../contexts/ToastContext';
import { postIsmSectorDailyIndex, postIsmSectorRebalance } from '../../services/valueInsightClient';
import { ISM_FULL_COVERAGE_TARGET } from '../../config/ismPostureDefaults';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import IsmSectorDetailChart from './IsmSectorDetailChart';
import { IsmSectorDetailLocalProvider, useIsmSectorDetailLocal } from './IsmSectorDetailLocalContext';
import IsmSectorAnalysisSettingsPanel from './IsmSectorAnalysisSettingsPanel';
import IsmSectorConstituentBasketTable from './IsmSectorConstituentBasketTable';

type ISMPostureSectorDetailProps = {
  user: User;
  sectorId: string;
  sectorDisplayName: string;
  ingestRows: ISMInstrumentIngest[];
  onBack: () => void;
};

function formatPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 10) / 10}%`;
}

function formatNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatTimestamp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  return new Date(v).toLocaleString();
}

function formatBool(v: boolean | null | undefined, t: TFunction): string {
  if (v == null) return '—';
  return v ? t('ism.detail.basketYes') : t('ism.detail.basketNo');
}

function isDataBuildingUx(missingDailyDoc: boolean, daily: ParsedSectorIndexDaily | null): boolean {
  return missingDailyDoc || daily?.coverage_status === 'data_building';
}

function rsStatusText(t: TFunction, above: boolean | null): string {
  if (above == null) return t('ism.detail.na');
  return above ? t('ism.detail.above') : t('ism.detail.below');
}

function slopeText(t: TFunction, rising: boolean | null): string {
  if (rising == null) return t('ism.detail.na');
  return rising ? t('ism.detail.rising') : t('ism.detail.falling');
}

function breadthVerdictText(t: TFunction, confirmed: boolean | null): string {
  if (confirmed == null) return t('ism.detail.na');
  return confirmed ? t('ism.detail.confirmed') : t('ism.detail.notConfirmed');
}

function breadthCharacterText(t: TFunction, confirmed: boolean | null): string {
  if (confirmed == null) return t('ism.detail.na');
  return confirmed ? t('ism.detail.healthy') : t('ism.detail.narrow');
}

function IsmDetailLocalNavExtras() {
  const { t } = useTranslation();
  const { isCustomActive, resetOfficialView } = useIsmSectorDetailLocal();
  return (
    <>
      {isCustomActive && (
        <Badge variant="warning" size="sm">
          {t('ism.detail.customViewActive')}
        </Badge>
      )}
      {isCustomActive && (
        <Button type="button" variant="outline" size="sm" onClick={() => void resetOfficialView()}>
          {t('ism.detail.resetOfficialView')}
        </Button>
      )}
    </>
  );
}

function IsmConstituentsLocalBreadthFooter() {
  const { t } = useTranslation();
  const { isCustomActive, committedLocalParams } = useIsmSectorDetailLocal();
  if (!isCustomActive) return null;
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 px-4 pb-3 pt-2 border-t border-secondary-100 dark:border-secondary-800">
      {t('ism.detail.tableLocalBreadthNote', {
        n: committedLocalParams.sectorSmaLength,
        lookback: committedLocalParams.slopeLookback,
      })}
    </p>
  );
}

function IsmSectorConstituentsSection({
  constituents,
  footer,
  formatNum,
}: {
  constituents: IsmConstituentTableRow[];
  footer: ReactNode;
  formatNum: (v: number | null | undefined, digits?: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex-1 min-h-0" aria-label={t('ism.detail.tableAria')}>
      <Card variant="outlined" padding="none" className="overflow-hidden flex flex-col min-h-0">
        <CardHeader title={t('ism.detail.constituentsTitle')} className="px-4 pt-4" />
        <div className="overflow-x-auto px-4 pb-4">
          {constituents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">{t('ism.detail.noConstituents')}</p>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-700 text-gray-600 dark:text-gray-400">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">{t('ism.detail.colTicker')}</th>
                  <th className="py-2 pr-3 font-medium">{t('ism.detail.colCompany')}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t('ism.detail.colShares')}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t('ism.detail.colLastClose')}</th>
                  <th className="py-2 font-medium text-right">{t('ism.detail.colCapUsd')}</th>
                </tr>
              </thead>
              <tbody>
                {constituents.map((c) => (
                  <tr
                    key={c.symbol_id}
                    className="border-b border-secondary-100 dark:border-secondary-800 text-gray-800 dark:text-gray-200"
                  >
                    <td className="py-2 pr-3">{c.rank}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{c.ticker_raw}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={c.company_name}>
                      {c.company_name}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.synthetic_shares.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatNum(c.last_close, 4)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNum(c.market_cap_usd, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {footer}
      </Card>
    </section>
  );
}

export default function ISMPostureSectorDetail({
  user,
  sectorId,
  sectorDisplayName,
  ingestRows,
  onBack,
}: ISMPostureSectorDetailProps) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [rebalanceRefreshing, setRebalanceRefreshing] = useState(false);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const {
    daily,
    docTradeDate,
    missingDailyDoc,
    usingStaleDaily,
    constituents,
    activeSnapshotDiagnostics,
    loading,
    error,
    refetch,
  } = useIsmSectorDetailData(sectorId);

  const hasAnalyticsShell = daily != null;
  const showOfficialStatus = hasAnalyticsShell && !missingDailyDoc;
  const showDegradedOnly = !loading && missingDailyDoc && !hasAnalyticsShell;

  const buildingUx = isDataBuildingUx(missingDailyDoc && !usingStaleDaily, daily);

  const handleRefreshDetail = async () => {
    if (detailRefreshing || rebalanceRefreshing) return;
    setDetailRefreshing(true);
    try {
      if (missingDailyDoc) {
        const dailyRes = await postIsmSectorDailyIndex(sectorId, user);
        if (!dailyRes.ok) {
          showError(
            t('ism.detail.refreshRebalanceSnapshotError', {
              detail: (dailyRes.errors ?? []).join(' · ') || 'daily index failed',
            })
          );
          return;
        }
      }
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showError(t('ism.detail.refreshRebalanceSnapshotError', { detail: msg }));
    } finally {
      setDetailRefreshing(false);
    }
  };

  const handleRefreshRebalanceSnapshot = async () => {
    if (rebalanceRefreshing) return;
    setRebalanceRefreshing(true);
    try {
      const rebalanceRes = await postIsmSectorRebalance(sectorId, user);
      if (!rebalanceRes.ok) {
        showError(
          t('ism.detail.refreshRebalanceSnapshotError', {
            detail: (rebalanceRes.errors ?? []).join(' · ') || 'rebalance failed',
          })
        );
        return;
      }

      const dailyRes = await postIsmSectorDailyIndex(sectorId, user);
      if (!dailyRes.ok) {
        showError(
          t('ism.detail.refreshRebalanceSnapshotError', {
            detail: (dailyRes.errors ?? []).join(' · ') || 'daily index failed',
          })
        );
        return;
      }

      showSuccess(t('ism.detail.refreshRebalanceSnapshotSuccess'));
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showError(t('ism.detail.refreshRebalanceSnapshotError', { detail: msg }));
    } finally {
      setRebalanceRefreshing(false);
    }
  };

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col">
      <div className="w-full flex flex-col flex-1 min-h-0 max-w-7xl mx-auto">
        <SectorDetailHeader
          sectorDisplayName={sectorDisplayName}
          daily={daily}
          missingDailyDoc={missingDailyDoc}
          buildingUx={buildingUx}
          docTradeDate={docTradeDate}
          loading={loading}
        />

        {error && (
          <p className="text-sm text-error-600 dark:text-error-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            {t('ism.detail.backToOverview')}
          </Button>
          {docTradeDate && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('ism.detail.tradeDate', { date: docTradeDate })}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleRefreshDetail()}
            disabled={loading || detailRefreshing || rebalanceRefreshing}
          >
            {detailRefreshing ? t('ism.detail.refreshRebalanceSnapshotRunning') : t('ism.detail.refresh')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshRebalanceSnapshot()}
            disabled={loading || rebalanceRefreshing || ingestRows.length === 0}
          >
            {rebalanceRefreshing ? t('ism.detail.refreshRebalanceSnapshotRunning') : t('ism.detail.refreshRebalanceSnapshot')}
          </Button>
        </div>

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('ism.detail.loadingDetail')}</p>}

        {showDegradedOnly && <SectorDetailStatusBoxPlaceholder />}

        {showDegradedOnly && (
          <IsmSectorConstituentsSection constituents={constituents} footer={null} formatNum={formatNum} />
        )}

        {!loading && hasAnalyticsShell && daily && (
          <IsmSectorDetailLocalProvider sectorId={sectorId} daily={daily} constituents={constituents}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDiagnosticsOpen(true)}>
                {t('ism.detail.diagnosticsButton')}
              </Button>
              <IsmDetailLocalNavExtras />
            </div>
            {usingStaleDaily && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3" role="status">
                {t('ism.detail.staleDailyDocBanner', { date: docTradeDate ?? '—' })}
              </p>
            )}
            <IsmRebalanceChangeSummary
              addedCount={activeSnapshotDiagnostics.addedCount}
              removedCount={activeSnapshotDiagnostics.removedCount}
              unchangedCount={activeSnapshotDiagnostics.unchangedCount}
              usingPreviousActiveSnapshot={activeSnapshotDiagnostics.usingPreviousActiveSnapshot}
            />

            {showOfficialStatus ? (
              <SectorDetailStatusBox daily={daily} buildingUx={buildingUx} />
            ) : (
              <SectorDetailStatusBoxPlaceholder />
            )}

            <IsmSectorAnalysisSettingsPanel />
            <IsmSectorDetailChart constituents={constituents} />
            {showOfficialStatus ? (
              <IsmSectorConstituentBasketTable footer={<IsmConstituentsLocalBreadthFooter />} />
            ) : (
              <IsmSectorConstituentsSection
                constituents={constituents}
                footer={<IsmConstituentsLocalBreadthFooter />}
                formatNum={formatNum}
              />
            )}
            <IsmDiagnosticsDrawerShell
              open={isDiagnosticsOpen}
              onClose={() => setIsDiagnosticsOpen(false)}
              sectorDisplayName={sectorDisplayName}
              daily={daily}
              totalCandidates={activeSnapshotDiagnostics.totalCandidates}
              marketCapSnapshotTimestamp={activeSnapshotDiagnostics.marketCapSnapshotTimestamp}
              addedCount={activeSnapshotDiagnostics.addedCount}
              removedCount={activeSnapshotDiagnostics.removedCount}
              unchangedCount={activeSnapshotDiagnostics.unchangedCount}
              previousDivisor={activeSnapshotDiagnostics.previousDivisor}
              newDivisor={activeSnapshotDiagnostics.newDivisor}
              divisorAdjustmentApplied={activeSnapshotDiagnostics.divisorAdjustmentApplied}
              topExclusionReasons={activeSnapshotDiagnostics.topExclusionReasons}
            />
          </IsmSectorDetailLocalProvider>
        )}
      </div>
    </div>
  );
}

function IsmRebalanceChangeSummary({
  addedCount,
  removedCount,
  unchangedCount,
  usingPreviousActiveSnapshot,
}: {
  addedCount: number | null;
  removedCount: number | null;
  unchangedCount: number | null;
  usingPreviousActiveSnapshot: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="mb-3" aria-label={t('ism.detail.diagnosticsRebalanceSummaryTitle')}>
      <Card variant="outlined" padding="sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm">
          <span className="text-gray-700 dark:text-gray-300">
            {t('ism.detail.diagnosticsAddedLabel')}: <span className="font-semibold tabular-nums">{formatNum(addedCount, 0)}</span>
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {t('ism.detail.diagnosticsRemovedLabel')}: <span className="font-semibold tabular-nums">{formatNum(removedCount, 0)}</span>
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {t('ism.detail.diagnosticsUnchangedLabel')}:{' '}
            <span className="font-semibold tabular-nums">{formatNum(unchangedCount, 0)}</span>
          </span>
        </div>
        {usingPreviousActiveSnapshot && (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">{t('ism.detail.usingPreviousRebalanceSnapshot')}</p>
        )}
      </Card>
    </section>
  );
}

function IsmDiagnosticsDrawerShell({
  open,
  onClose,
  sectorDisplayName,
  daily,
  totalCandidates,
  marketCapSnapshotTimestamp,
  addedCount,
  removedCount,
  unchangedCount,
  previousDivisor,
  newDivisor,
  divisorAdjustmentApplied,
  topExclusionReasons,
}: {
  open: boolean;
  onClose: () => void;
  sectorDisplayName: string;
  daily: ParsedSectorIndexDaily;
  totalCandidates: number | null;
  marketCapSnapshotTimestamp: number | null;
  addedCount: number | null;
  removedCount: number | null;
  unchangedCount: number | null;
  previousDivisor: number | null;
  newDivisor: number | null;
  divisorAdjustmentApplied: boolean | null;
  topExclusionReasons: Array<{ reason: string; count: number }>;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const coverageText =
    daily.coverage_status == null
      ? t('ism.detail.coveragePending')
      : daily.coverage_status === 'full'
        ? t('ism.detail.coverageFull')
        : daily.coverage_status === 'limited'
          ? t('ism.detail.coverageLimited')
          : t('ism.detail.coverageDataBuilding');
  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 border-l border-secondary-200 dark:border-secondary-700 shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('ism.detail.diagnosticsTitle')}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('ism.detail.diagnosticsTitle')}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
        <div className="px-4 pt-2 text-xs text-gray-500 dark:text-gray-400">{t('ism.detail.diagnosticsCloseHint')}</div>
        <div className="p-4 overflow-y-auto max-h-[calc(100%-52px)]">
          <div className="space-y-4">
            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsSnapshotInfoTitle')}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <DiagnosticsLine label={t('ism.detail.diagnosticsSectorLabel')} value={sectorDisplayName} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsActiveRebalanceDateLabel')} value={daily.active_rebalance_date ?? '—'} />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsRebalanceTimestampLabel')}
                  value={formatTimestamp(daily.active_rebalance_timestamp)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsLatestPriceUpdateTimestampLabel')}
                  value={formatTimestamp(daily.price_snapshot_timestamp)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsLatestFxUpdateTimestampLabel')}
                  value={formatTimestamp(daily.fx_snapshot_timestamp)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsLatestMarketCapSnapshotTimestampLabel')}
                  value={formatTimestamp(marketCapSnapshotTimestamp)}
                />
              </dl>
            </section>

            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsUniverseHealthTitle')}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <DiagnosticsLine label={t('ism.detail.diagnosticsTotalCandidatesLabel')} value={formatNum(totalCandidates, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsQualifiedLabel')} value={formatNum(daily.qualified_count, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsExcludedLabel')} value={formatNum(daily.excluded_count, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsNeedsReviewLabel')} value={formatNum(daily.needs_review_count, 0)} />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsActiveConstituentsCountLabel')}
                  value={formatNum(daily.constituent_count_active, 0)}
                />
              </dl>
            </section>

            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsCoverageTitle')}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <DiagnosticsLine label={t('ism.detail.diagnosticsCoverageStatusLabel')} value={coverageText} />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsQualifiedVsTargetLabel')}
                  value={`${formatNum(daily.qualified_count, 0)} / ${ISM_FULL_COVERAGE_TARGET}`}
                />
              </dl>
            </section>

            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsRebalanceSummaryTitle')}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <DiagnosticsLine label={t('ism.detail.diagnosticsAddedLabel')} value={formatNum(addedCount, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsRemovedLabel')} value={formatNum(removedCount, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsUnchangedLabel')} value={formatNum(unchangedCount, 0)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsPreviousDivisorLabel')} value={formatNum(previousDivisor, 6)} />
                <DiagnosticsLine label={t('ism.detail.diagnosticsNewDivisorLabel')} value={formatNum(newDivisor, 6)} />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsDivisorAdjustmentAppliedLabel')}
                  value={formatBool(divisorAdjustmentApplied, t)}
                />
              </dl>
            </section>

            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsRegimeInputsTitle')}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsRsAboveRs252Label')}
                  value={rsStatusText(t, daily.rs_above_rs_ma_252)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsRs252RisingLabel')}
                  value={slopeText(t, daily.rs_ma_252_rising)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsSectorAboveSma200Label')}
                  value={rsStatusText(t, daily.sector_above_sma_200)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsSectorSma200RisingLabel')}
                  value={slopeText(t, daily.sector_sma_200_rising)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsWeightedBreadthLabel')}
                  value={formatPct(daily.weighted_breadth_pct)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsBreadthThresholdLabel')}
                  value={formatPct(daily.weighted_breadth_threshold)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsOfficialRegimeLabel')}
                  value={daily.regime == null ? t('ism.detail.na') : t(`ism.overview.regime.${daily.regime}`)}
                />
                <DiagnosticsLine
                  label={t('ism.detail.diagnosticsOfficialStatusNoteLabel')}
                  value={daily.status_note ?? '—'}
                />
              </dl>
            </section>

            <section className="rounded-md border border-secondary-200 dark:border-secondary-700 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {t('ism.detail.diagnosticsTopExclusionReasonsTitle')}
              </h3>
              {topExclusionReasons.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
              ) : (
                <dl className="mt-2 space-y-1 text-sm">
                  {topExclusionReasons.map((r) => (
                    <DiagnosticsLine key={r.reason} label={r.reason} value={formatNum(r.count, 0)} />
                  ))}
                </dl>
              )}
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DiagnosticsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-gray-100 tabular-nums">{value}</dd>
    </div>
  );
}

function SectorDetailHeader({
  sectorDisplayName,
  daily,
  missingDailyDoc,
  buildingUx,
  docTradeDate,
  loading,
}: {
  sectorDisplayName: string;
  daily: ParsedSectorIndexDaily | null;
  missingDailyDoc: boolean;
  buildingUx: boolean;
  docTradeDate: string | null;
  loading: boolean;
}) {
  const { t } = useTranslation();

  const coverageKey =
    missingDailyDoc || daily == null || daily.coverage_status == null
      ? 'ism.detail.coveragePending'
      : daily.coverage_status === 'full'
        ? 'ism.detail.coverageFull'
        : daily.coverage_status === 'limited'
          ? 'ism.detail.coverageLimited'
          : 'ism.detail.coverageDataBuilding';
  const coverageVariant: ComponentProps<typeof Badge>['variant'] =
    missingDailyDoc || daily == null || daily.coverage_status == null
      ? 'default'
      : daily.coverage_status === 'full'
        ? 'success'
        : daily.coverage_status === 'limited'
          ? 'warning'
          : 'info';

  const sizingKey =
    daily == null || daily.allowed_sizing == null
      ? 'ism.detail.sizingUnknown'
      : daily.allowed_sizing === 'core_allowed'
        ? 'ism.detail.sizingCore'
        : daily.allowed_sizing === 'probe_only'
          ? 'ism.detail.sizingProbe'
          : 'ism.detail.sizingNoNew';

  return (
    <header className="flex-shrink-0 mb-4 border-b border-secondary-200 dark:border-secondary-700 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-black dark:text-white">{sectorDisplayName}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {loading
              ? t('common.loading')
              : docTradeDate
                ? t('ism.detail.headerTradeDate', { date: docTradeDate })
                : t('ism.detail.headerNoTradeDate')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {buildingUx ? (
            <>
              <Badge variant="info" size="sm">
                {t('ism.detail.dataBuildingBadge')}
              </Badge>
              <Badge variant="default" size="sm">
                {t('ism.detail.regimeNotAvailableBadge')}
              </Badge>
            </>
          ) : (
            <Badge
              variant={
                daily?.regime === 'strong'
                  ? 'success'
                  : daily?.regime === 'weak'
                    ? 'error'
                    : daily?.regime === 'transition'
                      ? 'warning'
                      : 'default'
              }
              size="sm"
            >
              {daily?.regime == null ? t('ism.detail.regimeUnknown') : t(`ism.overview.regime.${daily.regime}`)}
            </Badge>
          )}
          <Badge variant="default" size="sm">
            {missingDailyDoc ? t('ism.detail.sizingUnknown') : t(sizingKey)}
          </Badge>
          <Badge variant="default" size="sm">
            {t('ism.detail.statusNoteShort')}:{' '}
            {missingDailyDoc || !daily?.status_note ? '—' : daily.status_note}
          </Badge>
          <Badge variant={coverageVariant} size="sm">
            {t('ism.detail.coverageLabel')}: {t(coverageKey)}
          </Badge>
        </div>
      </div>
    </header>
  );
}

function SectorDetailStatusBox({ daily, buildingUx }: { daily: ParsedSectorIndexDaily; buildingUx: boolean }) {
  const { t } = useTranslation();
  const { isCustomActive, localSnapshot, committedLocalParams } = useIsmSectorDetailLocal();
  const useLocalMetrics = !buildingUx && isCustomActive;

  const coverageKey =
    daily.coverage_status === 'full'
      ? 'ism.detail.coverageFull'
      : daily.coverage_status === 'limited'
        ? 'ism.detail.coverageLimited'
        : daily.coverage_status === 'data_building'
          ? 'ism.detail.coverageDataBuilding'
          : 'ism.detail.coveragePending';

  const sizingKey =
    daily.allowed_sizing == null
      ? 'ism.detail.sizingUnknown'
      : daily.allowed_sizing === 'core_allowed'
        ? 'ism.detail.sizingCore'
        : daily.allowed_sizing === 'probe_only'
          ? 'ism.detail.sizingProbe'
          : 'ism.detail.sizingNoNew';

  return (
    <Card variant="elevated" padding="md" className="mb-4">
      <CardHeader title={t('ism.detail.statusBoxTitle')} />
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {buildingUx ? (
          <>
            <StatusLine label={t('ism.detail.fieldRegime')} value={t('ism.detail.dataBuildingBadge')} />
            <StatusLine label={t('ism.detail.fieldRegimeOfficial')} value={t('ism.detail.regimeNotAvailableYet')} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldSizing')} hint={t('ism.detail.tipAllowedSizing')} />}
              value={t(sizingKey)}
            />
            <StatusLine label={t('ism.detail.fieldStatus')} value={daily.status_note ?? t('ism.detail.na')} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldRsVsMa')} hint={t('ism.detail.tipRs')} />}
              value={`${rsStatusText(t, daily.rs_above_rs_ma_252)} (${t('ism.detail.vsMa252')})`}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldRs252Slope')} hint={t('ism.detail.tipRs252Slope')} />}
              value={slopeText(t, daily.rs_ma_252_rising)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldSectorVsSma')} hint={t('ism.detail.tipAbsTrend')} />}
              value={`${rsStatusText(t, daily.sector_above_sma_200)} (${t('ism.detail.vsSma200')})`}
            />
            <StatusLine label={t('ism.detail.fieldSectorSmaSlope')} value={slopeText(t, daily.sector_sma_200_rising)} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldBreadthPct')} hint={t('ism.detail.tipWeightedBreadth')} />}
              value={`${formatPct(daily.weighted_breadth_pct)} · ${breadthCharacterText(t, daily.breadth_confirmed)}`}
            />
            <StatusLine label={t('ism.detail.fieldBreadthVerdict')} value={breadthVerdictText(t, daily.breadth_confirmed)} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldCoverage')} hint={t('ism.detail.tipCoverage')} />}
              value={t(coverageKey)}
            />
          </>
        ) : useLocalMetrics ? (
          <>
            <StatusLine
              label={t('ism.detail.fieldRegime')}
              value={daily.regime == null ? t('ism.detail.na') : t(`ism.overview.regime.${daily.regime}`)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldSizing')} hint={t('ism.detail.tipAllowedSizing')} />}
              value={t(sizingKey)}
            />
            <StatusLine label={t('ism.detail.fieldStatus')} value={daily.status_note ?? t('ism.detail.na')} />
            <StatusLine
              label={
                <StatusLabelWithHint
                  label={t('ism.detail.fieldRsVsMaLocal', { n: committedLocalParams.rsMaLength })}
                  hint={t('ism.detail.tipRs')}
                />
              }
              value={`${rsStatusText(t, localSnapshot.rsAboveMa)} (${t('ism.detail.vsMaN', { n: committedLocalParams.rsMaLength })})`}
            />
            <StatusLine
              label={
                <StatusLabelWithHint
                  label={t('ism.detail.fieldRsMaSlopeLocal', { n: committedLocalParams.rsMaLength })}
                  hint={t('ism.detail.tipRs252Slope')}
                />
              }
              value={slopeText(t, localSnapshot.rsMaRising)}
            />
            <StatusLine
              label={
                <StatusLabelWithHint
                  label={t('ism.detail.fieldSectorVsSmaLocal', { n: committedLocalParams.sectorSmaLength })}
                  hint={t('ism.detail.tipAbsTrend')}
                />
              }
              value={`${rsStatusText(t, localSnapshot.sectorAboveSma)} (${t('ism.detail.vsSmaN', { n: committedLocalParams.sectorSmaLength })})`}
            />
            <StatusLine
              label={t('ism.detail.fieldSectorSmaSlopeLocal', { n: committedLocalParams.sectorSmaLength })}
              value={slopeText(t, localSnapshot.sectorSmaRising)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldBreadthPct')} hint={t('ism.detail.tipWeightedBreadth')} />}
              value={`${formatPct(daily.weighted_breadth_pct)} · ${breadthCharacterText(t, localSnapshot.breadthConfirmedLocal)}`}
            />
            <StatusLine
              label={t('ism.detail.fieldBreadthVerdictLocal', { threshold: committedLocalParams.breadthThreshold })}
              value={breadthVerdictText(t, localSnapshot.breadthConfirmedLocal)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldCoverage')} hint={t('ism.detail.tipCoverage')} />}
              value={t(coverageKey)}
            />
          </>
        ) : (
          <>
            <StatusLine
              label={t('ism.detail.fieldRegime')}
              value={daily.regime == null ? t('ism.detail.na') : t(`ism.overview.regime.${daily.regime}`)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldSizing')} hint={t('ism.detail.tipAllowedSizing')} />}
              value={t(sizingKey)}
            />
            <StatusLine label={t('ism.detail.fieldStatus')} value={daily.status_note ?? t('ism.detail.na')} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldRsVsMa')} hint={t('ism.detail.tipRs')} />}
              value={`${rsStatusText(t, daily.rs_above_rs_ma_252)} (${t('ism.detail.vsMa252')})`}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldRs252Slope')} hint={t('ism.detail.tipRs252Slope')} />}
              value={slopeText(t, daily.rs_ma_252_rising)}
            />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldSectorVsSma')} hint={t('ism.detail.tipAbsTrend')} />}
              value={`${rsStatusText(t, daily.sector_above_sma_200)} (${t('ism.detail.vsSma200')})`}
            />
            <StatusLine label={t('ism.detail.fieldSectorSmaSlope')} value={slopeText(t, daily.sector_sma_200_rising)} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldBreadthPct')} hint={t('ism.detail.tipWeightedBreadth')} />}
              value={`${formatPct(daily.weighted_breadth_pct)} · ${breadthCharacterText(t, daily.breadth_confirmed)}`}
            />
            <StatusLine label={t('ism.detail.fieldBreadthVerdict')} value={breadthVerdictText(t, daily.breadth_confirmed)} />
            <StatusLine
              label={<StatusLabelWithHint label={t('ism.detail.fieldCoverage')} hint={t('ism.detail.tipCoverage')} />}
              value={t(coverageKey)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectorDetailStatusBoxPlaceholder() {
  const { t } = useTranslation();
  return (
    <Card variant="elevated" padding="md" className="mb-4">
      <CardHeader title={t('ism.detail.statusBoxTitle')} />
      <CardContent className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
        <p>{t('ism.detail.awaitingDailyDoc')}</p>
        <p>{t('ism.detail.regimeNotAvailableYet')}</p>
        <p>{t('ism.detail.coverageTooLow')}</p>
      </CardContent>
    </Card>
  );
}

function StatusLine({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{value}</div>
    </div>
  );
}

function StatusLabelWithHint({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="relative inline-flex">
        <button
          type="button"
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-400 text-[9px] leading-none text-gray-600 dark:text-gray-300 dark:border-gray-500"
          title={hint}
          aria-label={hint}
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setOpen(false)}
        >
          i
        </button>
        {open && (
          <span
            role="tooltip"
            className="absolute left-0 top-5 z-20 w-52 rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-[11px] normal-case tracking-normal text-gray-700 dark:text-gray-200 shadow"
          >
            {hint}
          </span>
        )}
      </span>
    </span>
  );
}
