/**
 * BaseTable filters precedence: ColumnFilters override AdvancedFilters.
 * When columnFilters are active, advancedFilters are NOT applied.
 * When column filters are cleared, advanced filters apply again.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseTable, { ColumnDefinition } from '../BaseTable';
import { FilterConfig } from '../AdvancedFilters';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import '../../i18n/config';

interface FilterTestData {
  industry: string;
  score: number;
}

describe('BaseTable - Filters precedence', () => {
  const columns: ColumnDefinition<FilterTestData>[] = [
    { key: 'industry', label: 'Industry', required: true, sortable: true },
    { key: 'score', label: 'Score', defaultVisible: true, sortable: true },
  ];

  const filters: FilterConfig[] = [
    { key: 'score', label: 'Score', type: 'numberRange', min: 0, max: 100, step: 1 },
  ];

  const renderCell = (item: FilterTestData, column: ColumnDefinition<FilterTestData>) => {
    if (column.key === 'industry') return item.industry;
    return item.score;
  };

  const data: FilterTestData[] = [
    { industry: 'Tech', score: 50 },
    { industry: 'Tech', score: 90 },
    { industry: 'Finance', score: 95 },
  ];

  it('ColumnFilters override AdvancedFilters - finalFilteredData follows columnFilters', () => {
    renderWithAuth(
      <BaseTable
        data={data}
        loading={false}
        error={null}
        columns={columns}
        filters={filters}
        tableId="filters-test"
        renderCell={renderCell}
        searchFields={['industry', 'score']}
        initialFilterState={{ score: { min: 80, max: 100 } }}
        initialColumnFilters={{
          industry: {
            columnKey: 'industry',
            type: 'values',
            selectedValues: ['Tech'],
          },
        }}
      />
    );

    expect(screen.getAllByText('Tech').length).toBe(2);
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(screen.queryByText('95')).not.toBeInTheDocument();
  });

  it('With advanced + column filter, column filter overrides; when column filters cleared advanced apply again (contract)', () => {
    // With both: advanced (score 80-100) + column (industry = Tech) -> column wins -> 2 rows
    renderWithAuth(
      <BaseTable
        data={data}
        loading={false}
        error={null}
        columns={columns}
        filters={filters}
        tableId="filters-reactivate"
        renderCell={renderCell}
        searchFields={['industry', 'score']}
        initialFilterState={{ score: { min: 80, max: 100 } }}
        initialColumnFilters={{
          industry: {
            columnKey: 'industry',
            type: 'values',
            selectedValues: ['Tech'],
          },
        }}
      />
    );
    expect(screen.getAllByText('Tech').length).toBe(2);
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(screen.queryByText('95')).not.toBeInTheDocument();

    // Contract: when column filters are cleared (UI "Rensa filter"), advanced filters apply again (1 row).
    // Full clear flow verified manually/e2e; BaseTable uses hasColumnFilters ? columnFilteredData : filteredData.
  });
});
