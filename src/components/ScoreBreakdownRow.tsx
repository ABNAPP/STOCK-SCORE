import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { ScoreBreakdown } from '../utils/calculateScoreDetailed';
import { useTheme } from '../contexts/ThemeContext';

interface ScoreBreakdownRowProps {
  breakdown: ScoreBreakdown;
}

interface StackedBarDataItem {
  name: string;
  value: number;
  color: string;
  darkColor: string;
}

export default function ScoreBreakdownRow({ breakdown }: ScoreBreakdownRowProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // Stacked bar data: Fundamental vs Teknisk
  const stackedBarData: StackedBarDataItem[] = useMemo(() => [
    { 
      name: 'Fundamental', 
      value: breakdown.fundamentalTotal, 
      color: '#3b82f6', // blue-600
      darkColor: '#93c5fd' // blue-300
    },
    { 
      name: 'Teknisk', 
      value: breakdown.technicalTotal, 
      color: '#16a34a', // green-700
      darkColor: '#86efac' // green-300
    },
  ], [breakdown.fundamentalTotal, breakdown.technicalTotal]);

  const getBarColors = () => {
    return stackedBarData.map(item => isDarkMode ? item.darkColor : item.color);
  };

  // Group metrics by category
  const fundamentalItems = useMemo(() => 
    breakdown.items.filter(item => item.category === 'Fundamental'),
    [breakdown.items]
  );
  
  const technicalItems = useMemo(() => 
    breakdown.items.filter(item => item.category === 'Technical'),
    [breakdown.items]
  );

  // Helper functions for color indicators and multiplier text
  const getColorIndicator = (color: string) => {
    switch (color) {
      case 'GREEN':
        return <span className="text-green-500">●</span>;
      case 'BLUE':
        return <span className="text-blue-500">●</span>;
      case 'RED':
        return <span className="text-red-500">●</span>;
      case 'BLANK':
        return <span className="text-gray-400">○</span>;
      default:
        return <span className="text-gray-400">○</span>;
    }
  };

  const getMultiplierText = (factor: number) => {
    if (factor === 1.00) return '100%';
    if (factor === 0.70) return '70%';
    return '0%';
  };

  // Custom tooltip for stacked bar
  const StackedBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-black dark:text-white">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Poäng: {data.value.toFixed(1)} / 50
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-900/50">
      {/* Stacked Bar Chart */}
      <div>
        <h4 className="text-sm font-semibold text-black dark:text-white mb-3">
          Fundamental vs Teknisk poäng
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart 
            data={stackedBarData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis 
              type="number" 
              domain={[0, 50]}
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 12 }}
            />
            <YAxis 
              type="category" 
              dataKey="name"
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 12 }}
              width={80}
            />
            <Tooltip content={<StackedBarTooltip />} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
              {stackedBarData.map((entry, index) => (
                <Cell 
                  key={`bar-cell-${index}`} 
                  fill={getBarColors()[index]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric List */}
      <div>
        <h4 className="text-sm font-semibold text-black dark:text-white mb-3">
          Metric Detaljer
        </h4>
        <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
          {/* Fundamental Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Fundamental</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ({breakdown.fundamentalTotal.toFixed(1)} / 50p)
              </span>
            </div>
            <div className="space-y-1">
              {fundamentalItems.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="flex-shrink-0">{getColorIndicator(item.color)}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.metric}</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                    <span className="text-gray-500 dark:text-gray-400 w-8 text-right text-[10px]">v:{item.weight}</span>
                    <span className="text-gray-500 dark:text-gray-400 w-10 text-right text-[10px]">{getMultiplierText(item.factor)}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium w-12 text-right">{item.points.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">Technical</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ({breakdown.technicalTotal.toFixed(1)} / 50p)
              </span>
            </div>
            <div className="space-y-1">
              {technicalItems.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="flex-shrink-0">{getColorIndicator(item.color)}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.metric}</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                    <span className="text-gray-500 dark:text-gray-400 w-8 text-right text-[10px]">v:{item.weight}</span>
                    <span className="text-gray-500 dark:text-gray-400 w-10 text-right text-[10px]">{getMultiplierText(item.factor)}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium w-12 text-right">{item.points.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <div className="flex items-center space-x-4 text-[10px] text-gray-500 dark:text-gray-400">
              <span>v = vikt</span>
              <span>● = färg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
