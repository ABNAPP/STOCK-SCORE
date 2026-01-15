import { useMemo, useState, useEffect } from 'react';

interface UseTablePaginationOptions<T> {
  data: T[];
  itemsPerPage?: number;
  initialPage?: number;
}

/**
 * Custom hook for table pagination
 * 
 * Provides pagination functionality with:
 * - Automatic page reset when data changes significantly
 * - Page navigation (next, previous, first, last, go to page)
 * - Calculated indices for display (e.g., "Showing 1-50 of 150")
 * 
 * **Pagination Strategy:**
 * - Default: 50 items per page (configurable)
 * - Automatically resets to page 1 if current page exceeds total pages
 * - Provides 1-based page numbers for user-friendly display
 * 
 * @template T - Type of data items being paginated
 * @param options - Pagination options
 * @param options.data - Array of data items to paginate
 * @param options.itemsPerPage - Number of items per page (default: 50)
 * @param options.initialPage - Initial page number (default: 1)
 * @returns Object with pagination state and navigation functions
 * 
 * @example
 * ```typescript
 * const {
 *   currentPage,
 *   totalPages,
 *   paginatedData,
 *   goToPage,
 *   nextPage
 * } = useTablePagination({
 *   data: stockData,
 *   itemsPerPage: 25,
 *   initialPage: 1
 * });
 * ```
 */
export function useTablePagination<T>({
  data,
  itemsPerPage = 50,
  initialPage = 1,
}: UseTablePaginationOptions<T>) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Reset to page 1 when data changes significantly (e.g., after filtering)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    paginatedData,
    totalItems: data.length,
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, data.length),
  };
}

