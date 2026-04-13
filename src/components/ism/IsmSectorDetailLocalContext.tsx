import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ParsedSectorIndexDaily } from '../../services/ism/dailySector/readSectorIndexDaily';
import { useIsmSectorDetailChartData, type IsmChartTimeframeYears } from '../../hooks/useIsmSectorDetailChartData';
import type { IsmConstituentTableRow } from '../../hooks/useIsmSectorDetailData';
import type { IsmSectorChartPoint } from './ismSectorChartModel';
import {
  ISM_DETAIL_LOCAL_PARAM_DEFAULTS,
  clampLocalParams,
  localParamsEqual,
  type IsmLocalParamSettings,
} from './ismSectorLocalAnalysisDefaults';
import { computeLocalSeriesSnapshot, enrichPointsWithLocalSeries } from './ismSectorLocalCompute';
import { useIsmSectorBasketConstituentTableRows } from '../../hooks/useIsmSectorBasketConstituentTableRows';
import type { IsmBasketConstituentTableRow } from '../../types/ismBasketConstituentTableRow';

export type ChartView = 'technical' | 'performance';
export type ChartLayout = 'multi' | 'single' | 'single_stock';

export type ChartSeriesToggles = {
  sectorIndex: boolean;
  rs: boolean;
  histogram: boolean;
};

const DEFAULT_SERIES: ChartSeriesToggles = { sectorIndex: true, rs: true, histogram: true };

function seriesIsOfficialDefault(s: ChartSeriesToggles): boolean {
  return s.sectorIndex && s.rs && s.histogram;
}

function isOfficialChartChrome(
  view: ChartView,
  layout: ChartLayout,
  series: ChartSeriesToggles,
  years: IsmChartTimeframeYears
): boolean {
  return view === 'technical' && layout === 'multi' && seriesIsOfficialDefault(series) && years === 1;
}

type IsmSectorDetailLocalContextValue = {
  sectorId: string;
  /** Official headline doc (unchanged). */
  daily: ParsedSectorIndexDaily;
  constituents: IsmConstituentTableRow[];

  committedLocalParams: IsmLocalParamSettings;
  setCommittedLocalParams: (p: IsmLocalParamSettings) => void;
  applyDraftParams: (draft: IsmLocalParamSettings) => void;
  resetParamsToDefaultsInPanel: () => void;

  chartView: ChartView;
  setChartView: (v: ChartView) => void;
  chartLayout: ChartLayout;
  setChartLayout: (l: ChartLayout) => void;
  chartSeries: ChartSeriesToggles;
  setChartSeries: React.Dispatch<React.SetStateAction<ChartSeriesToggles>>;
  chartYears: IsmChartTimeframeYears;
  setChartYears: (y: IsmChartTimeframeYears) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;

  stockIds: string[];
  setStockIds: React.Dispatch<React.SetStateAction<string[]>>;

  points: IsmSectorChartPoint[];
  enrichedRows: ReturnType<typeof enrichPointsWithLocalSeries>;
  localSnapshot: ReturnType<typeof computeLocalSeriesSnapshot>;
  chartLoading: boolean;
  chartError: string | null;
  refetchChart: () => Promise<void>;

  isCustomActive: boolean;
  resetOfficialView: () => void;

  /** Prepared rows for the active weekly basket constituent table (no UI yet). */
  constituentBasketTableRows: IsmBasketConstituentTableRow[];
  constituentBasketTableRowsLoading: boolean;
  constituentBasketTableRowsError: string | null;
  refetchConstituentBasketTableRows: () => Promise<void>;
};

const Ctx = createContext<IsmSectorDetailLocalContextValue | null>(null);

export function useIsmSectorDetailLocal(): IsmSectorDetailLocalContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIsmSectorDetailLocal must be used within IsmSectorDetailLocalProvider');
  return v;
}

type ProviderProps = {
  sectorId: string;
  daily: ParsedSectorIndexDaily;
  constituents: IsmConstituentTableRow[];
  children: React.ReactNode;
};

