import { useMemo } from 'react';
import type { IsmConstituentTableRow } from './useIsmSectorDetailData';
import type { IsmLocalParamSettings } from '../components/ism/ismSectorLocalAnalysisDefaults';
import { isoRangeForChartYears, type IsmChartTimeframeYears } from './useIsmSectorDetailChartData';
import { useIsmSectorStockHistoryMaps } from './useIsmSectorStockHistoryMaps';
import { prepareIsmBasketConstituentTableRows } from '../services/ism/prepareIsmBasketConstituentTableRows';
import type { IsmBasketConstituentTableRow } from '../types/ismBasketConstituentTableRow';

const BASKET_HISTORY_YEARS: IsmChartTimeframeYears = 5;

export type UseIsmSectorBasketConstituentTableRowsArgs = {
  constituents: IsmConstituentTableRow[];
  localParams: IsmLocalParamSettings;
  selectedSymbolIds: readonly string[];
  enabled: boolean;
};

export type UseIsmSectorBasketConstituentTableRowsResult = {
  constituentBasketTableRows: IsmBasketConstituentTableRow[];
  constituentBasketTableRowsLoading: boolean;
  constituentBasketTableRowsError: string | null;
  refetchConstituentBasketTableRows: () => Promise<void>;
};

/**
 * Fetches daily closes for every active basket symbol and prepares sortable table rows
 * (weights from basket + prices; SMA/breadth columns respect local SMA length / slope lookback).
 */
export function useIsmSectorBasketConstituentTableRows(
  args: UseIsmSectorBasketConstituentTableRowsArgs
): UseIsmSectorBasketConstituentTableRowsResult {
  const { constituents, localParams, selectedSymbolIds, enabled } = args;

  const { fromIso, toIso } = useMemo(() => isoRangeForChartYears(BASKET_HISTORY_YEARS), []);

  const picks = useMemo(
    () => constituents.map((c) => ({ symbolId: c.symbol_id, tickerRaw: c.ticker_raw })),
    [constituents]
  );

  const historyEnabled = enabled && picks.length > 0;
  const { closeBySymbolId, loading, error, refetch } = useIsmSectorStockHistoryMaps(picks, fromIso, toIso, historyEnabled);

  const constituentBasketTableRows = useMemo(
    () =>
      prepareIsmBasketConstituentTableRows({
        constituents,
        closeBySymbolId,
        localParams: {
          sectorSmaLength: localParams.sectorSmaLength,
          slopeLookback: localParams.slopeLookback,
        },
        selectedSymbolIds,
      }),
    [constituents, closeBySymbolId, localParams.sectorSmaLength, localParams.slopeLookback, selectedSymbolIds]
  );

  return {
    constituentBasketTableRows,
    constituentBasketTableRowsLoading: historyEnabled && loading,
    constituentBasketTableRowsError: error,
    refetchConstituentBasketTableRows: refetch,
  };
}
