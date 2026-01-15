import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTablePagination } from '../useTablePagination';

describe('useTablePagination', () => {
  const generateData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({ id: i, name: `Item ${i}` }));
  };

  it('should paginate data correctly', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10 })
    );

    expect(result.current.paginatedData).toHaveLength(10);
    expect(result.current.totalPages).toBe(10);
    expect(result.current.currentPage).toBe(1);
  });

  it('should navigate to next page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedData[0].id).toBe(10);
  });

  it('should navigate to previous page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10, initialPage: 2 })
    );

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should not go beyond first page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10, initialPage: 1 })
    );

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should not go beyond last page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10, initialPage: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(10);
  });

  it('should go to specific page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.paginatedData[0].id).toBe(40);
  });

  it('should clamp page number to valid range', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(0);
    });
    expect(result.current.currentPage).toBe(1);

    act(() => {
      result.current.goToPage(100);
    });
    expect(result.current.currentPage).toBe(10);
  });

  it('should go to first page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10, initialPage: 5 })
    );

    act(() => {
      result.current.goToFirstPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should go to last page', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToLastPage();
    });

    expect(result.current.currentPage).toBe(10);
  });

  it('should reset to page 1 when data changes significantly', () => {
    const data1 = generateData(100);
    const { result, rerender } = renderHook(
      ({ data }) => useTablePagination({ data, itemsPerPage: 10 }),
      { initialProps: { data: data1 } }
    );

    act(() => {
      result.current.goToPage(5);
    });

    const data2 = generateData(20); // Much smaller dataset
    rerender({ data: data2 });

    expect(result.current.currentPage).toBe(1);
  });

  it('should calculate correct start and end indices', () => {
    const data = generateData(100);
    const { result } = renderHook(() =>
      useTablePagination({ data, itemsPerPage: 10, initialPage: 3 })
    );

    expect(result.current.startIndex).toBe(21);
    expect(result.current.endIndex).toBe(30);
  });

  it('should handle empty data', () => {
    const { result } = renderHook(() =>
      useTablePagination({ data: [], itemsPerPage: 10 })
    );

    expect(result.current.paginatedData).toHaveLength(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.totalItems).toBe(0);
  });
});
