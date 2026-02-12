/**
 * OnboardingHelp tests: first-time flow, completion, localStorage namespace.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { render } from '@testing-library/react';
import OnboardingHelp from '../OnboardingHelp';
import { AuthContext } from '../../contexts/AuthContext';
import type { AuthContextType } from '../../contexts/AuthContext';
import { createMockFirebaseUser } from '../../test/fixtures/mockFirebase';
import { getStorageKey } from '../../hooks/useOnboarding';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'sv' } }),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

const mockAuthValue: AuthContextType = {
  currentUser: createMockFirebaseUser({ uid: 'test-uid' }),
  userRole: 'viewer',
  viewerPermissions: { allowedViews: ['score'] },
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  refreshUserRole: vi.fn(),
};

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthValue}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('OnboardingHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders onboarding when isOpen is true', () => {
    renderWithAuth(<OnboardingHelp isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/onboarding\.step1\.title|Välkommen|Welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/onboarding\.skip|Hoppa över|Skip/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWithAuth(<OnboardingHelp isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText(/onboarding\.step1\.title|Välkommen|Welcome/i)).not.toBeInTheDocument();
  });

  it('Skip button calls onClose', async () => {
    const onClose = vi.fn();
    renderWithAuth(<OnboardingHelp isOpen={true} onClose={onClose} />);
    const skipButton = screen.getByText(/onboarding\.skip|Hoppa över|Skip/i);
    await act(async () => {
      skipButton.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Done sets onboardingCompleted in localStorage for correct key', async () => {
    renderWithAuth(<OnboardingHelp isOpen={true} onClose={() => {}} />);
    const key = getStorageKey('test-uid');
    expect(localStorage.getItem(key)).not.toBe('true');

    // Click through to last step - each click must be in its own act for state updates
    for (let i = 0; i < 4; i++) {
      const nextButton = screen.getByText(/onboarding\.next|Nästa|Next/i);
      await act(async () => {
        nextButton.click();
      });
    }

    // Last step: button says onboarding.done (t returns key as-is when mocked)
    const doneButton = screen.getByText('onboarding.done');
    await act(async () => {
      doneButton.click();
    });

    expect(localStorage.getItem(key)).toBe('true');
  });

  it('onboarding does not show again after completion when re-rendered', async () => {
    const { unmount } = renderWithAuth(<OnboardingHelp isOpen={true} onClose={() => {}} />);
    for (let i = 0; i < 4; i++) {
      const nextButton = screen.getByText(/onboarding\.next|Nästa|Next/i);
      await act(async () => {
        nextButton.click();
      });
    }
    const doneButton = screen.getByText('onboarding.done');
    await act(async () => {
      doneButton.click();
    });

    unmount();

    // Re-render without external control - component uses internal state
    renderWithAuth(<OnboardingHelp />);
    // Onboarding should not auto-show because isCompleted is true
    expect(screen.queryByText(/onboarding\.step1\.title|Välkommen|Welcome/i)).not.toBeInTheDocument();
  });
});
