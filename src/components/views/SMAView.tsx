import { useTranslation } from 'react-i18next';
import { useMemo, useEffect } from 'react';
import { useShareableHydration } from '../../contexts/ShareableHydrationContext';
import { useSMAData } from '../../hooks/useSMAData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { getSMAColor } from '../../utils/colorThresholds/colorLogic';
import SMATable from '../SMATable';
import type { SMAData } from '../../types/stock';

const VIEW_ID = 'sma';
const TABLE_ID = 'sma-100';

function toSmaColor(color: ReturnType<typeof getSMAColor>): 'GREEN' | 'RED' | null {
  return color === 'GREEN' || color === 'RED' ? color : null;
}

export default function SMAView() {
  const { t } = useTranslation();
  const { link, consume } = useShareableHydration();
  const { data, loading, error, refetch } = useSMAData();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();

  const dataWithPriceAndColor: SMAData[] = useMemo(() => {
    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData?.length) {
      benjaminGrahamData.forEach((bg) => {
        priceMap.set(bg.ticker.toLowerCase().trim(), bg.price);
      });
    }
    return data.map((item): SMAData => {
      const price = priceMap.get(item.ticker.toLowerCase().trim()) ?? null;
      return {
        ...item,
        sma9Color: toSmaColor(getSMAColor(price, item.sma9)),
        sma21Color: toSmaColor(getSMAColor(price, item.sma21)),
        sma55Color: toSmaColor(getSMAColor(price, item.sma55)),
        sma200Color: toSmaColor(getSMAColor(price, item.sma200)),
      };
    });
  }, [data, benjaminGrahamData]);

  const initialTableState = useMemo(() => {
    if (!link || link.viewId !== VIEW_ID || link.tableId !== TABLE_ID) return undefined;
    return {
      filterState: link.filterState ?? {},
      columnFilters: link.columnFilters ?? {},
      searchValue: link.searchValue ?? '',
      sortConfig: link.sortConfig,
    };
  }, [link]);

  useEffect(() => {
    if (initialTableState) consume();
  }, [initialTableState, consume]);

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
              {t('navigation.sma')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              SMA (Simple Moving Average) – kolumnen SMA(200)
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 transition-all duration-300 ease-in-out">
          <SMATable
            data={dataWithPriceAndColor}
            loading={loading}
            error={error}
            onRetry={refetch}
            initialTableState={initialTableState}
          />
        </div>
      </div>
    </div>
  );
}
