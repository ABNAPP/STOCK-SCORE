import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterValues, FilterConfig } from '../types/filters';
import Button from './ui/Button';

interface QuickFilter {
  id: string;
  label: string;
  icon?: string;
  filter: FilterValues;
}

interface QuickFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  tableId?: string;
}

export default function QuickFilters({ filters, values, onChange, tableId }: QuickFiltersProps) {
  const { t } = useTranslation();

  // Generate quick filters based on available filter configs
  const quickFilters: QuickFilter[] = useMemo(() => {
    const result: QuickFilter[] = [];

    // Find score filter
    const scoreFilter = filters.find((f) => f.key === 'score' || f.key.toLowerCase().includes('score'));
    if (scoreFilter) {
      result.push({
        id: 'high-score',
        label: t('quickFilters.highScore', 'High Score (>80)'),
        filter: { [scoreFilter.key]: { min: 80 } },
      });
      result.push({
        id: 'medium-score',
        label: t('quickFilters.mediumScore', 'Medium Score (50-80)'),
        filter: { [scoreFilter.key]: { min: 50, max: 80 } },
      });
      result.push({
        id: 'low-score',
        label: t('quickFilters.lowScore', 'Low Score (<50)'),
        filter: { [scoreFilter.key]: { max: 50 } },
      });
    }

    // Find P/E filter
    const peFilter = filters.find((f) => f.key === 'pe' || f.key.toLowerCase().includes('pe'));
    if (peFilter) {
      result.push({
        id: 'low-pe',
        label: t('quickFilters.lowPE', 'Low P/E (<10)'),
        filter: { [peFilter.key]: { max: 10 } },
      });
      result.push({
        id: 'medium-pe',
        label: t('quickFilters.mediumPE', 'Medium P/E (10-20)'),
        filter: { [peFilter.key]: { min: 10, max: 20 } },
      });
      result.push({
        id: 'high-pe',
        label: t('quickFilters.highPE', 'High P/E (>20)'),
        filter: { [peFilter.key]: { min: 20 } },
      });
    }

    // Find price filter
    const priceFilter = filters.find((f) => f.key === 'price' || f.key.toLowerCase().includes('price'));
    if (priceFilter) {
      result.push({
        id: 'low-price',
        label: t('quickFilters.lowPrice', 'Low Price (<50)'),
        filter: { [priceFilter.key]: { max: 50 } },
      });
    }

    return result;
  }, [filters, t]);

  const handleQuickFilterClick = useCallback(
    (quickFilter: QuickFilter) => {
      // Merge with existing filters
      const newValues: FilterValues = {
        ...values,
        ...quickFilter.filter,
      };
      onChange(newValues);
    },
    [values, onChange]
  );

  const isQuickFilterActive = useCallback(
    (quickFilter: QuickFilter): boolean => {
      // Check if all filter keys from quick filter are present and match in current values
      return Object.entries(quickFilter.filter).every(([key, value]) => {
        const currentValue = values[key];
        if (value === null || value === undefined) return true;

        // For range filters
        if (typeof value === 'object' && value !== null && ('min' in value || 'max' in value)) {
          const rangeValue = value as { min?: number; max?: number };
          const currentRange = typeof currentValue === 'object' && currentValue !== null ? (currentValue as { min?: number; max?: number }) : null;
          
          if (!currentRange) return false;
          
          if (rangeValue.min !== undefined && currentRange.min !== rangeValue.min) return false;
          if (rangeValue.max !== undefined && currentRange.max !== rangeValue.max) return false;
          
          return true;
        }

        // For other types
        return currentValue === value;
      });
    },
    [values]
  );

  if (quickFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mr-2">
        {t('quickFilters.title', 'Quick Filters')}:
      </span>
      {quickFilters.map((quickFilter) => {
        const isActive = isQuickFilterActive(quickFilter);
        return (
          <Button
            key={quickFilter.id}
            variant={isActive ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilterClick(quickFilter)}
            className="text-xs"
          >
            {quickFilter.label}
          </Button>
        );
      })}
    </div>
  );
}
