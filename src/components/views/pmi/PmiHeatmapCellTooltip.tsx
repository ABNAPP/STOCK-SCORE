import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PmiHeatmapCellTooltipProps {
  children: React.ReactNode;
  country: string;
  pmiType: string;
  month: string;
  latestPmi: string;
  previousPmi: string;
  change: string;
  statusVs50: string;
  lastUpdated: string;
}

export default function PmiHeatmapCellTooltip({
  children,
  country,
  pmiType,
  month,
  latestPmi,
  previousPmi,
  change,
  statusVs50,
  lastUpdated,
}: PmiHeatmapCellTooltipProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();
  const triggerId = useId();

  return (
    <div className="relative inline-flex w-full">
      <button
        id={triggerId}
        type="button"
        className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-md"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={() => setIsVisible((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsVisible(false);
          }
        }}
        aria-label={t('toolbox.pmi.heatmap.tooltip.openDetails')}
        aria-expanded={isVisible}
        aria-controls={tooltipId}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </button>
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md border border-gray-700 bg-gray-900 text-gray-100 p-3 shadow-lg"
        >
          <div className="text-xs space-y-1.5">
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.country')}:</span> {country}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.pmiType')}:</span> {pmiType}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.month')}:</span> {month}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.latestPmi')}:</span> {latestPmi}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.previousPmi')}:</span> {previousPmi}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.change')}:</span> {change}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.statusVs50')}:</span> {statusVs50}</p>
            <p><span className="font-semibold">{t('toolbox.pmi.heatmap.tooltip.lastUpdated')}:</span> {lastUpdated}</p>
          </div>
        </div>
      )}
    </div>
  );
}

