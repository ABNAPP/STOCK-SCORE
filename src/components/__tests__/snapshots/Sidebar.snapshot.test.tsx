import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../test/helpers/renderHelpers';
import Sidebar from '../Sidebar';

describe('Sidebar Snapshot', () => {
  it('should match snapshot', () => {
    const { container } = renderWithProviders(
      <Sidebar
        activeView="score"
        onViewChange={() => {}}
        onOpenConditionsModal={() => {}}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot when closed', () => {
    const { container } = renderWithProviders(
      <Sidebar
        activeView="score"
        onViewChange={() => {}}
        onOpenConditionsModal={() => {}}
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
