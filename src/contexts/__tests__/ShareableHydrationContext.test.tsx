import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import {
  ShareableHydrationProvider,
  useShareableHydration,
} from '../ShareableHydrationContext';
import type { ShareableLink } from '../../services/shareableLinkService';

const mockLink: ShareableLink = {
  id: 'test-link-id',
  schemaVersion: 1,
  filterState: { score: { min: 50, max: 100 } },
  viewId: 'score',
  tableId: 'score',
  createdAt: new Date(),
  createdBy: 'user-1',
};

const mockLinkWithFullState: ShareableLink = {
  ...mockLink,
  columnFilters: { industry: { columnKey: 'industry', type: 'values', selectedValues: ['Tech'] } },
  searchValue: 'foo',
  sortConfig: { key: 'score', direction: 'desc' as const },
};

function TestConsumer() {
  const { link, consume } = useShareableHydration();
  return (
    <div>
      <span data-testid="link-exists">{link ? 'yes' : 'no'}</span>
      <button onClick={consume}>Consume</button>
    </div>
  );
}

function HydrationConsumer({ viewId, tableId }: { viewId: string; tableId: string }) {
  const { link, consume } = useShareableHydration();
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (link && link.viewId === viewId && link.tableId === tableId && !applied) {
      setApplied(true);
      consume();
    }
  }, [link, viewId, tableId, consume, applied]);

  return <span data-testid="applied">{applied ? 'yes' : 'no'}</span>;
}

describe('ShareableHydrationContext', () => {
  it('provides link to consumers', () => {
    render(
      <ShareableHydrationProvider link={mockLink} onConsume={() => {}}>
        <TestConsumer />
      </ShareableHydrationProvider>
    );

    expect(screen.getByTestId('link-exists')).toHaveTextContent('yes');
  });

  it('consume() triggers onConsume callback (one-shot)', () => {
    const onConsume = vi.fn();

    render(
      <ShareableHydrationProvider link={mockLink} onConsume={onConsume}>
        <TestConsumer />
      </ShareableHydrationProvider>
    );

    expect(onConsume).not.toHaveBeenCalled();
    act(() => {
      screen.getByText('Consume').click();
    });
    expect(onConsume).toHaveBeenCalledTimes(1);
  });

  it('useShareableHydration returns default when outside provider', () => {
    render(<TestConsumer />);

    expect(screen.getByTestId('link-exists')).toHaveTextContent('no');
  });

  it('hydration one-shot: consume() called exactly once when view applies initial state', () => {
    const onConsume = vi.fn();
    let currentLink: ShareableLink | null = mockLinkWithFullState;

    const { rerender } = render(
      <ShareableHydrationProvider
        link={currentLink}
        onConsume={() => {
          onConsume();
          currentLink = null;
        }}
      >
        <HydrationConsumer viewId="score" tableId="score" />
      </ShareableHydrationProvider>
    );

    expect(screen.getByTestId('applied')).toHaveTextContent('yes');
    expect(onConsume).toHaveBeenCalledTimes(1);

    rerender(
      <ShareableHydrationProvider
        link={currentLink}
        onConsume={() => {
          onConsume();
          currentLink = null;
        }}
      >
        <HydrationConsumer viewId="score" tableId="score" />
      </ShareableHydrationProvider>
    );

    expect(onConsume).toHaveBeenCalledTimes(1);
  });
});
