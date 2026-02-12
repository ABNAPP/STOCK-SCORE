/**
 * ApiKeysModal tests: isOpen, inputs, save flow, onClose.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApiKeysModal from '../ApiKeysModal';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import type { ApiKeys } from '../../config/apiKeys';
import '../../i18n/config';

const mockGetApiKeysForDisplay = vi.fn();
vi.mock('../../config/apiKeys', () => ({
  getApiKeysForDisplay: () => mockGetApiKeysForDisplay(),
}));

describe('ApiKeysModal', () => {
  beforeEach(() => {
    mockGetApiKeysForDisplay.mockReturnValue({
      eodhd: '',
      marketstack: '',
      finnhub: '',
      alphaVantage: '',
    } as ApiKeys);
  });

  it('A) isOpen=false renders null / nothing in document', () => {
    const { container } = renderWithAuth(
      <ApiKeysModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('B) isOpen=true shows inputs for EODHD, MarketStack, Finnhub, Alpha Vantage', () => {
    renderWithAuth(
      <ApiKeysModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('EODHD')).toBeInTheDocument();
    expect(screen.getByText('MarketStack')).toBeInTheDocument();
    expect(screen.getByText('FINNHUB')).toBeInTheDocument();
    expect(screen.getByText('Alpha Vantage')).toBeInTheDocument();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
  });

  it('C) changing a field updates state', async () => {
    const user = userEvent.setup();
    renderWithAuth(
      <ApiKeysModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
    );
    const inputs = screen.getAllByRole('textbox');
    const eodhdInput = inputs[0];
    await user.type(eodhdInput, 'test-key');
    expect(eodhdInput).toHaveValue('test-key');
  });

  it('D) clicking Spara calls onSave with keys payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithAuth(
      <ApiKeysModal isOpen={true} onClose={vi.fn()} onSave={onSave} />
    );
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'my-eodhd-key');
    const saveButton = screen.getByRole('button', { name: /Spara|Save/i });
    await user.click(saveButton);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ eodhd: 'my-eodhd-key' })
      );
    });
  });

  it('E) while saving, button is disabled and shows Sparar…', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void;
    const onSave = vi.fn().mockImplementation(
      () => new Promise<void>((r) => { resolveSave = r; })
    );
    renderWithAuth(
      <ApiKeysModal isOpen={true} onClose={vi.fn()} onSave={onSave} />
    );
    const saveButton = screen.getByRole('button', { name: /Spara|Save/i });
    await user.click(saveButton);
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
      expect(screen.getByText(/Sparar|Saving/i)).toBeInTheDocument();
    });
    resolveSave!();
  });

  it('F) after save promise resolves, onClose is called', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithAuth(
      <ApiKeysModal isOpen={true} onClose={onClose} onSave={onSave} />
    );
    const saveButton = screen.getByRole('button', { name: /Spara|Save/i });
    await user.click(saveButton);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
