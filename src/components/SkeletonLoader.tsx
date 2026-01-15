interface SkeletonLoaderProps {
  className?: string;
  width?: string;
  height?: string;
}

export default function SkeletonLoader({ className = '', width, height }: SkeletonLoaderProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
        backgroundSize: '200% 100%',
      }}
      className="animate-shimmer"
    />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  hasStickyColumns?: boolean;
}

export function TableSkeleton({ rows = 10, columns = 5, hasStickyColumns = false }: TableSkeletonProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900">
            <tr>
              {hasStickyColumns && (
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 left-0 bg-gray-50 dark:bg-gray-900 z-30">
                  <SkeletonLoader height="0.75rem" width="3rem" />
                </th>
              )}
              {Array.from({ length: columns }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className={`px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-900 z-20 ${
                    hasStickyColumns && colIndex === 0 ? 'left-[60px] z-30' : ''
                  } ${hasStickyColumns && colIndex === 1 ? 'left-[260px] z-30' : ''}`}
                >
                  <SkeletonLoader height="0.75rem" width={colIndex === 0 ? '8rem' : '6rem'} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {hasStickyColumns && (
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-20">
                    <SkeletonLoader height="1rem" width="2rem" />
                  </td>
                )}
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 whitespace-nowrap ${
                      hasStickyColumns && colIndex === 0
                        ? 'sticky left-[60px] bg-white dark:bg-gray-800 z-20'
                        : ''
                    } ${
                      hasStickyColumns && colIndex === 1
                        ? 'sticky left-[260px] bg-white dark:bg-gray-800 z-20'
                        : ''
                    }`}
                  >
                    <SkeletonLoader
                      height="1rem"
                      width={colIndex === 0 ? '10rem' : colIndex === 1 ? '4rem' : '6rem'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

