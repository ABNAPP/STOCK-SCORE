import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import type { IsmConstituentTableRow } from '../../hooks/useIsmSectorDetailData';
import { isoRangeForChartYears } from '../../hooks/useIsmSectorDetailChartData';
import { useIsmSectorStockHistoryMaps, type StockPick } from '../../hooks/useIsmSectorStockHistoryMaps';
import { attachStockColumns, type IsmSectorChartPoint, type IsmSectorChartRow } from './ismSectorChartModel';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { ISM_MAX_SELECTED_STOCKS } from '../../config/ismPostureDefaults';
import { useIsmSectorDetailLocal, type ChartLayout } from './IsmSectorDetailLocalContext';

const STOCK_COLORS = ['#f97316', '#a855f7', '#0d9488'];

type Props = {
  constituents: IsmConstituentTableRow[];
};

function SegmentedGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-[5.5rem]">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <div className="inline-flex rounded-md border border-secondary-300 dark:border-secondary-600 overflow-hidden divide-x divide-secondary-200 dark:divide-secondary-700 bg-white dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

export default function IsmSectorDetailChart({ constituents }: Props) {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const tickFill = isDarkMode ? '#e5e7eb' : '#374151';
  const gridStroke = isDarkMode ? '#374151' : '#e5e7eb';

  const {
    chartView: view,
    setChartView: setView,
    chartLayout: layout,
    setChartLayout: setLayout,
    chartSeries: series,
    setChartSeries: setSeries,
    chartYears: years,
    setChartYears: setYears,
    showGrid,
    setShowGrid,
    stockIds,
    setStockIds,
    points,
    enrichedRows,
    chartLoading: loading,
    chartError: error,
    refetchChart: refetch,
    isCustomActive,
  } = useIsmSectorDetailLocal();

  const { fromIso, toIso } = useMemo(() => isoRangeForChartYears(years), [years]);
  const basePoints = isCustomActive ? enrichedRows : points;

  const stockPicks: StockPick[] = useMemo(
    () =>
      stockIds
        .map((id) => {
          const c = constituents.find((x) => x.symbol_id === id);
          return c ? { symbolId: id, tickerRaw: c.ticker_raw } : null;
        })
        .filter((x): x is StockPick => x != null),
    [stockIds, constituents]
  );
  const activeConstituentById = useMemo(() => new Map(constituents.map((c) => [c.symbol_id, c])), [constituents]);

  const needStockHistory =
    stockPicks.length > 0 && (view === 'performance' || (view === 'technical' && layout === 'single_stock'));
  const { closeBySymbolId, loading: stockLoading, error: stockError } = useIsmSectorStockHistoryMaps(
    stockPicks,
    fromIso,
    toIso,
    needStockHistory
  );

  const chartRows: IsmSectorChartRow[] = useMemo(() => {
    const attachStocks =
      view === 'performance' || (view === 'technical' && layout === 'single_stock' && stockPicks.length > 0);
    if (!attachStocks || stockPicks.length === 0) {
      return basePoints.map((p) => ({ ...p } as IsmSectorChartRow));
    }
    const stocks = stockPicks.map((p) => ({
      symbolId: p.symbolId,
      closeByDate: closeBySymbolId.get(p.symbolId) ?? new Map<string, number>(),
    }));
    return attachStockColumns(basePoints as IsmSectorChartPoint[], stocks);
  }, [basePoints, stockPicks, closeBySymbolId, view, layout]);

  const toggleStock = useCallback((id: string) => {
    setStockIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= ISM_MAX_SELECTED_STOCKS) return prev;
      return [...prev, id];
    });
  }, []);

  const removeSelectedStock = useCallback((id: string) => {
    setStockIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const layoutEffective: ChartLayout = view === 'performance' ? 'single' : layout;

  const chartBusy = loading || (needStockHistory && stockLoading);

  return (
    <section className="mt-4 mb-4 space-y-3" aria-label={t('ism.detail.chartAria')}>
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-gray-800">
        <SegmentedGroup label={t('ism.chart.groupView')}>
          <SegBtn active={view === 'technical'} onClick={() => setView('technical')}>
            {t('ism.chart.viewTechnical')}
          </SegBtn>
          <SegBtn active={view === 'performance'} onClick={() => setView('performance')}>
            {t('ism.chart.viewPerformance')}
          </SegBtn>
        </SegmentedGroup>

        {view === 'technical' && (
          <SegmentedGroup label={t('ism.chart.groupLayout')}>
            <SegBtn active={layout === 'multi'} onClick={() => setLayout('multi')}>
              {t('ism.chart.layoutMulti')}
            </SegBtn>
            <SegBtn active={layout === 'single'} onClick={() => setLayout('single')}>
              {t('ism.chart.layoutSingle')}
            </SegBtn>
            <SegBtn active={layout === 'single_stock'} onClick={() => setLayout('single_stock')}>
              {t('ism.chart.layoutSingleStock')}
            </SegBtn>
          </SegmentedGroup>
        )}

        {view === 'technical' && (
          <div className="flex flex-col gap-1 min-w-[10rem]">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('ism.chart.groupSeries')}
            </span>
            <div className="flex flex-wrap gap-2 text-xs text-gray-700 dark:text-gray-200">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={series.sectorIndex}
                  onChange={() => setSeries((s) => ({ ...s, sectorIndex: !s.sectorIndex }))}
                />
                {t('ism.chart.seriesSectorIndex')}
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={series.rs} onChange={() => setSeries((s) => ({ ...s, rs: !s.rs }))} />
                {t('ism.chart.seriesRs')}
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={series.histogram}
                  onChange={() => setSeries((s) => ({ ...s, histogram: !s.histogram }))}
                />
                {t('ism.chart.seriesHistogram')}
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-[8rem] flex-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('ism.chart.groupStock')}
          </span>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto text-xs">
            {constituents.length === 0 ? (
              <span className="text-gray-500">{t('ism.chart.noConstituentsForStock')}</span>
            ) : (
              constituents.map((c) => (
                <label key={c.symbol_id} className="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={stockIds.includes(c.symbol_id)}
                    onChange={() => toggleStock(c.symbol_id)}
                  />
                  <span className="font-mono">{c.ticker_raw}</span>
                </label>
              ))
            )}
          </div>
          {stockIds.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
              {stockIds.map((id) => {
                const c = activeConstituentById.get(id);
                const isActive = !!c;
                const label = c?.ticker_raw ?? id.slice(0, 8);
                return (
                  <span
                    key={`selected-${id}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                      isActive
                        ? 'border-secondary-300 dark:border-secondary-600 text-gray-700 dark:text-gray-200'
                        : 'border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                    }`}
                    title={isActive ? undefined : t('ism.chart.notActiveHint')}
                  >
                    <span className="font-mono">{label}</span>
                    {!isActive && (
                      <span className="uppercase tracking-wide text-[10px] font-semibold">{t('ism.chart.notActiveBadge')}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSelectedStock(id)}
                      className="ml-0.5 text-[10px] leading-none opacity-70 hover:opacity-100"
                      aria-label={t('common.close')}
                      title={t('common.close')}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <details className="relative min-w-[8rem]">
          <summary className="cursor-pointer list-none text-xs font-medium text-primary-600 dark:text-primary-400 py-1.5">
            {t('ism.chart.groupParameters')} ▾
          </summary>
          <div className="absolute left-0 z-20 mt-1 min-w-[12rem] rounded-md border border-secondary-200 dark:border-secondary-600 bg-white dark:bg-gray-900 p-3 shadow-lg text-xs space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showGrid} onChange={() => setShowGrid((g) => !g)} />
              {t('ism.chart.paramShowGrid')}
            </label>
          </div>
        </details>

        <SegmentedGroup label={t('ism.chart.groupTimeframe')}>
          {([1, 2, 3, 4, 5] as const).map((y) => (
            <SegBtn key={y} active={years === y} onClick={() => setYears(y)}>
              {t(`ism.chart.tf${y}`)}
            </SegBtn>
          ))}
        </SegmentedGroup>

        <button
          type="button"
          className="text-xs font-medium text-primary-600 dark:text-primary-400 ml-auto self-end mb-0.5"
          onClick={() => void refetch()}
        >
          {t('ism.chart.reloadSeries')}
        </button>
      </div>

      {(error || stockError) && (
        <p className="text-xs text-error-600 dark:text-error-400" role="alert">
          {error ?? stockError}
        </p>
      )}

      <Card variant="outlined" padding="md" className="min-h-[240px]">
        <CardHeader title={view === 'technical' ? t('ism.chart.cardTechnical') : t('ism.chart.cardPerformance')} />
        <CardContent className="pt-2">
          {chartBusy && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('ism.chart.loading')}</p>
          )}
          {!chartBusy && chartRows.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ism.chart.emptySeries')}</p>
          )}
          {!chartBusy && chartRows.length > 0 && view === 'performance' && (
            <PerformanceChart
              rows={chartRows}
              stockIds={stockIds}
              constituents={constituents}
              showGrid={showGrid}
              tickFill={tickFill}
              gridStroke={gridStroke}
              t={t}
            />
          )}
          {!chartBusy && chartRows.length > 0 && view === 'technical' && layoutEffective === 'multi' && (
            <TechnicalMultiChart
              rows={chartRows}
              series={series}
              showGrid={showGrid}
              tickFill={tickFill}
              gridStroke={gridStroke}
              histogramDataKey={isCustomActive ? 'histogramLocal' : 'histogram'}
              showLocalOverlays={isCustomActive}
              t={t}
            />
          )}
          {!chartBusy && chartRows.length > 0 && view === 'technical' && layoutEffective !== 'multi' && (
            <TechnicalSingleStack
              rows={chartRows}
              series={series}
              layout={layout}
              stockIds={stockIds}
              constituents={constituents}
              showGrid={showGrid}
              tickFill={tickFill}
              gridStroke={gridStroke}
              colors={STOCK_COLORS}
              histogramDataKey={isCustomActive ? 'histogramLocal' : 'histogram'}
              showLocalOverlays={isCustomActive}
              t={t}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-secondary-200 dark:border-secondary-600 bg-white dark:bg-gray-900 p-2 text-xs shadow">
      <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={`${p.name ?? i}`} className="text-gray-600 dark:text-gray-300">
          <span style={{ color: p.color }}>{p.name}</span>:{' '}
          {p.value == null || !Number.isFinite(p.value) ? '—' : Number(p.value).toFixed(4)}
        </div>
      ))}
    </div>
  );
}

function TechnicalMultiChart({
  rows,
  series,
  showGrid,
  tickFill,
  gridStroke,
  histogramDataKey,
  showLocalOverlays,
  t,
}: {
  rows: IsmSectorChartRow[];
  series: { sectorIndex: boolean; rs: boolean; histogram: boolean };
  showGrid: boolean;
  tickFill: string;
  gridStroke: string;
  histogramDataKey: 'histogram' | 'histogramLocal';
  showLocalOverlays: boolean;
  t: (k: string) => string;
}) {
  const h = 168;
  if (!series.sectorIndex && !series.rs && !series.histogram) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('ism.chart.noSeriesSelected')}</p>;
  }
  return (
    <div className="space-y-2">
      {series.sectorIndex && (
        <div className="h-[168px]">
          <h4 className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">{t('ism.chart.seriesSectorIndex')}</h4>
          <ResponsiveContainer width="100%" height={h}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sectorIndex" name={t('ism.chart.seriesSectorIndex')} stroke="#2563eb" dot={false} strokeWidth={2} connectNulls />
              {showLocalOverlays && (
                <Line
                  type="monotone"
                  dataKey="sectorSmaLocal"
                  name={t('ism.chart.seriesSectorSmaLocal')}
                  stroke="#93c5fd"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {series.rs && (
        <div className="h-[168px]">
          <h4 className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">{t('ism.chart.seriesRs')}</h4>
          <ResponsiveContainer width="100%" height={h}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="rs" name={t('ism.chart.seriesRs')} stroke="#16a34a" dot={false} strokeWidth={2} connectNulls />
              {showLocalOverlays && (
                <Line
                  type="monotone"
                  dataKey="rsMaLocal"
                  name={t('ism.chart.seriesRsMaLocal')}
                  stroke="#86efac"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {series.histogram && (
        <div className="h-[168px]">
          <h4 className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">{t('ism.chart.seriesHistogram')}</h4>
          <ResponsiveContainer width="100%" height={h}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey={histogramDataKey}
                name={histogramDataKey === 'histogramLocal' ? t('ism.chart.seriesHistogramLocal') : t('ism.chart.seriesHistogram')}
                stroke="#ca8a04"
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TechnicalSingleStack({
  rows,
  series,
  layout,
  stockIds,
  constituents,
  showGrid,
  tickFill,
  gridStroke,
  colors,
  histogramDataKey,
  showLocalOverlays,
  t,
}: {
  rows: IsmSectorChartRow[];
  series: { sectorIndex: boolean; rs: boolean; histogram: boolean };
  layout: ChartLayout;
  stockIds: string[];
  constituents: IsmConstituentTableRow[];
  showGrid: boolean;
  tickFill: string;
  gridStroke: string;
  colors: string[];
  histogramDataKey: 'histogram' | 'histogramLocal';
  showLocalOverlays: boolean;
  t: (k: string) => string;
}) {
  const showStocks = layout === 'single_stock' && stockIds.length > 0;
  const showTopChart = series.sectorIndex || series.rs || showStocks;
  if (!series.sectorIndex && !series.rs && !series.histogram) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('ism.chart.noSeriesSelected')}</p>;
  }
  return (
    <div className="space-y-2">
      {showTopChart && (
        <div className="h-[220px]">
          <h4 className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
            {showStocks ? t('ism.chart.singleBaseTitle') : t('ism.chart.singleTechTitle')}
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={rows} margin={{ top: 8, right: showStocks ? 8 : 48, left: 4, bottom: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={28} />
              {(() => {
                const dualAxis = series.rs && (series.sectorIndex || showStocks);
                if (!dualAxis && series.rs) {
                  return (
                    <>
                      <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={48} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="rs" name={t('ism.chart.seriesRs')} stroke="#16a34a" dot={false} strokeWidth={2} connectNulls />
                      {showLocalOverlays && (
                        <Line
                          type="monotone"
                          dataKey="rsMaLocal"
                          name={t('ism.chart.seriesRsMaLocal')}
                          stroke="#86efac"
                          dot={false}
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          connectNulls
                        />
                      )}
                    </>
                  );
                }
                return (
                  <>
                    <YAxis yAxisId="left" tick={{ fill: tickFill, fontSize: 10 }} width={48} domain={['auto', 'auto']} />
                    {series.rs && (
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: tickFill, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
                    )}
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {series.sectorIndex && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey={showStocks ? 'sectorBase100' : 'sectorIndex'}
                        name={showStocks ? t('ism.chart.sectorBase100') : t('ism.chart.seriesSectorIndex')}
                        stroke="#2563eb"
                        dot={false}
                        strokeWidth={2}
                        connectNulls
                      />
                    )}
                    {showLocalOverlays && series.sectorIndex && !showStocks && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="sectorSmaLocal"
                        name={t('ism.chart.seriesSectorSmaLocal')}
                        stroke="#93c5fd"
                        dot={false}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        connectNulls
                      />
                    )}
                    {showStocks &&
                      stockIds.map((id, i) => {
                        const label = constituents.find((c) => c.symbol_id === id)?.ticker_raw ?? id.slice(0, 8);
                        return (
                          <Line
                            key={id}
                            yAxisId="left"
                            type="monotone"
                            dataKey={`stockBase100_${id}`}
                            name={label}
                            stroke={colors[i % colors.length]}
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls
                          />
                        );
                      })}
                    {series.rs && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rs"
                        name={t('ism.chart.seriesRs')}
                        stroke="#16a34a"
                        dot={false}
                        strokeWidth={2}
                        connectNulls
                      />
                    )}
                    {showLocalOverlays && series.rs && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rsMaLocal"
                        name={t('ism.chart.seriesRsMaLocal')}
                        stroke="#86efac"
                        dot={false}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        connectNulls
                      />
                    )}
                  </>
                );
              })()}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {series.histogram && (
        <div className="h-[100px]">
          <h4 className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">{t('ism.chart.seriesHistogram')}</h4>
          <ResponsiveContainer width="100%" height={88}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
              <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={28} />
              <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={44} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey={histogramDataKey}
                name={histogramDataKey === 'histogramLocal' ? t('ism.chart.seriesHistogramLocal') : t('ism.chart.seriesHistogram')}
                stroke="#ca8a04"
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PerformanceChart({
  rows,
  stockIds,
  constituents,
  showGrid,
  tickFill,
  gridStroke,
  t,
}: {
  rows: IsmSectorChartRow[];
  stockIds: string[];
  constituents: IsmConstituentTableRow[];
  showGrid: boolean;
  tickFill: string;
  gridStroke: string;
  t: (k: string) => string;
}) {
  const colors = STOCK_COLORS;
  return (
    <div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">{t('ism.chart.performanceFootnote')}</p>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />}
            <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={28} />
            <YAxis tick={{ fill: tickFill, fontSize: 10 }} width={48} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="sectorBase100" name={t('ism.chart.sectorBase100')} stroke="#2563eb" dot={false} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="spyBase100" name={t('ism.chart.spyBase100')} stroke="#64748b" dot={false} strokeWidth={2} connectNulls />
            {stockIds.map((id, i) => {
              const tick = constituents.find((c) => c.symbol_id === id)?.ticker_raw ?? id.slice(0, 8);
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={`stockBase100_${id}`}
                  name={tick}
                  stroke={colors[i % colors.length]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
