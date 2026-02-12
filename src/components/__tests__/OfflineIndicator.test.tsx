/**
 * OfflineIndicator tests: shows correct text when offline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../i18n/config';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import OfflineIndicator from '../OfflineIndicator';

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

import { useOnlineStatus } from '../../hooks/useOnlineStatus';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.mocked(useOnlineStatus).mockReturnValue(true);
  });

  it('returns null when online', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('shows offline text when useOnlineStatus returns false', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    render(<OfflineIndicator />);
    expect(screen.getByText(/offline\.indicator|Offline.*data kan vara inaktuell|Offline.*data may be outdated/i)).toBeInTheDocument();
  });
});
