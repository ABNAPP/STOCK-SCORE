import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent } from './ui/Card';
import { useTheme } from '../contexts/ThemeContext';
import { ScoreData } from './views/ScoreView';

interface ScoreHistogramProps {
  data: ScoreData[];
}

interface HistogramBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

export default function ScoreHistogram({ data }: ScoreHistogramProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // Create histogram bins: 0-10, 10-20, 20-30, ..., 90-100
  const histogramData: HistogramBin[] = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Initialize bins
    const bins: HistogramBin[] = [];
    const binSize = 10;
    for (let i = 0; i < 100; i += binSize) {
      bins.push({
        range: `${i}-${i + binSize}`,
        count: 0,
        min: i,
        max: i + binSize,
      });
    }

    // Count scores in each bin
    data.forEach((item) => {
      const score = item.score;
      const binIndex = Math.floor(score / binSize);
      // Handle edge case: score of exactly 100 goes into last bin
      const safeIndex = Math.min(binIndex, bins.length - 1);
      if (bins[safeIndex]) {
        bins[safeIndex].count++;
      }
    });

    return bins;
  }, [data]);

  // Get color for each bar based on score range
  const getBarColor = (min: number) => {
    if (min < 50) {
      // Red gradient for low scores
      return isDarkMode ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.7)';
    } else if (min < 70) {
      // Yellow/orange gradient for medium scores
      return isDarkMode ? 'rgba(251, 191, 36, 0.6)' : 'rgba(251, 191, 36, 0.7)';
    } else {
      // Green gradient for high scores
      return isDarkMode ? 'rgba(34, 197, 94, 0.6)' : 'rgba(34, 197, 94, 0.7)';
    }
  };

  // Custom tooltip
  const HistogramTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as HistogramBin;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-black dark:text-white">
            Score: {data.range}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Antal: {data.count}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card variant="elevated" padding="md">
      <CardContent>
        <h3 className="text-base font-semibold text-black dark:text-white mb-3">
          Histogram - Scorefördelning
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={histogramData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="range"
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 11 }}
            />
            <Tooltip content={<HistogramTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {histogramData.map((entry, index) => (
                <Cell
                  key={`bar-cell-${index}`}
                  fill={getBarColor(entry.min)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
