import { sanitizeSearchQuery } from '../utils/inputValidator';

interface TableSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
  filteredRows: number;
  placeholder?: string;
}

export default function TableSearchBar({
  searchValue,
  onSearchChange,
  totalRows,
  filteredRows,
  placeholder = 'Sök...',
}: TableSearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              // Sanitize input as user types
              const sanitized = sanitizeSearchQuery(e.target.value);
              onSearchChange(sanitized);
            }}
            placeholder={placeholder}
            maxLength={200}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-500 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 focus:shadow-sm"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation justify-center"
              title="Rensa sökning"
            >
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap text-center sm:text-left">
        {filteredRows !== totalRows ? (
          <>
            Visar <span className="font-bold text-gray-900 dark:text-gray-100">{filteredRows}</span> av{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">{totalRows}</span> rader
          </>
        ) : (
          <>
            <span className="font-bold text-gray-900 dark:text-gray-100">{totalRows}</span> rader
          </>
        )}
      </div>
    </div>
  );
}

