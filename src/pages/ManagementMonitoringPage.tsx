import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useCentralDataServiceStatus } from '../hooks/useCentralDataServiceStatus';
import type { MonitoringStatusBadge } from '../types/managementMonitoring';

function formatStatusTimestamp(value: number | null): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
}

function formatStatusValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function mapStatusBadge(value: string | null | undefined): MonitoringStatusBadge {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'ready' || normalized === 'loading' || normalized === 'stale' || normalized === 'error' || normalized === 'idle') {
    return normalized as MonitoringStatusBadge;
  }
  return 'idle';
}

function deriveOverallStatus(
  dashboardStatus: MonitoringStatusBadge,
  smaStatus: MonitoringStatusBadge
): MonitoringStatusBadge {
  const statuses = [dashboardStatus, smaStatus];
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  if (statuses.includes('stale')) return 'stale';
  if (statuses.every((s) => s === 'ready')) return 'ready';
  return 'idle';
}

function ManagementMonitoringPageInner() {
  const navigate = useNavigate();
  const config = managementMonitoringConfig;
  const { data: scoreData, loading: scoreLoading } = useScoreBoardData();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();
  const { getEntryExitValue, initializeFromData } = useEntryExitValues();
  const centralStatus = useCentralDataServiceStatus();

  // Initialize EntryExitContext with Score Board list (values loaded from Firestore by provider)
  useEffect(() => {
    if (scoreData && scoreData.length > 0) {
      const entryExitData: EntryExitData[] = scoreData.map((item) => ({
        companyName: item.companyName,
        ticker: item.ticker,
        currency: '',
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
      const currency = entryValues?.currency ?? '';

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

  const cards = useMemo(() => {
    return config.cards.map((card) => {
      if (card.id !== 'central-data-service') {
        return card;
      }

      const dash = centralStatus.DashBoard;
      const sma = centralStatus.SMA;
      const dashboardStatus = mapStatusBadge(dash.status);
      const smaStatus = mapStatusBadge(sma.status);
      const overallStatus = deriveOverallStatus(dashboardStatus, smaStatus);
      const combinedLastSync = [dash.lastSuccessfulSync, sma.lastSuccessfulSync]
        .filter((v): v is number => typeof v === 'number' && v > 0)
        .sort((a, b) => b - a)[0] ?? null;
      const combinedError = [dash.lastError, sma.lastError]
        .find((err) => err && err.trim().length > 0) || 'No errors';
      return {
        ...card,
        interactive: true,
        onClick: () => navigate('/management-monitoring/central-data-service'),
        statusCard: {
          summaryTitle: 'Overall status',
          overallStatus,
          dashboardStatus,
          smaStatus,
          lastSuccessfulSync: formatStatusTimestamp(combinedLastSync),
          subtitle: 'Shows the status of the shared Google Sheets snapshot layer used by the app.',
          sections: [
            {
              title: 'Snapshot Status',
              rows: [
                { label: 'DashBoard lastAttemptAt', value: formatStatusTimestamp(dash.lastAttemptAt) },
                { label: 'SMA lastAttemptAt', value: formatStatusTimestamp(sma.lastAttemptAt) },
                { label: 'In flight', value: `DashBoard ${formatStatusValue(dash.inFlight)} / SMA ${formatStatusValue(sma.inFlight)}` },
              ],
            },
            {
              title: 'Data Volume',
              rows: [
                { label: 'DashBoard rowCount', value: formatStatusValue(dash.rowCount) },
                { label: 'SMA rowCount', value: formatStatusValue(sma.rowCount) },
                { label: 'Unique companies', value: formatStatusValue(dash.uniqueCompanyCount) },
              ],
            },
            {
              title: 'Cache & Network',
              rows: [
                { label: 'DashBoard cacheHits/cacheMisses', value: `${formatStatusValue(dash.cacheHits)}/${formatStatusValue(dash.cacheMisses)}` },
                { label: 'SMA cacheHits/cacheMisses', value: `${formatStatusValue(sma.cacheHits)}/${formatStatusValue(sma.cacheMisses)}` },
                { label: 'Apps Script calls', value: `DashBoard ${formatStatusValue(dash.appsScriptCalls)} / SMA ${formatStatusValue(sma.appsScriptCalls)}` },
              ],
            },
            {
              title: 'Errors',
              rows: [
                { label: 'Last error', value: formatStatusValue(combinedError) },
              ],
            },
          ],
        },
      };
    });
  }, [config.cards, centralStatus, navigate]);

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
          <MonitoringGrid cards={cards} />
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
