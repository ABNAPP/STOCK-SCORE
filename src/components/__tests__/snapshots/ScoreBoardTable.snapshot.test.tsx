import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ScoreBoardTable from '../ScoreBoardTable';
import { createMockScoreBoardData } from '../../../test/helpers';
import { renderWithProviders } from '../../../test/helpers/renderHelpers';

describe('ScoreBoardTable Snapshot', () => {
  const mockData = [
    createMockScoreBoardData({ companyName: 'Company A', ticker: 'A', score: 75 }),
    createMockScoreBoardData({ companyName: 'Company B', ticker: 'B', score: 80 }),
  ];

  it('should match snapshot', () => {
    const { container } = renderWithProviders(
      <ScoreBoardTable data={mockData} loading={false} error={null} />
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot when loading', () => {
    const { container } = renderWithProviders(
      <ScoreBoardTable data={[]} loading={true} error={null} />
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with error', () => {
    const { container } = renderWithProviders(
      <ScoreBoardTable data={[]} loading={false} error="Error message" />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
