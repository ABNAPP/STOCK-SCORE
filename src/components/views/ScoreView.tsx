import { useTranslation } from 'react-i18next';
import { useMemo, lazy, Suspense, useEffect, useState } from 'react';
import { TableCellsIcon, Squares2X2Icon, ChartBarSquareIcon } from '@heroicons/react/24/outline';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { EntryExitData, ScoreBoardData } from '../../types/stock';
import { getSMAColor } from '../../utils/colorThresholds/colorLogic';
import ProgressIndicator from '../ProgressIndicator';
import { TableSkeleton } from '../SkeletonLoader';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { calculateDetailedScore } from '../../utils/calculateScoreDetailed';
import ScoreDashboard from '../ScoreDashboard';
import ScoreHeatMap from '../ScoreHeatMap';
import ScoreScatterPlot from '../ScoreScatterPlot';

// Lazy load table component
const ScoreTable = lazy(() => import('../ScoreTable'));

export interface ScoreData extends Record<string, unknown> {
  companyName: string;
  ticker: string;
  currency: string;
  price: number | null;
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  score: number;
  scoreBoardData: ScoreBoardData; // Full data for breakdown calculation
}

const VIEW_ID = 'score';
const TABLE_ID = 'score';

// Inner component that uses EntryExitContext
function ScoreViewInner() {
  const { t } = useTranslation();
  const { data: scoreBoardData, loading, error } = useScoreBoardData();
  const { data: benjaminGrahamData, loading: bgLoading } = useBenjaminGrahamData();
  const { initializeFromData, entryExitValues } = useEntryExitValues();
  const [selectedView, setSelectedView] = useState<'table' | 'heatmap' | 'scatter'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryOption, setCategoryOption] = useState('all');
  
  // Progressive loading: Only block rendering on main data (scoreBoardData)
  // Allow benjaminGrahamData to load in background
  const isLoading = loading;
  const isBackgroundLoading = bgLoading;

  // Initialize EntryExitContext with ScoreBoardData (same as EntryExitTable)
  useEffect(() => {
    if (scoreBoardData && scoreBoardData.length > 0) {
      const entryExitData: EntryExitData[] = scoreBoardData.map((item) => ({
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
  }, [scoreBoardData, initializeFromData]);

  // Match Price data with Score Board data; compute SMA colors (from SMA table) for score calculation
  const scoreData: ScoreData[] = useMemo(() => {
    if (!scoreBoardData || scoreBoardData.length === 0) return [];

    const priceMap = new Map<string, number | null>();
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      benjaminGrahamData.forEach(bg => {
        const tickerKey = bg.ticker.toLowerCase().trim();
        priceMap.set(tickerKey, bg.price);
      });
    }

    return scoreBoardData.map(item => {
      const tickerKey = item.ticker.toLowerCase().trim();
      const price = priceMap.get(tickerKey) ?? item.price ?? null;
      const sma9Color = (() => { const c = getSMAColor(price, item.sma9); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma21Color = (() => { const c = getSMAColor(price, item.sma21); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma55Color = (() => { const c = getSMAColor(price, item.sma55); return c === 'GREEN' || c === 'RED' ? c : null; })();
      const sma200Color = (() => { const c = getSMAColor(price, item.sma200); return c === 'GREEN' || c === 'RED' ? c : null; })();

      const enhancedData: ScoreBoardData = {
        ...item,
        price,
        sma9Color,
        sma21Color,
        sma55Color,
        sma200Color,
      };

      // Get currency and entry/exit values from entryExitValues
      const entryExitValue = entryExitValues.get(item.companyName);
      const currency = entryExitValue?.currency ?? '';
      const entry1 = entryExitValue?.entry1 || 0;
      const entry2 = entryExitValue?.entry2 || 0;
      const exit1 = entryExitValue?.exit1 || 0;
      const exit2 = entryExitValue?.exit2 || 0;

      // Calculate detailed score
      const score = calculateDetailedScore(
        enhancedData,
        benjaminGrahamData || [],
        entryExitValues
      );

      return {
        companyName: item.companyName,
        ticker: item.ticker,
        currency: currency,
        price: price,
        entry1: entry1,
        entry2: entry2,
        exit1: exit1,
        exit2: exit2,
        score: score,
        scoreBoardData: enhancedData,
      };
    });
  }, [scoreBoardData, benjaminGrahamData, entryExitValues]);

  const getMarketValue = (item: ScoreData): string => {
    const ticker = (item.ticker || '').trim();
    const currency = (item.currency || '').trim();
    if (ticker.includes(':')) {
      return ticker.split(':')[0].trim().toUpperCase();
    }
    return currency ? currency.toUpperCase() : 'UNKNOWN';
  };

  const searchFilteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scoreData;
    return scoreData.filter((item) =>
      item.companyName.toLowerCase().includes(query) ||
      item.ticker.toLowerCase().includes(query) ||
      (item.currency || '').toLowerCase().includes(query) ||
      getMarketValue(item).toLowerCase().includes(query)
    );
  }, [scoreData, searchQuery]);

  const categoryFilteredData = useMemo(() => {
    if (categoryOption === 'high') {
      return searchFilteredData.filter((item) => item.score >= 70);
    }
    if (categoryOption === 'medium') {
      return searchFilteredData.filter((item) => item.score >= 50 && item.score < 70);
    }
    if (categoryOption === 'low') {
      return searchFilteredData.filter((item) => item.score < 50);
    }
    return searchFilteredData;
  }, [searchFilteredData, categoryOption]);

  const visibleScoreData = useMemo(() => {
    const sorted = [...categoryFilteredData];
    sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }, [categoryFilteredData]);

  const viewButtonClass = (view: 'table' | 'heatmap' | 'scatter') =>
    `px-3 py-2 text-sm rounded-md border transition-colors min-h-[40px] inline-flex items-center gap-1.5 ${
      selectedView === view
        ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">Score</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Poängsystem baserat på färgkodning (0-100)</p>
          </div>
        </div>
        {isLoading && (
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator isLoading={true} label="Loading data..." />
          </div>
        )}
        {!isLoading && isBackgroundLoading && (
          <div className="mb-2 flex-shrink-0">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t('common.loadingAdditionalData', 'Laddar ytterligare data i bakgrunden...')}
            </p>
          </div>
        )}
        {!isLoading && scoreData.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col gap-4 transition-all duration-300 ease-in-out">
            <ScoreDashboard data={visibleScoreData} loading={false} />

            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-6">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search company or ticker..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={categoryOption}
                    onChange={(e) => setCategoryOption(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="high">High (&gt;=70)</option>
                    <option value="medium">Medium (50-69)</option>
                    <option value="low">Low (&lt;50)</option>
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">View</label>
                  <div className="flex gap-2">
                    <button type="button" className={viewButtonClass('table')} onClick={() => setSelectedView('table')}>
                      <TableCellsIcon className="w-4 h-4" />
                      Table
                    </button>
                    <button type="button" className={viewButtonClass('heatmap')} onClick={() => setSelectedView('heatmap')}>
                      <Squares2X2Icon className="w-4 h-4" />
                      Heat map
                    </button>
                    <button type="button" className={viewButtonClass('scatter')} onClick={() => setSelectedView('scatter')}>
                      <ChartBarSquareIcon className="w-4 h-4" />
                      Scatter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 min-w-0">
              {selectedView === 'table' && (
                <Suspense fallback={<TableSkeleton rows={15} columns={4} hasStickyColumns={true} />}>
                  <ScoreTable
                    data={visibleScoreData}
                    loading={false}
                    error={error}
                    benjaminGrahamData={benjaminGrahamData || []}
                    entryExitValues={entryExitValues}
                    defaultSortKey="score"
                    defaultSortDirection="desc"
                  />
                </Suspense>
              )}
              {selectedView === 'heatmap' && <ScoreHeatMap data={visibleScoreData} />}
              {selectedView === 'scatter' && (
                <ScoreScatterPlot
                  data={visibleScoreData}
                  benjaminGrahamData={benjaminGrahamData || []}
                  entryExitValues={entryExitValues}
                />
              )}
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 min-h-0">
            <TableSkeleton rows={15} columns={4} hasStickyColumns={true} />
          </div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 p-4">{error}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function ScoreView() {
  return (
    <EntryExitProvider>
      <ScoreViewInner />
    </EntryExitProvider>
  );
}
