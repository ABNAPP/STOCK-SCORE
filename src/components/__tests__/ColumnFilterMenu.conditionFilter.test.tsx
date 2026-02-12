/**
 * ColumnFilterMenu: condition filter must not clear when value is 0 or "0".
 * Bug: !value || value === '' treated 0 as empty and called onFilterChange(null).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColumnFilterMenu from '../ColumnFilterMenu';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import type { SortConfig } from '../../hooks/useTableSort';
import type { UniqueValue } from '../../hooks/useColumnUniqueValues';
import '../../i18n/config';

const defaultSortConfig: SortConfig<Record<string, unknown>> = {
  key: 'score',
  direction: 'asc',
};
const defaultUniqueValues: UniqueValue[] = [];

describe('ColumnFilterMenu - condition filter value 0', () => {
  it('value 0 does not clear filter - onFilterChange receives condition object not null', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { container } = renderWithAuth(
      <ColumnFilterMenu
        columnKey="score"
        columnLabel="Score"
        isOpen={true}
        onClose={() => {}}
        filter={{
          columnKey: 'score',
          type: 'condition',
          conditionOperator: 'equals',
          conditionValue: 0,
        }}
        onFilterChange={onFilterChange}
        sortConfig={defaultSortConfig}
        onSort={() => {}}
        uniqueValues={defaultUniqueValues}
      />
    );

    // Expand "Filtrera efter villkor" so the select is visible
    const filterByConditionButton = screen.getByRole('menuitem', { name: /Filtrera efter villkor/i });
    await user.click(filterByConditionButton);

    // Change operator in select; this passes filter.conditionValue (0) to handleConditionChange
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
    if (select) {
      await user.selectOptions(select, 'greaterThan');
    }

    // With the fix: onFilterChange must be called with condition object (not null)
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columnKey: 'score',
        type: 'condition',
        conditionOperator: 'greaterThan',
        conditionValue: 0,
      })
    );
    expect(onFilterChange).not.toHaveBeenCalledWith(null);
  });

  it('string "0" does not clear filter when set via input', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { container } = renderWithAuth(
      <ColumnFilterMenu
        columnKey="score"
        columnLabel="Score"
        isOpen={true}
        onClose={() => {}}
        filter={undefined}
        onFilterChange={onFilterChange}
        sortConfig={defaultSortConfig}
        onSort={() => {}}
        uniqueValues={defaultUniqueValues}
      />
    );

    const filterByConditionButton = screen.getByRole('menuitem', { name: /Filtrera efter villkor/i });
    await user.click(filterByConditionButton);

    const valueInput = container.querySelector('input[placeholder="Värde..."]');
    expect(valueInput).toBeTruthy();
    if (valueInput) {
      await user.type(valueInput, '0');
    }

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columnKey: 'score',
        type: 'condition',
        conditionValue: '0',
      })
    );
    expect(onFilterChange).not.toHaveBeenCalledWith(null);
  });
});
