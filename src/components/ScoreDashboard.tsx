import { useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { ScoreData } from './views/ScoreView';
import {
  Squares2X2Icon,
  ArrowTrendingUpIcon,
  MinusIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface ScoreDashboardProps {
  data: ScoreData[];
  loading?: boolean;
}

interface CategoryStats {
  high: number; // ≥70
  medium: number; // 50-69
  low: number; // <50
}

export default function ScoreDashboard({ 
  data, 
  loading = false
}: ScoreDashboardProps) {
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

  if (loading || data.length === 0) {
    return null;
  }

  const summaryCards = [
    {
      key: 'total',
      label: 'Total stocks',
      value: String(data.length),
      icon: Squares2X2Icon,
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      valueClass: 'text-black dark:text-white',
    },
    {
      key: 'high',
      label: 'High (>=70)',
      value: String(stats.categories.high),
      icon: ArrowTrendingUpIcon,
      badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      valueClass: 'text-green-700 dark:text-green-200',
      dotClass: 'bg-green-500',
    },
    {
      key: 'medium',
      label: 'Medium (50-69)',
      value: String(stats.categories.medium),
      icon: MinusIcon,
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      valueClass: 'text-blue-700 dark:text-blue-400',
      dotClass: 'bg-amber-400',
    },
    {
      key: 'low',
      label: 'Low (<50)',
      value: String(stats.categories.low),
      icon: ArrowTrendingDownIcon,
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      valueClass: 'text-black dark:text-white',
      dotClass: 'bg-red-500',
    },
  ] as const;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} variant="elevated" padding="md">
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      {'dotClass' in card && card.dotClass ? (
                        <span className={`inline-block w-2 h-2 rounded-full ${card.dotClass}`} />
                      ) : null}
                      <span>{card.label}</span>
                    </div>
                    <div className={`text-lg font-semibold ${card.valueClass}`}>{card.value}</div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${card.badgeClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
