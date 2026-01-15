import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../test/helpers/renderHelpers';
import EntryExitTable from '../EntryExitTable';
import { createMockEntryExitData } from '../../../test/helpers';

describe('EntryExitTable Snapshot', () => {
  const mockData = [
    createMockEntryExitData({ companyName: 'Company A', ticker: 'A', entry1: 100, exit1: 150 }),
    createMockEntryExitData({ companyName: 'Company B', ticker: 'B', entry1: 200, exit1: 250 }),
  ];

  it('should match snapshot', () => {
    const { container } = renderWithProviders(
      <EntryExitTable data={mockData} loading={false} error={null} />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
