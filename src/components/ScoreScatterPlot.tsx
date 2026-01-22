import { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent } from './ui/Card';
import { useTheme } from '../contexts/ThemeContext';
import { ScoreData } from './views/ScoreView';
import { ThresholdIndustryData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';
import { calculateDetailedScoreBreakdown } from '../utils/calculateScoreDetailed';

interface ScoreScatterPlotProps {
  data: ScoreData[];
  thresholdData?: ThresholdIndustryData[];
  benjaminGrahamData?: BenjaminGrahamData[];
  entryExitValues?: Map<string, EntryExitValues>;
}

interface ScatterDataPoint {
  x: number; // Fundamental score
  y: number; // Technical score
  ticker: string;
  companyName: string;
  score: number; // Total score for color coding
}

export default function ScoreScatterPlot({ 
  data, 
  thresholdData = [], 
  benjaminGrahamData = [], 
  entryExitValues = new Map() 
}: ScoreScatterPlotProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // Calculate scatter plot data points, separated by color based on total score
  const { greenPoints, bluePoints, grayPoints } = useMemo(() => {
    if (!data || data.length === 0) {
      return { greenPoints: [], bluePoints: [], grayPoints: [] };
    }

    const green: ScatterDataPoint[] = [];
    const blue: ScatterDataPoint[] = [];
    const gray: ScatterDataPoint[] = [];

    data.forEach((item) => {
      // Calculate breakdown to get fundamental and technical scores
      const breakdown = calculateDetailedScoreBreakdown(
        item.scoreBoardData,
        thresholdData,
        benjaminGrahamData,
        entryExitValues
      );

      const point: ScatterDataPoint = {
        x: breakdown.fundamentalTotal,
        y: breakdown.technicalTotal,
        ticker: item.ticker,
        companyName: item.companyName,
        score: item.score, // Total score for color coding
      };

      // Filter out invalid points
      if (isNaN(point.x) || isNaN(point.y) || !isFinite(point.x) || !isFinite(point.y)) {
        return;
      }

      // Separate by color based on total score (matching SCORE column logic):
      // Green: score >= 70
      // Blue: score >= 50 && score < 70
      // Gray: score < 50
      if (item.score >= 70) {
        green.push(point);
      } else if (item.score >= 50 && item.score < 70) {
        blue.push(point);
      } else {
        gray.push(point);
      }
    });

    return { greenPoints: green, bluePoints: blue, grayPoints: gray };
  }, [data, thresholdData, benjaminGrahamData, entryExitValues]);

  // Custom tooltip
  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ScatterDataPoint;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-black dark:text-white">
            {data.companyName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.ticker}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Total poäng: {data.score.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fundamental: {data.x.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Teknisk: {data.y.toFixed(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return null;
  }

  // Color values matching SCORE column (from ScoreTable.tsx):
  // Green: text-green-700 dark:text-green-200
  // Blue: text-blue-700 dark:text-blue-400
  // Gray: text-black dark:text-white (using gray for better visibility)
  const grayColor = isDarkMode ? '#ffffff' : '#000000';
  const blueColor = isDarkMode ? '#60a5fa' : '#1d4ed8'; // blue-400 / blue-700
  const greenColor = isDarkMode ? '#86efac' : '#15803d'; // green-300 / green-700

  return (
    <Card variant="elevated" padding="md">
      <CardContent>
        <h3 className="text-base font-semibold text-black dark:text-white mb-3">
          Fundamental vs Teknisk poäng
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={isDarkMode ? '#374151' : '#e5e7eb'} 
            />
            <XAxis
              type="number"
              dataKey="x"
              name="Fundamental poäng"
              label={{ value: 'Fundamental poäng', position: 'insideBottom', offset: -5 }}
              domain={[0, 50]}
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Tekniska poäng"
              label={{ value: 'Tekniska poäng', angle: -90, position: 'insideLeft' }}
              domain={[0, 50]}
              tick={{ fill: isDarkMode ? '#e5e7eb' : '#374151', fontSize: 11 }}
            />
            <Tooltip content={<ScatterTooltip />} />
            {/* Gray points (score < 50) - rendered first as background */}
            <Scatter
              data={grayPoints}
              dataKey="y"
              fill={grayColor}
            />
            {/* Blue points (score >= 50 && score < 70) */}
            <Scatter
              data={bluePoints}
              dataKey="y"
              fill={blueColor}
            />
            {/* Green points (score >= 70) - rendered last on top */}
            <Scatter
              data={greenPoints}
              dataKey="y"
              fill={greenColor}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
