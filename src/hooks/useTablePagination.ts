import { useMemo, useState, useEffect } from 'react';

interface UseTablePaginationOptions {
  data: any[];
  itemsPerPage?: number;
  initialPage?: number;
}

export function useTablePagination({
  data,
  itemsPerPage = 50,
  initialPage = 1,
}: UseTablePaginationOptions) {
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

