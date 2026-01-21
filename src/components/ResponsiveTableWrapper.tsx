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
      {/* Table View */}
      <div className="overflow-x-auto">
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
    </div>
  );
}

