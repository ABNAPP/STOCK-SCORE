import type {
  MonitoringCardConfig,
  CardTheme,
  MonitoringStatusBadge,
} from '../../types/managementMonitoring';
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

const statusBadgeClasses: Record<MonitoringStatusBadge, string> = {
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  loading: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  stale: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  idle: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function StatusBadge({ label }: { label: MonitoringStatusBadge }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusBadgeClasses[label]}`}
    >
      {label}
    </span>
  );
}

export default function MonitoringCard({
  number,
  title,
  theme,
  icon,
  onClick,
  interactive,
  items,
  description,
  statusCard,
  className = '',
}: MonitoringCardProps) {
  const classes = themeClasses[theme];
  const Icon = icon ? iconMap[icon] : null;

  return (
    <article
      className={`rounded-xl border-2 ${classes.bg} ${classes.border} p-4 sm:p-5 h-full flex flex-col ${interactive ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''} ${className}`}
      aria-labelledby={`card-title-${number}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
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
        {statusCard ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {statusCard.summaryTitle || 'Summary'}
                </p>
                <StatusBadge label={statusCard.overallStatus} />
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600 dark:text-gray-300">DashBoard</span>
                  <StatusBadge label={statusCard.dashboardStatus} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600 dark:text-gray-300">SMA</span>
                  <StatusBadge label={statusCard.smaStatus} />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Last successful sync: <span className="font-medium">{statusCard.lastSuccessfulSync}</span>
              </div>
              {statusCard.subtitle ? (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{statusCard.subtitle}</div>
              ) : null}
            </div>
            {statusCard.sections.map((section) => (
              <div
                key={section.title}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-900/10 p-3"
              >
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.rows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                      <span className="text-gray-900 dark:text-white font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
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
