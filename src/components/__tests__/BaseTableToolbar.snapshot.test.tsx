/**
 * BaseTable toolbar snapshot - small, stable snapshot of toolbar state.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BaseTableToolbar from '../BaseTableToolbar';
import { setupStableRandom, teardownStableRandom } from '../../test/utils/determinism';
import '../../i18n/config';

describe('BaseTableToolbar snapshot', () => {
  it('toolbar with active filter and column filters', () => {
    setupStableRandom(1);
    try {
      const { container } = render(
        <BaseTableToolbar
          searchValue="test"
          onSearchChange={() => {}}
          totalRows={100}
          filteredRows={25}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'value', label: 'Value' },
          ]}
          columnVisibility={{ name: true, value: true }}
          onToggleColumn={() => {}}
          onShowAll={() => {}}
          onHideAll={() => {}}
          onResetToDefaults={() => {}}
          isColumnVisible={() => true}
          enableExport={true}
          sortedRowCount={25}
          onExportCsv={() => {}}
          onExportExcel={() => {}}
          enablePrint={true}
          onPrint={() => {}}
          enableShareableLink={true}
          hasCurrentUser={true}
          viewId="score"
          onOpenShareableLink={() => {}}
        />
      );

      const toolbar = container.querySelector('.border-b');
      expect(toolbar).toBeTruthy();
      expect(toolbar?.textContent).toMatchSnapshot();
    } finally {
      teardownStableRandom();
    }
  });
});
