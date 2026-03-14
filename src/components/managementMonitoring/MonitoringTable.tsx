interface MonitoringTableColumn {
  key: string;
  label: string;
}

interface MonitoringTableProps {
  title: string;
  columns: MonitoringTableColumn[];
  rows: Record<string, string | number>[];
  /** Column keys for which to show green background when row[columnKey + 'Green'] is truthy */
  greenCellKeys?: string[];
}

export default function MonitoringTable({
  title,
  columns,
  rows,
  greenCellKeys = [],
}: MonitoringTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <h3 className="px-4 py-3 text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, i) => (
              <tr key={i} className="bg-white dark:bg-gray-800">
                {columns.map((col) => {
                  const isGreen =
                    greenCellKeys.includes(col.key) && row[`${col.key}Green`];
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-sm ${
                        isGreen
                          ? 'text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20'
                          : 'text-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {row[col.key] ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
