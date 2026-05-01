import type {
  MonitoringCardConfig,
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
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FlagIcon,
  ArrowsRightLeftIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon,
  CursorArrowRaysIcon,
};

interface MonitoringCardProps extends MonitoringCardConfig {
  className?: string;
}

/** Neutral shell for all cards — theme prop from config is ignored visually */
const cardShell =
  'rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm';

const interactiveShell =
  'cursor-pointer transition-[box-shadow,border-color] hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-900';

const statusBadgeClasses: Record<MonitoringStatusBadge, string> = {
  ready:
    'bg-green-50 text-green-800 border border-green-200/70 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50',
  loading:
    'bg-amber-50 text-amber-900 border border-amber-200/70 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-800/45',
  stale:
    'bg-yellow-50 text-yellow-900 border border-yellow-200/70 dark:bg-yellow-950/25 dark:text-yellow-200 dark:border-yellow-800/45',
  error:
    'bg-red-50 text-red-800 border border-red-200/70 dark:bg-red-950/35 dark:text-red-300 dark:border-red-800/50',
  idle:
    'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-600',
};

function StatusBadge({ label }: { label: MonitoringStatusBadge }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClasses[label]}`}
    >
      {label}
    </span>
  );
}

export default function MonitoringCard({
  number,
  title,
  theme: _theme,
  icon,
  onClick,
  interactive,
  items,
  description,
  statusCard,
  className = '',
}: MonitoringCardProps) {
  const Icon = icon ? iconMap[icon] : null;
  const isCompactNav = Boolean(interactive && description && !statusCard);
  const padding = statusCard ? 'p-4 sm:p-5' : isCompactNav ? 'p-4' : 'p-4 sm:p-5';

  return (
    <article
      className={`${cardShell} ${padding} flex flex-col ${interactive ? interactiveShell : ''} ${className}`}
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
          className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center text-sm font-semibold tabular-nums"
          aria-hidden
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <h2
            id={`card-title-${number}`}
            className={`font-semibold text-gray-900 dark:text-white ${isCompactNav ? 'text-base' : 'text-lg'}`}
          >
            {title}
          </h2>
          {Icon && (
            <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden />
          )}
        </div>
      </div>
      <div className="mt-3">
        {statusCard ? (
          <div className="space-y-3">
            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
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
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/25 p-3"
              >
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
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
          <p className={`text-gray-600 dark:text-gray-300 ${isCompactNav ? 'text-sm leading-snug' : 'text-sm'}`}>
            {description}
          </p>
        ) : null}
      </div>
    </article>
  );
}
