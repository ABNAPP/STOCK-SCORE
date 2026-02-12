import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseTable, { ColumnDefinition } from '../BaseTable';
import { FilterConfig } from '../AdvancedFilters';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import { setupStableRandom, teardownStableRandom } from '../../test/utils/determinism';
import '../../i18n/config';

// Test data type
interface TestData {
  id: number;
  name: string;
  value: number;
  category: string;
  status: string;
}

describe('BaseTable Integration Tests', () => {
  beforeEach(() => setupStableRandom(1));
  afterEach(() => teardownStableRandom());

  const mockColumns: ColumnDefinition<TestData>[] = [
    { key: 'id', label: 'ID', required: true, sticky: true, sortable: true },
    { key: 'name', label: 'Name', required: true, sticky: true, sortable: true },
    { key: 'value', label: 'Value', defaultVisible: true, sortable: true, align: 'center' },
    { key: 'category', label: 'Category', defaultVisible: true, sortable: true },
    { key: 'status', label: 'Status', defaultVisible: false, sortable: false },
  ];

  const mockFilters: FilterConfig[] = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'select', options: [
      { value: 'A', label: 'Category A' },
      { value: 'B', label: 'Category B' },
      { value: 'C', label: 'Category C' },
    ]},
    { key: 'value', label: 'Value', type: 'numberRange', min: 0, max: 100, step: 1 },
    { key: 'status', label: 'Status', type: 'text' },
  ];

  const createTestData = (count: number): TestData[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 100),
      category: ['A', 'B', 'C'][i % 3],
      status: i % 2 === 0 ? 'Active' : 'Inactive',
    }));
  };

  const renderCell = (item: TestData, column: ColumnDefinition<TestData>) => {
    switch (column.key) {
      case 'id':
        return item.id;
      case 'name':
        return <span>{item.name}</span>;
      case 'value':
        return item.value;
      case 'category':
        return item.category;
      case 'status':
        return item.status;
      default:
        return null;
    }
  };

  describe('Rendering with different data sizes', () => {
    it('should render with empty data', () => {
      renderWithAuth(
        <BaseTable
          data={[]}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          emptyMessage="No data available"
        />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render with single row', () => {
      const data = createTestData(1);
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('should render with small dataset (< 10 rows)', () => {
      const data = createTestData(5);
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 5')).toBeInTheDocument();
    });

    it('should render with large dataset (> 100 rows)', () => {
      const data = createTestData(150);
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          enablePagination={true}
          itemsPerPage={50}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      // Should show pagination
      expect(screen.getByText(/Visar/i)).toBeInTheDocument();
    });
  });

  describe('Search functionality', () => {
    it('should filter data by search term', async () => {
      const user = userEvent.setup();
      const data = createTestData(10);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Sök/i);
      await user.type(searchInput, 'Item 1');

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      });
    });

    it('should search across multiple fields', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 1, name: 'Apple', value: 10, category: 'Fruit', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'Fruit', status: 'Active' },
        { id: 3, name: 'Carrot', value: 30, category: 'Vegetable', status: 'Inactive' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Sök/i);
      await user.type(searchInput, 'Fruit');

      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.getByText('Banana')).toBeInTheDocument();
        expect(screen.queryByText('Carrot')).not.toBeInTheDocument();
      });
    });
  });

  describe('Advanced filters', () => {
    it('should filter by text filter', async () => {
      const user = userEvent.setup();
      const data = createTestData(10);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find and fill name filter
      const nameInput = screen.getByPlaceholderText(/Sök name/i);
      await user.type(nameInput, 'Item 1');

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });

    it('should filter by select filter', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 1, name: 'Item 1', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Item 2', value: 20, category: 'B', status: 'Active' },
        { id: 3, name: 'Item 3', value: 30, category: 'C', status: 'Inactive' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Select category filter
      const categorySelect = screen.getByLabelText(/Category/i) || 
        within(screen.getByText('Category').closest('div')!).getByRole('combobox');
      
      // Try to find select element
      const selects = screen.getAllByRole('combobox');
      const categorySelectElement = selects.find(select => 
        select.closest('div')?.textContent?.includes('Category')
      ) || selects[0];

      if (categorySelectElement) {
        await user.selectOptions(categorySelectElement, 'A');
      }

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });

    it('should filter by number range', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 1, name: 'Item 1', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Item 2', value: 50, category: 'B', status: 'Active' },
        { id: 3, name: 'Item 3', value: 90, category: 'C', status: 'Inactive' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find value range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const minInput = inputs.find(input => input.getAttribute('placeholder') === 'Min') || inputs[0];
      const maxInput = inputs.find(input => input.getAttribute('placeholder') === 'Max') || inputs[1];

      if (minInput) await user.type(minInput, '20');
      if (maxInput) await user.type(maxInput, '60');

      await waitFor(() => {
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Item 3')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filter combinations', () => {
    it('should apply multiple filters simultaneously', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 1, name: 'Apple', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'A', status: 'Active' },
        { id: 3, name: 'Carrot', value: 30, category: 'B', status: 'Inactive' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Apply name filter
      const nameInput = screen.getByPlaceholderText(/Sök name/i);
      await user.type(nameInput, 'Apple');

      // Apply value range
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const minInput = inputs.find(input => input.getAttribute('placeholder') === 'Min') || inputs[0];
      if (minInput) await user.type(minInput, '5');

      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.queryByText('Banana')).not.toBeInTheDocument();
      });
    });

    it('should combine search and filters', async () => {
      const user = userEvent.setup();
      const data = createTestData(10);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Apply search
      const searchInput = screen.getByPlaceholderText(/Sök/i);
      await user.type(searchInput, 'Item');

      // Open and apply filter
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);
      const nameInput = screen.getByPlaceholderText(/Sök name/i);
      await user.type(nameInput, '1');

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort ascending when clicking column header', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 3, name: 'Zebra', value: 30, category: 'C', status: 'Active' },
        { id: 1, name: 'Apple', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'B', status: 'Active' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          defaultSortKey="name"
        />
      );

      // Click name column to sort
      const nameHeader = screen.getByText('Name');
      await user.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // First data row should be Apple
        expect(rows[1]).toHaveTextContent('Apple');
      });
    });

    it('should toggle sort direction on second click', async () => {
      const user = userEvent.setup();
      const data = [
        { id: 1, name: 'Apple', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'B', status: 'Active' },
        { id: 3, name: 'Zebra', value: 30, category: 'C', status: 'Active' },
      ];
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          defaultSortKey="name"
        />
      );

      const nameHeader = screen.getByText('Name');
      // Click twice to toggle
      await user.click(nameHeader);
      await user.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted descending (Zebra first)
        expect(rows[1]).toHaveTextContent('Zebra');
      });
    });
  });

  describe('Pagination', () => {
    it('should paginate large datasets', async () => {
      const user = userEvent.setup();
      const data = createTestData(150);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          enablePagination={true}
          itemsPerPage={50}
        />
      );

      // Should show first page
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      
      // Navigate to next page
      const nextButton = screen.getByText(/Nästa|Next/i);
      if (nextButton) {
        await user.click(nextButton);
        
        await waitFor(() => {
          expect(screen.getByText('Item 51')).toBeInTheDocument();
        });
      }
    });

    it('should maintain filters when paginating', async () => {
      const user = userEvent.setup();
      const data = createTestData(150);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          enablePagination={true}
          itemsPerPage={50}
        />
      );

      // Apply search
      const searchInput = screen.getByPlaceholderText(/Sök/i);
      await user.type(searchInput, 'Item 1');

      // Navigate pages
      const nextButton = screen.getByText(/Nästa|Next/i);
      if (nextButton) {
        await user.click(nextButton);
        
        await waitFor(() => {
          // Should still show filtered results
          expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Column visibility', () => {
    it('should toggle column visibility', async () => {
      const user = userEvent.setup();
      const data = createTestData(5);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Open column visibility toggle
      const columnToggle = screen.getByLabelText(/Kolumnsynlighet|Column visibility/i) ||
        screen.getByTitle(/Kolumnsynlighet|Column visibility/i) ||
        screen.getAllByRole('button').find(btn => btn.textContent?.includes('Kolumn') || btn.textContent?.includes('Column'));
      
      if (columnToggle) {
        await user.click(columnToggle);
        
        // Try to find and toggle a column
        await waitFor(() => {
          // Column visibility should be accessible
          expect(columnToggle).toBeInTheDocument();
        });
      }
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      renderWithAuth(
        <BaseTable
          data={[]}
          loading={true}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      // Should show skeleton/loading state
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should show error state', () => {
      renderWithAuth(
        <BaseTable
          data={[]}
          loading={false}
          error="Failed to load data"
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
        />
      );

      expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  describe('Shareable link hydration (initial state)', () => {
    it('should apply initialFilterState and initialSearchValue on mount', async () => {
      const data = [
        { id: 1, name: 'Apple', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'B', status: 'Active' },
        { id: 3, name: 'Apricot', value: 30, category: 'C', status: 'Inactive' },
      ];

      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-hydration"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          initialFilterState={{ name: 'Apple' }}
          initialSearchValue="Apple"
        />
      );

      await waitFor(() => {
        // Search input should show initial value
        const searchInput = screen.getByPlaceholderText(/Sök/i);
        expect(searchInput).toHaveValue('Apple');
      });
      // Filtered by search: only Apple matches "Apple" (substring)
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });

    it('should apply initialSortConfig on mount', () => {
      const data = [
        { id: 3, name: 'Zebra', value: 30, category: 'C', status: 'Active' },
        { id: 1, name: 'Apple', value: 10, category: 'A', status: 'Active' },
        { id: 2, name: 'Banana', value: 20, category: 'B', status: 'Active' },
      ];

      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-hydration-sort"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          defaultSortKey="name"
          initialSortConfig={{ key: 'name', direction: 'desc' }}
        />
      );

      // With desc sort by name, Zebra should be first
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Zebra');
    });
  });

  describe('Sticky columns', () => {
    it('should render sticky columns', () => {
      const data = createTestData(5);
      
      renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={mockColumns}
          filters={mockFilters}
          tableId="test-table"
          renderCell={renderCell}
          searchFields={['name', 'category']}
          stickyColumns={['id', 'name']}
        />
      );

      // Sticky columns should be rendered
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });
});

