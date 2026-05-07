import { useMemo, useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { ScoreData } from './views/ScoreView';
import { useTheme } from '../contexts/ThemeContext';

interface ScoreHeatMapProps {
  data: ScoreData[];
}

interface HeatMapDataItem {
  ticker: string;
  companyName: string;
  score: number;
}

export default function ScoreHeatMap({ data }: ScoreHeatMapProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const [hoveredStock, setHoveredStock] = useState<string | null>(null);

  const heatMapData: HeatMapDataItem[] = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .map((item) => ({
        ticker: item.ticker,
        companyName: item.companyName,
        score: item.score,
      }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  const getHeatMapColor = (score: number) => {
    if (score < 50) {
      const intensity = score / 50;
      return isDarkMode
        ? `rgba(239, 68, 68, ${0.3 + intensity * 0.5})`
        : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
    } else if (score < 70) {
      const intensity = (score - 50) / 20;
      return isDarkMode
        ? `rgba(251, 191, 36, ${0.3 + intensity * 0.5})`
        : `rgba(251, 191, 36, ${0.2 + intensity * 0.6})`;
    } else {
      const intensity = (score - 70) / 30;
      return isDarkMode
        ? `rgba(34, 197, 94, ${0.3 + intensity * 0.5})`
        : `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`;
    }
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card variant="elevated" padding="md" className="overflow-visible">
      <CardContent className="overflow-visible">
        <h3 className="text-base font-semibold text-black dark:text-white mb-3">Heat map</h3>
        <div className="relative overflow-visible">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[520px] overflow-y-auto overflow-x-visible">
            {heatMapData.map((item, index) => {
              const isTopRow = index < 5;
              return (
                <div
                  key={`${item.ticker}-${item.companyName}-${index}`}
                  className="relative group cursor-pointer transition-transform hover:scale-105"
                  style={{
                    backgroundColor: getHeatMapColor(item.score),
                    minHeight: '64px',
                    borderRadius: '4px',
                    border: hoveredStock === item.ticker ? '2px solid' : '1px solid',
                    borderColor:
                      hoveredStock === item.ticker
                        ? isDarkMode
                          ? '#60a5fa'
                          : '#3b82f6'
                        : isDarkMode
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)',
                  }}
                  onMouseEnter={() => setHoveredStock(item.ticker)}
                  onMouseLeave={() => setHoveredStock(null)}
                >
                  <div className="p-2 h-full flex flex-col justify-between">
                    <div className="text-xs font-semibold text-black dark:text-white truncate">{item.ticker}</div>
                    <div className="text-xs text-black dark:text-white font-bold">{item.score.toFixed(1)}</div>
                  </div>
                  {hoveredStock === item.ticker && (
                    <div
                      className={`absolute z-[100] left-1/2 transform -translate-x-1/2 ${
                        isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                      } text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none`}
                      style={{
                        opacity: 1,
                        backgroundColor: isDarkMode ? 'rgb(31, 41, 55)' : 'rgb(17, 24, 39)',
                      }}
                    >
                      <div className="font-semibold">{item.companyName}</div>
                      <div className="text-gray-300">
                        {item.ticker} - {item.score.toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
