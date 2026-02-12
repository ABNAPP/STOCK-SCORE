/**
 * Regression: virtual scroll must render unique rows when rowId (getRowKey) collides.
 * Without domKey fix, React reuses DOM and the same row appears on every visible slot.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BaseTable, { ColumnDefinition } from '../BaseTable';
import { FilterConfig } from '../AdvancedFilters';
import { renderWithProviders } from '../../test/helpers/renderHelpers';
import { setupStableRandom, teardownStableRandom } from '../../test/utils/determinism';
import '../../i18n/config';

interface DuplicateRowIdData {
  ticker: string;
  companyName: string;
  antal: number;
}

describe('BaseTable - Virtual scroll unique keys', () => {
  beforeEach(() => setupStableRandom(1));
  afterEach(() => teardownStableRandom());

  const columns: ColumnDefinition<DuplicateRowIdData>[] = [
    { key: 'ticker', label: 'Ticker', required: true, sortable: true },
    { key: 'companyName', label: 'Company', required: true, sortable: true },
    { key: 'antal', label: 'Antal', defaultVisible: true, sortable: true },
  ];

  const filters: FilterConfig[] = [];

  const renderCell = (item: DuplicateRowIdData, column: ColumnDefinition<DuplicateRowIdData>) => {
    switch (column.key) {
      case 'ticker':
        return item.ticker;
      case 'companyName':
        return item.companyName;
      case 'antal':
        return item.antal;
      default:
        return null;
    }
  };

  it('renders distinct rows when getRowKey is non-unique (virtual scroll uses domKey)', () => {
    // Same ticker+companyName for all rows => same rowId => without domKey all would get same React key
    const data: DuplicateRowIdData[] = Array.from({ length: 20 }, (_, i) => ({
      ticker: 'SAME',
      companyName: 'Same Co',
      antal: i + 1,
    }));

    const { container } = renderWithProviders(
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <BaseTable
          data={data}
          loading={false}
          error={null}
          columns={columns}
          filters={filters}
          tableId="virtual-keys-test"
          renderCell={renderCell}
          searchFields={['ticker', 'companyName']}
          enableVirtualScroll
          virtualScrollRowHeight={40}
          virtualScrollOverscan={5}
          getRowKey={(item) => `${item.ticker}-${item.companyName}`}
        />
      </div>
    );

    const dataRows = container.querySelectorAll('tbody tr[data-rowkey]');
    expect(dataRows.length).toBeGreaterThan(0);

    // Each row has 3 cells (ticker, companyName, antal). Antal is the 3rd column -> last td
    const antalValues = Array.from(dataRows).map((row) => {
      const cells = row.querySelectorAll('td');
      const antalCell = cells[cells.length - 1];
      return antalCell ? antalCell.textContent?.trim() : '';
    });

    const uniqueAntalValues = [...new Set(antalValues)];
    // If keys collided we would see the same antal on every row; with domKey we see distinct rows
    expect(uniqueAntalValues.length).toBeGreaterThan(1);
  });
});
