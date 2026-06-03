import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useUserRole } from '../../hooks/useUserRole';
import { useIsmIngestData } from '../../hooks/useIsmIngestData';
import { useIsmDebugSync } from '../../hooks/useIsmDebugSync';
import { buildIsmSectorUniverseFromIngest, useIsmSectorOverviewData } from '../../hooks/useIsmSectorOverviewData';
import type { IsmOverviewSectorRow } from '../../types/ismSectorOverview';
import ISMPostureOverview from '../ism/ISMPostureOverview';
import ISMPostureSectorDetail from '../ism/ISMPostureSectorDetail';
import Button from '../ui/Button';

export default function ISMPostureViewInner() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { isAdmin } = useUserRole();
  const {
    ingestRows,
    loading: ingestLoading,
    error: ingestError,
    lastUpdated: ingestLastUpdated,
    refetch: refetchIngest,
  } = useIsmIngestData();
  const universe = useMemo(() => buildIsmSectorUniverseFromIngest(ingestRows), [ingestRows]);
  const { sectors, firestoreLoading, firestoreError } = useIsmSectorOverviewData(ingestRows, ingestLoading);
  const {
    running: debugRunning,
    report: debugReport,
    error: debugError,
    runDebugSync,
  } = useIsmDebugSync(currentUser, ingestRows);
  const [detailSector, setDetailSector] = useState<{ sectorId: string; displayName: string } | null>(null);

  const handleOpenSector = useCallback((row: IsmOverviewSectorRow) => {
    setDetailSector({ sectorId: row.sectorId, displayName: row.sectorDisplayName });
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setDetailSector(null);
  }, []);

  if (!currentUser) {
    return (
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-8 px-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.pleaseLogin')}</p>
      </div>
    );
  }

  if (detailSector) {
    return (
      <ISMPostureSectorDetail
        user={currentUser}
        sectorId={detailSector.sectorId}
        sectorDisplayName={detailSector.displayName}
        ingestRows={ingestRows}
        onBack={handleBackFromDetail}
      />
    );
  }

  return (
    <>
      {isAdmin && (
        <section className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
          <div className="max-w-7xl mx-auto rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runDebugSync()}
                disabled={debugRunning || ingestLoading || !currentUser}
              >
                {debugRunning ? 'Running ISM debug sync...' : 'Run ISM debug sync'}
              </Button>
              {debugError && <span className="text-xs text-error-600 dark:text-error-400">{debugError}</span>}
            </div>
            {debugReport && (
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-200 space-y-1">
                <p>
                  <strong>Bootstrap:</strong> iterations={debugReport.bootstrapIterations}, providerApiCalls=
                  {debugReport.bootstrapProviderApiCalls}, firestoreChunks=
                  {debugReport.bootstrapFirestoreCacheChunks}, stop={debugReport.bootstrapStopReason}
                </p>
                <p>
                  <strong>API keys (ISM / EODHD):</strong> eodhd={String(debugReport.apiKeysStatus.eodhd)}
                </p>
                <p>
                  <strong>Mining:</strong> rows={debugReport.mining.dashboardRows}, symbolId=
                  {debugReport.mining.symbolIdReady}, currency={debugReport.mining.withCurrency}, market_cap_usd=
                  {debugReport.mining.withMarketCapUsd}, history&gt;0=
                  {debugReport.mining.withHistoryDaysAvailable}, history[min/med/max]=
                  {debugReport.mining.historyDaysMin}/{debugReport.mining.historyDaysMedian}/
                  {debugReport.mining.historyDaysMax}, latest_price_date=
                  {debugReport.mining.withLatestPriceDate}, sufficient_history=
                  {debugReport.mining.withSufficientHistory}, data_ready={debugReport.mining.dataReady}, qualified=
                  {debugReport.mining.qualified}, weekly={String(debugReport.mining.weeklySnapshotCreated)}, daily=
                  {String(debugReport.mining.dailyDocCreated)}
                </p>
                {debugReport.steps.map((s) => (
                  <p key={s.step}>
                    [{s.status}] {s.step}: {s.detail}
                  </p>
                ))}
                {debugReport.miningSymbolTraces.map((trace) => (
                  <div key={trace.symbolId} className="pt-1 border-t border-amber-200/70 dark:border-amber-800/70">
                    <p>
                      <strong>Mining trace:</strong> {trace.companyName} | {trace.tickerRaw} | {trace.symbolId}
                    </p>
                    <p>provider_order={trace.providerAttemptOrder.join(' -> ')}</p>
                    <p>
                      state_before_after history={trace.beforeHistoryDaysAvailable}/{trace.afterHistoryDaysAvailable},
                      latest_price_date={trace.beforeLatestPriceDate ?? 'null'}/{trace.afterLatestPriceDate ?? 'null'}
                    </p>
                    {trace.attempts.map((a, idx) => (
                      <p key={`${trace.symbolId}-${idx}`}>
                        attempt provider={a.provider}, translated={a.translatedSymbol}, keyIndex=
                        {a.keyIndex == null ? 'n/a' : a.keyIndex}, result={a.resultType}, reason={a.reason},
                        points={a.dataPoints}, first={a.firstDate ?? 'null'}, last={a.lastDate ?? 'null'}
                      </p>
                    ))}
                    <p>first_stop={trace.firstStop}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      <section className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetchIngest()}
            disabled={ingestLoading}
          >
            {ingestLoading ? t('ism.posture.refreshingSheetData') : t('ism.posture.refreshSheetData')}
          </Button>
          {ingestLastUpdated && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('ism.posture.lastSheetSnapshot', {
                time: ingestLastUpdated.toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </span>
          )}
        </div>
      </section>
      <ISMPostureOverview
        sectors={sectors}
        expectedSectorCount={universe.length}
        ingestLoading={ingestLoading}
        firestoreLoading={firestoreLoading}
        firestoreError={firestoreError}
        ingestError={ingestError}
        onOpenSector={handleOpenSector}
      />
    </>
  );
}