export function IsmSectorDetailLocalProvider({ sectorId, daily, constituents, children }: ProviderProps) {
  const [committedLocalParams, setCommittedLocalParams] = useState<IsmLocalParamSettings>(ISM_DETAIL_LOCAL_PARAM_DEFAULTS);

  const [chartView, setChartView] = useState<ChartView>('technical');
  const [chartLayout, setChartLayout] = useState<ChartLayout>('multi');
  const [chartSeries, setChartSeries] = useState<ChartSeriesToggles>({ ...DEFAULT_SERIES });
  const [chartYears, setChartYears] = useState<IsmChartTimeframeYears>(1);
  const [showGrid, setShowGrid] = useState(true);
  const [stockIds, setStockIds] = useState<string[]>([]);

  const { points, loading: chartLoading, error: chartError, refetch: refetchChart } = useIsmSectorDetailChartData(
    sectorId,
    chartYears,
    true
  );

  const {
    constituentBasketTableRows,
    constituentBasketTableRowsLoading,
    constituentBasketTableRowsError,
    refetchConstituentBasketTableRows,
  } = useIsmSectorBasketConstituentTableRows({
    constituents,
    localParams: committedLocalParams,
    selectedSymbolIds: stockIds,
    enabled: constituents.length > 0,
  });

  const enrichedRows = useMemo(
    () => enrichPointsWithLocalSeries(points, committedLocalParams),
    [points, committedLocalParams]
  );

  const localSnapshot = useMemo(
    () =>
      computeLocalSeriesSnapshot(
        points,
        daily.weighted_breadth_pct,
        committedLocalParams
      ),
    [points, daily.weighted_breadth_pct, committedLocalParams]
  );

  const isCustomActive = useMemo(() => {
    const paramsCustom = !localParamsEqual(committedLocalParams, ISM_DETAIL_LOCAL_PARAM_DEFAULTS);
    const chromeCustom = !isOfficialChartChrome(chartView, chartLayout, chartSeries, chartYears);
    return paramsCustom || chromeCustom;
  }, [committedLocalParams, chartView, chartLayout, chartSeries, chartYears]);

  const applyDraftParams = useCallback((draft: IsmLocalParamSettings) => {
    setCommittedLocalParams(clampLocalParams(draft));
  }, []);

  const resetParamsToDefaultsInPanel = useCallback(() => {
    setCommittedLocalParams({ ...ISM_DETAIL_LOCAL_PARAM_DEFAULTS });
  }, []);

  const resetOfficialView = useCallback(() => {
    setChartView('technical');
    setChartLayout('multi');
    setChartSeries({ ...DEFAULT_SERIES });
    setChartYears(1);
    setCommittedLocalParams({ ...ISM_DETAIL_LOCAL_PARAM_DEFAULTS });
    void refetchChart();
  }, [refetchChart]);

  const value = useMemo<IsmSectorDetailLocalContextValue>(
    () => ({
      sectorId,
      daily,
      constituents,
      committedLocalParams,
      setCommittedLocalParams,
      applyDraftParams,
      resetParamsToDefaultsInPanel,
      chartView,
      setChartView,
      chartLayout,
      setChartLayout,
      chartSeries,
      setChartSeries,
      chartYears,
      setChartYears,
      showGrid,
      setShowGrid,
      stockIds,
      setStockIds,
      points,
      enrichedRows,
      localSnapshot,
      chartLoading,
      chartError,
      refetchChart,
      isCustomActive,
      resetOfficialView,
      constituentBasketTableRows,
      constituentBasketTableRowsLoading,
      constituentBasketTableRowsError,
      refetchConstituentBasketTableRows,
    }),
    [
      sectorId,
      daily,
      constituents,
      committedLocalParams,
      applyDraftParams,
      resetParamsToDefaultsInPanel,
      chartView,
      chartLayout,
      chartSeries,
      chartYears,
      showGrid,
      stockIds,
      points,
      enrichedRows,
      localSnapshot,
      chartLoading,
      chartError,
      refetchChart,
      isCustomActive,
      resetOfficialView,
      constituentBasketTableRows,
      constituentBasketTableRowsLoading,
      constituentBasketTableRowsError,
      refetchConstituentBasketTableRows,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { DEFAULT_SERIES, seriesIsOfficialDefault, isOfficialChartChrome };
