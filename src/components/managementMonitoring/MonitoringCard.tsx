import type { MonitoringCardConfig, CardTheme } from '../../types/managementMonitoring';
import {
  FlagIcon,
  ArrowsRightLeftIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const themeClasses: Record<
  CardTheme,
  { bg: string; border: string; numberBg: string; numberText: string }
> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    numberBg: 'bg-blue-200 dark:bg-blue-800',
    numberText: 'text-blue-900 dark:text-blue-100',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    numberBg: 'bg-red-200 dark:bg-red-800',
    numberText: 'text-red-900 dark:text-red-100',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    numberBg: 'bg-amber-200 dark:bg-amber-800',
    numberText: 'text-amber-900 dark:text-amber-100',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    numberBg: 'bg-green-200 dark:bg-green-800',
    numberText: 'text-green-900 dark:text-green-100',
  },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FlagIcon,
  ArrowsRightLeftIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon,
};

interface MonitoringCardProps extends MonitoringCardConfig {
  className?: string;
}

export default function MonitoringCard({
  number,
  title,
  theme,
  icon,
  items,
  description,
  className = '',
}: MonitoringCardProps) {
  const classes = themeClasses[theme];
  const Icon = icon ? iconMap[icon] : null;

  return (
    <article
      className={`rounded-xl border-2 ${classes.bg} ${classes.border} p-4 sm:p-5 h-full flex flex-col ${className}`}
      aria-labelledby={`card-title-${number}`}
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full ${classes.numberBg} ${classes.numberText} flex items-center justify-center font-bold text-sm`}
          aria-hidden
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <h2
            id={`card-title-${number}`}
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          {Icon && (
            <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden />
          )}
        </div>
      </div>
      <div className="mt-3 flex-1">
        {items && items.length > 0 ? (
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : description ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>
        ) : null}
      </div>
    </article>
  );
}
