import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveTableWrapperProps, ExpandedRowState } from '../types/responsiveTable';

export default function ResponsiveTableWrapper<T extends Record<string, unknown>>({
  primaryColumns,
  secondaryColumns,
  data,
  renderPrimaryCell,
  renderSecondaryContent,
  onRowClick,
  rowClassName,
  renderTableHeader,
  emptyMessage = 'Inga data tillgängliga.',
  isLoading = false,
}: ResponsiveTableWrapperProps<T>) {
  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState<ExpandedRowState>({});

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getRowKey = (item: T, index: number): string => {
    // Try to find a unique identifier
    if ('ticker' in item && 'companyName' in item) {
      return `${item.ticker}-${item.companyName}`;
    }
    if ('industry' in item) {
      return `${item.industry}`;
    }
    return `row-${index}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <p className="text-gray-600 dark:text-gray-300 text-center">Laddar...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <p className="text-gray-600 dark:text-gray-300 text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop Table View (≥1024px) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {renderTableHeader && <thead className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900">{renderTableHeader()}</thead>}
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item, index) => {
              const rowKey = getRowKey(item, index);
              const className = rowClassName ? rowClassName(item, index) : '';
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(item)}
                  className={`${className} ${
                    onRowClick ? 'cursor-pointer' : ''
                  } transition-all duration-300 ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                >
                  {primaryColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white"
                    >
                      {renderPrimaryCell(item, column, index)}
                    </td>
                  ))}
                  {secondaryColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white"
                    >
                      {renderSecondaryContent(item, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Card View (<1024px) */}
      <div className="lg:hidden space-y-4">
        {data.map((item, index) => {
          const rowKey = getRowKey(item, index);
          const isExpanded = expandedRows[index] || false;
          const className = rowClassName ? rowClassName(item, index) : '';
          const baseCardClasses = `bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
            onRowClick ? 'cursor-pointer' : ''
          } ${className}`;

          return (
            <div key={rowKey} className={baseCardClasses}>
              {/* Primary Columns - Always Visible */}
              <div
                className="p-4 flex items-center justify-between"
                onClick={() => {
                  if (onRowClick && !isExpanded) {
                    onRowClick(item);
                  }
                }}
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {primaryColumns.map((column) => (
                    <div key={column.key} className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        {column.label}
                      </span>
                      <div className="text-sm font-medium text-black dark:text-white">
                        {renderPrimaryCell(item, column, index)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Expand/Collapse Button */}
                {secondaryColumns.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRow(index);
                    }}
                    className="ml-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 flex-shrink-0"
                    aria-label={isExpanded ? t('aria.collapseRow') : t('aria.expandRow')}
                    aria-expanded={isExpanded}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Secondary Columns - Expandable */}
              {isExpanded && secondaryColumns.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 animate-fade-in">
                  {renderSecondaryContent(item, index)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

