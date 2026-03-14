import { useMemo, useEffect } from 'react';
import { managementMonitoringConfig } from '../config/managementMonitoringConfig';
import {
  SectionHeader,
  MonitoringGrid,
  MonitoringTable,
} from '../components/managementMonitoring';
import { EntryExitProvider, useEntryExitValues } from '../contexts/EntryExitContext';
import { useScoreBoardData } from '../hooks/useScoreBoardData';
import { useBenjaminGrahamData } from '../hooks/useBenjaminGrahamData';
import { EntryExitData } from '../types/stock';
import {
  isEntry1GreenForCell,
  isEntry2GreenForCell,
} from '../utils/colorThresholds/entryExitCellColors';
import type { MonitoringTableConfig } from '../types/managementMonitoring';

function ManagementMonitoringPageInner() {
  const config = managementMonitoringConfig;
  const { data: scoreData, loading: scoreLoading } = useScoreBoardData();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();
  const { getEntryExitValue, initializeFromData } = useEntryExitValues();

  // Initialize EntryExitContext with Score Board list (values loaded from Firestore by provider)
  useEffect(() => {
    if (scoreData && scoreData.length > 0) {
      const entryExitData: EntryExitData[] = scoreData.map((item) => ({
        companyName: item.companyName,
        ticker: item.ticker,
        currency: 'USD',
        entry1: 0,
        entry2: 0,
        exit1: 0,
        exit2: 0,
        dateOfUpdate: null,
      }));
      initializeFromData(entryExitData);
    }
  }, [scoreData, initializeFromData]);

  const stocksWithGreenEntry = useMemo(() => {
    if (!scoreData || scoreData.length === 0) return [];

    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      benjaminGrahamData.forEach((bg) => {
        const tickerKey = bg.ticker.toLowerCase().trim();
        priceMap.set(tickerKey, bg.price);
      });
    }

    const rows: Record<string, string | number>[] = [];

    scoreData.forEach((item) => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const price = priceMap.get(tickerKey) ?? null;
      const entryValues = getEntryExitValue(item.ticker, item.companyName);
      const entry1 = entryValues?.entry1 ?? 0;
      const entry2 = entryValues?.entry2 ?? 0;
      const currency = entryValues?.currency ?? 'USD';

      const entry1Green = isEntry1GreenForCell(price, entry1);
      const entry2Green = isEntry2GreenForCell(price, entry2);

      if (!entry1Green && !entry2Green) return;

      const displayPrice =
        price != null && typeof price === 'number'
          ? price.toFixed(2)
          : '—';

      rows.push({
        companyName: item.companyName,
        ticker: item.ticker,
        price: displayPrice,
        entry1,
        entry2,
        currency,
        entry1Green: entry1Green ? 1 : 0,
        entry2Green: entry2Green ? 1 : 0,
      });
    });

    rows.sort((a, b) =>
      String(a.companyName).localeCompare(String(b.companyName))
    );

    return rows.map((row, index) => ({ ...row, no: index + 1 }));
  }, [scoreData, benjaminGrahamData, getEntryExitValue]);

  const getRowsForTable = (table: MonitoringTableConfig): Record<string, string | number>[] => {
    if (table.dataSource === 'stocksGreenEntry') {
      return stocksWithGreenEntry;
    }
    return table.rows;
  };

  const isTableLoading = (table: MonitoringTableConfig): boolean => {
    if (table.dataSource === 'stocksGreenEntry') {
      return scoreLoading;
    }
    return false;
  };

  return (
    <div
      className="h-full bg-gray-100 dark:bg-gray-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 flex flex-col"
      aria-label="Management Monitoring"
    >
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 min-h-0">
        <SectionHeader
          title={config.pageTitle}
          subtitle={config.pageSubtitle}
        />

        <section className="flex-1 mb-8 md:mb-10" aria-label="Overview cards">
          <MonitoringGrid cards={config.cards} />
        </section>

        <section
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          aria-label="Summary tables"
        >
          {config.tables.map((table) => {
            const rows = getRowsForTable(table);
            const loading = isTableLoading(table);
            return (
              <div key={table.id} className="min-h-0">
                {loading ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    {table.title}: Laddar…
                  </div>
                ) : (
                  <MonitoringTable
                    title={table.title}
                    columns={table.columns}
                    rows={rows}
                    greenCellKeys={
                      table.dataSource === 'stocksGreenEntry'
                        ? ['entry1', 'entry2']
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export default function ManagementMonitoringPage() {
  return (
    <EntryExitProvider>
      <ManagementMonitoringPageInner />
    </EntryExitProvider>
  );
}
