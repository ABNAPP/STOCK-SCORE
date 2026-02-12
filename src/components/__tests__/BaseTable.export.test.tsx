/**
 * BaseTable export: exportTableData receives filtered and sorted data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseTable, { ColumnDefinition } from '../BaseTable';
import { FilterConfig } from '../AdvancedFilters';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import * as exportService from '../../services/exportService';
import '../../i18n/config';

interface ExportTestData {
  name: string;
  value: number;
}

describe('BaseTable - Export uses filtered/sorted data', () => {
  const columns: ColumnDefinition<ExportTestData>[] = [
    { key: 'name', label: 'Name', required: true, sortable: true },
    { key: 'value', label: 'Value', defaultVisible: true, sortable: true },
  ];

  const filters: FilterConfig[] = [];

  const renderCell = (item: ExportTestData, column: ColumnDefinition<ExportTestData>) => {
    if (column.key === 'name') return item.name;
    return item.value;
  };

  const data: ExportTestData[] = [
    { name: 'C', value: 30 },
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(exportService, 'exportTableData').mockImplementation(() => {});
  });

  it('export calls exportTableData with sorted data', async () => {
    const user = userEvent.setup();
    renderWithAuth(
      <BaseTable
        data={data}
        loading={false}
        error={null}
        columns={columns}
        filters={filters}
        tableId="export-test"
        renderCell={renderCell}
        searchFields={['name']}
        enableExport={true}
        defaultSortKey="name"
        defaultSortDirection="asc"
      />
    );

    const exportBtn = screen.getByRole('button', { name: /CSV/i });
    await user.click(exportBtn);

    expect(exportService.exportTableData).toHaveBeenCalledTimes(1);
    const [, sortedData] = vi.mocked(exportService.exportTableData).mock.calls[0];
    expect(sortedData.map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
});
