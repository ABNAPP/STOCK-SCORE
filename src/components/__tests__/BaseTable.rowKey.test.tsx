/**
 * BaseTable rowKey determinism: when item lacks ticker/companyName,
 * BaseTable uses stableHash(stableStringify(item)) and key is stable between renders.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BaseTable, { ColumnDefinition } from '../BaseTable';
import { FilterConfig } from '../AdvancedFilters';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import { setupStableRandom, teardownStableRandom } from '../../test/utils/determinism';
import '../../i18n/config';

interface IndustryData {
  industry: string;
  count: number;
}

describe('BaseTable - RowKey determinism', () => {
  const columns: ColumnDefinition<IndustryData>[] = [
    { key: 'industry', label: 'Industry', required: true, sortable: true },
    { key: 'count', label: 'Count', defaultVisible: true, sortable: true },
  ];

  const filters: FilterConfig[] = [];

  const renderCell = (item: IndustryData, column: ColumnDefinition<IndustryData>) => {
    if (column.key === 'industry') return item.industry;
    return item.count;
  };

  const data: IndustryData[] = [{ industry: 'Tech', count: 10 }];

  it('uses stable rowKey when item lacks ticker/companyName', () => {
    setupStableRandom(1);
    try {
      const { unmount } = renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={columns}
          filters={filters}
          tableId="rowkey-test"
          renderCell={renderCell}
          searchFields={['industry']}
        />
      );

      const rows = document.querySelectorAll('tr[data-rowkey]');
      expect(rows.length).toBeGreaterThan(0);
      const rowKey1 = rows[0]?.getAttribute('data-rowkey');
      expect(rowKey1).toBeTruthy();

      unmount();

      const { unmount: unmount2 } = renderWithAuth(
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={columns}
          filters={filters}
          tableId="rowkey-test"
          renderCell={renderCell}
          searchFields={['industry']}
        />
      );

      const rows2 = document.querySelectorAll('tr[data-rowkey]');
      const rowKey2 = rows2[0]?.getAttribute('data-rowkey');
      expect(rowKey1).toBe(rowKey2);

      unmount2();
    } finally {
      teardownStableRandom();
    }
  });
});
