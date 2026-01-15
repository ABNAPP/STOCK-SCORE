import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../test/helpers/renderHelpers';
import AdvancedFilters, { FilterConfig } from '../AdvancedFilters';

describe('AdvancedFilters Snapshot', () => {
  const mockFilters: FilterConfig[] = [
    { key: 'companyName', label: 'Company Name', type: 'text' },
    { key: 'score', label: 'Score', type: 'numberRange', min: 0, max: 100 },
    { key: 'industry', label: 'Industry', type: 'select', options: [
      { value: 'Technology', label: 'Technology' },
      { value: 'Finance', label: 'Finance' },
    ]},
  ];

  const mockValues = {
    companyName: 'Test',
    score: { min: 50, max: 100 },
    industry: 'Technology',
  };

  it('should match snapshot when closed', () => {
    const { container } = renderWithProviders(
      <AdvancedFilters
        filters={mockFilters}
        values={mockValues}
        onChange={() => {}}
        onClear={() => {}}
        tableId="test-table"
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
