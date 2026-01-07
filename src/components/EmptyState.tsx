import React from 'react';

interface EmptyStateProps {
  hasSearch?: boolean;
  hasFilters?: boolean;
  hasData?: boolean;
  message?: string;
  searchTerm?: string;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  searchPlaceholder?: string;
  compact?: boolean; // For use in VirtualTableBody
}

export default function EmptyState({
  hasSearch = false,
  hasFilters = false,
  hasData = true,
  message,
  searchTerm = '',
  onClearSearch,
  onClearFilters,
  searchPlaceholder = 'Sök...',
  compact = false,
}: EmptyStateProps) {
  // Determine the scenario and appropriate message
  const getEmptyStateContent = () => {
    // Scenario 1: No data at all
    if (!hasData) {
      return {
        icon: (
          <svg
            className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
        title: message || 'Ingen data tillgänglig',
        description: 'Försök uppdatera sidan eller kontakta support om problemet kvarstår.',
        actions: null,
      };
    }

    // Scenario 2: Search without results
    if (hasSearch && !hasFilters) {
      return {
        icon: (
          <svg
            className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 dark:text-gray-400"
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
        ),
        title: `Inga resultat hittades för "${searchTerm}"`,
        description: 'Försök med en annan sökterm eller rensa sökningen för att se alla resultat.',
        actions: onClearSearch ? (
          <button
            onClick={onClearSearch}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
          >
            Rensa sökning
          </button>
        ) : null,
      };
    }

    // Scenario 3: Filters without results
    if (hasFilters && !hasSearch) {
      return {
        icon: (
          <svg
            className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        ),
        title: 'Inga resultat matchar dina filter',
        description: 'Justera dina filter eller rensa alla filter för att se fler resultat.',
        actions: onClearFilters ? (
          <button
            onClick={onClearFilters}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
          >
            Rensa alla filter
          </button>
        ) : null,
      };
    }

    // Scenario 4: Both search and filters
    if (hasSearch && hasFilters) {
      return {
        icon: (
          <div className="relative w-12 h-12 sm:w-16 sm:h-16">
            <svg
              className="absolute top-0 left-0 w-12 h-12 sm:w-16 sm:h-16 text-gray-600 dark:text-gray-400"
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
            <svg
              className="absolute top-2 left-2 w-6 h-6 sm:w-8 sm:h-8 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </div>
        ),
        title: 'Inga resultat matchar din sökning och filter',
        description: 'Försök ändra din sökterm eller justera dina filter för att hitta fler resultat.',
        actions: (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            {onClearSearch && (
              <button
                onClick={onClearSearch}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
              >
                Rensa sökning
              </button>
            )}
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
              >
                Rensa alla filter
              </button>
            )}
          </div>
        ),
      };
    }

    // Default: Generic no results
    return {
      icon: (
        <svg
          className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      title: message || 'Inga resultat hittades',
      description: 'Försök ändra dina sökkriterier eller filter.',
      actions: null,
    };
  };

  const content = getEmptyStateContent();

  if (compact) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-300">
        <p className="text-sm">{content.title}</p>
        {content.description && (
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">{content.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 sm:p-12" role="status" aria-live="polite">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4">{content.icon}</div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {content.title}
        </h3>
        {content.description && (
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-md mb-4">
            {content.description}
          </p>
        )}
        {content.actions}
      </div>
    </div>
  );
}

