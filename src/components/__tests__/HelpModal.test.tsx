/**
 * HelpModal tests: sections, "Denna vy", open/close.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import HelpModal from '../HelpModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'help.title': 'Help',
        'help.thisView': 'This view',
        'help.sections.conditions.title': 'What does Conditions mean?',
        'help.sections.filters.title': 'How filtering works',
        'help.sections.score.title': 'How Score & breakdown works',
        'help.sections.shareExport.title': 'Share and Export',
        'helpThisView.score-board': 'Detailed table with all metrics.',
        'helpThisView.default': 'Table view with search, filters and sorting.',
        'help.close': 'Close',
        'aria.closeModal': 'Close modal',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('HelpModal', () => {
  it('does not render when isOpen is false', () => {
    render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders all 4 sections when open', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('What does Conditions mean?')).toBeInTheDocument();
    expect(screen.getByText('How filtering works')).toBeInTheDocument();
    expect(screen.getByText('How Score & breakdown works')).toBeInTheDocument();
    expect(screen.getByText('Share and Export')).toBeInTheDocument();
  });

  it('renders "Denna vy" section with viewId-specific content when viewId provided', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} viewId="score-board" />);
    expect(screen.getByText('This view')).toBeInTheDocument();
    expect(screen.getByText('Detailed table with all metrics.')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    screen.getByText('Close').click();
    expect(onClose).toHaveBeenCalled();
  });
});
