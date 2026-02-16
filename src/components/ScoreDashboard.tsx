import { useMemo, useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { ScoreData } from './views/ScoreView';
import { useTheme } from '../contexts/ThemeContext';
import ScoreScatterPlot from './ScoreScatterPlot';
import { IndustryThresholdData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';

interface ScoreDashboardProps {
  data: ScoreData[];
  loading?: boolean;
  thresholdData?: IndustryThresholdData[];
  benjaminGrahamData?: BenjaminGrahamData[];
  entryExitValues?: Map<string, EntryExitValues>;
}

interface CategoryStats {
  high: number; // ≥70
  medium: number; // 50-69
  low: number; // <50
}

interface HeatMapDataItem {
  ticker: string;
  companyName: string;
  score: number;
}

export default function ScoreDashboard({ 
  data, 
  loading = false,
  thresholdData = [],
  benjaminGrahamData = [],
  entryExitValues = new Map()
}: ScoreDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const [hoveredStock, setHoveredStock] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        categories: { high: 0, medium: 0, low: 0 } as CategoryStats,
      };
    }

    const categories: CategoryStats = {
      high: data.filter(item => item.score >= 70).length,
      medium: data.filter(item => item.score >= 50 && item.score < 70).length,
      low: data.filter(item => item.score < 50).length,
    };

    return { categories };
  }, [data]);

  // Heat map data: Sorted by score
  const heatMapData: HeatMapDataItem[] = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .map(item => ({
        ticker: item.ticker,
        companyName: item.companyName,
        score: item.score,
      }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  // Get heat map color based on score
  const getHeatMapColor = (score: number) => {
    if (score < 50) {
      // Red gradient
      const intensity = score / 50;
      return isDarkMode 
        ? `rgba(239, 68, 68, ${0.3 + intensity * 0.5})` 
        : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
    } else if (score < 70) {
      // Yellow/orange gradient
      const intensity = (score - 50) / 20;
      return isDarkMode
        ? `rgba(251, 191, 36, ${0.3 + intensity * 0.5})`
        : `rgba(251, 191, 36, ${0.2 + intensity * 0.6})`;
    } else {
      // Green gradient
      const intensity = (score - 70) / 30;
      return isDarkMode
        ? `rgba(34, 197, 94, ${0.3 + intensity * 0.5})`
        : `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`;
    }
  };

  if (loading || data.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Category Breakdown */}
        <Card variant="elevated" padding="md">
          <CardContent>
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Antal per kategori
              </span>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Hög (≥70)</span>
                  <span className="text-sm font-semibold text-green-700 dark:text-green-200">
                    {stats.categories.high}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Medium (50-69)</span>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {stats.categories.medium}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Låg (&lt;50)</span>
                  <span className="text-sm font-semibold text-black dark:text-white">
                    {stats.categories.low}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Visualizations */}
      <div className="grid grid-cols-1 gap-4">
        {/* Heat Map */}
        <Card variant="elevated" padding="md" className="overflow-visible">
          <CardContent className="overflow-visible">
            <h3 className="text-base font-semibold text-black dark:text-white mb-3">
              Heat Map - Färgintensitet per aktie
            </h3>
            <div className="relative overflow-visible">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto overflow-x-visible">
                {heatMapData.map((item, index) => {
                  // Determine if item is in first row (top row) - approximate based on common breakpoints
                  // For responsive grid: 2 cols (mobile), 3 cols (sm), 4 cols (md), 3 cols (lg), 4 cols (xl)
                  // We'll use a conservative estimate - first 4 items are likely in top row on most screens
                  const isTopRow = index < 4;
                  
                  return (
                    <div
                      key={`${item.ticker}-${item.companyName}-${index}`}
                      className="relative group cursor-pointer transition-transform hover:scale-105"
                      style={{
                        backgroundColor: getHeatMapColor(item.score),
                        minHeight: '60px',
                        borderRadius: '4px',
                        border: hoveredStock === item.ticker ? '2px solid' : '1px solid',
                        borderColor: hoveredStock === item.ticker 
                          ? (isDarkMode ? '#60a5fa' : '#3b82f6')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                      }}
                      onMouseEnter={() => setHoveredStock(item.ticker)}
                      onMouseLeave={() => setHoveredStock(null)}
                    >
                      <div className="p-2 h-full flex flex-col justify-between">
                        <div className="text-xs font-semibold text-black dark:text-white truncate">
                          {item.ticker}
                        </div>
                        <div className="text-xs text-black dark:text-white font-bold">
                          {item.score.toFixed(1)}
                        </div>
                      </div>
                      {hoveredStock === item.ticker && (
                        <div 
                          className={`absolute z-[100] left-1/2 transform -translate-x-1/2 ${
                            isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                          } text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none`}
                          style={{
                            opacity: 1,
                            backgroundColor: isDarkMode ? 'rgb(31, 41, 55)' : 'rgb(17, 24, 39)', // Explicit solid colors (gray-800/gray-900)
                          }}
                        >
                          <div className="font-semibold">{item.companyName}</div>
                          <div className="text-gray-300">{item.ticker} - {item.score.toFixed(1)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scatter Plot */}
        <ScoreScatterPlot 
          data={data}
          thresholdData={thresholdData}
          benjaminGrahamData={benjaminGrahamData}
          entryExitValues={entryExitValues}
        />
      </div>
    </div>
  );
}
