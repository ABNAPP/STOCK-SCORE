import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../test/helpers/renderHelpers';
import Header from '../Header';

describe('Header Snapshot', () => {
  it('should match snapshot', () => {
    const { container } = renderWithProviders(
      <Header
        onMenuToggle={() => {}}
        isMenuOpen={false}
        onNavigate={() => {}}
        onOpenUserProfile={() => {}}
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match snapshot with menu open', () => {
    const { container } = renderWithProviders(
      <Header
        onMenuToggle={() => {}}
        isMenuOpen={true}
        onNavigate={() => {}}
        onOpenUserProfile={() => {}}
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
