import { useTranslation } from 'react-i18next';

const LEGEND_ITEMS = [
  { key: 'darkGreen', className: 'bg-green-700 text-white' },
  { key: 'lightGreen', className: 'bg-green-200 text-green-900' },
  { key: 'neutral', className: 'bg-secondary-200 text-secondary-900 dark:bg-secondary-600 dark:text-secondary-50' },
  { key: 'lightRed', className: 'bg-red-200 text-red-900' },
  { key: 'darkRed', className: 'bg-red-700 text-white' },
  { key: 'noData', className: 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
] as const;

export default function PmiHeatmapLegend() {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3"
      aria-labelledby="pmi-legend-title"
    >
      <h4 id="pmi-legend-title" className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
        {t('toolbox.pmi.heatmap.legendTitle')}
      </h4>
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
        {t('toolbox.pmi.heatmap.legendHelp')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className={`inline-flex h-4 w-6 rounded ${item.className}`} aria-hidden="true" />
            <span className="text-xs text-gray-700 dark:text-gray-200">
              {t(`toolbox.pmi.heatmap.legend.${item.key}`)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

