/**
 * RBAC integration tests: viewData read enforcement (client-side gate).
 * Verifies that viewer with limited allowedViews cannot access unauthorized views.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import '../../i18n/config';
import { renderWithAppProviders } from '../../test/helpers/renderHelpers';
import App from '../../App';
import Sidebar from '../../components/Sidebar';
import ShareableView from '../../components/views/ShareableView';
import * as shareableLinkService from '../../services/shareableLinkService';

const mockOnViewChange = vi.fn();
const mockOnOpenConditionsModal = vi.fn();
const mockOnLoadLink = vi.fn();

describe('RBAC: viewData read enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PROD', 'false');
    vi.stubEnv('DEV', 'true');
  });

  it('Sidebar hides menypunkt when viewer lacks allowedViews for viewId', () => {
    renderWithAppProviders(
      <Sidebar
        activeView="score"
        onViewChange={mockOnViewChange}
        onOpenConditionsModal={mockOnOpenConditionsModal}
        isOpen={true}
        onClose={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      />,
      {
        userRole: 'viewer',
        allowedViews: ['score-board'],
        initialPath: '/',
      }
    );

    // Viewer has score-board but NOT fundamental-pe-industry
    expect(screen.queryByText(/PE Industry|Pe Industry/i)).not.toBeInTheDocument();
  });

  it('setAuth updates auth and UI re-renders (C2)', async () => {
    const { setAuth } = renderWithAppProviders(
      <Sidebar
        activeView="score"
        onViewChange={mockOnViewChange}
        onOpenConditionsModal={mockOnOpenConditionsModal}
        isOpen={true}
        onClose={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      />,
      {
        userRole: 'admin',
        allowedViews: undefined,
        initialPath: '/',
        exposeSetAuth: true,
      }
    );

    expect(screen.getByText(/P\/E|PE Industry|Pe Industry/i)).toBeInTheDocument();

    await act(async () => {
      setAuth({ role: 'viewer', allowedViews: ['score-board'] });
    });

    expect(screen.queryByText(/PE Industry|Pe Industry/i)).not.toBeInTheDocument();
  });

  it('Sidebar shows menypunkt when viewer has allowedViews for viewId', () => {
    renderWithAppProviders(
      <Sidebar
        activeView="score"
        onViewChange={mockOnViewChange}
        onOpenConditionsModal={mockOnOpenConditionsModal}
        isOpen={true}
        onClose={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      />,
      {
        userRole: 'viewer',
        allowedViews: ['score-board', 'fundamental-pe-industry'],
        initialPath: '/',
      }
    );

    expect(screen.getByText(/P\/E|PE Industry|Pe Industry/i)).toBeInTheDocument();
  });

  it('ShareableView redirects and does not call onLoadLink when viewer lacks access', async () => {
    vi.spyOn(shareableLinkService, 'loadShareableLink').mockResolvedValue({
      id: 'test-link-123',
      schemaVersion: 1,
      filterState: {},
      viewId: 'fundamental-pe-industry',
      tableId: 'pe-industry',
      createdAt: new Date('2020-01-01'),
      createdBy: 'user-1',
    });

    renderWithAppProviders(
      <Routes>
        <Route path="/share/:linkId" element={<ShareableView onLoadLink={mockOnLoadLink} />} />
      </Routes>,
      {
        userRole: 'viewer',
        allowedViews: ['score-board'],
        initialPath: '/share/test-link-123',
      }
    );

    await waitFor(
      () => {
        expect(mockOnLoadLink).not.toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('handleViewChange blocks switch to disallowed view', async () => {
    renderWithAppProviders(<App />, {
      userRole: 'viewer',
      allowedViews: ['score-board'],
      initialPath: '/score-board',
    });

    await waitFor(
      () => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const testApi = (window as Window & { __STOCK_SCORE_TEST__?: { handleViewChange: (v: string) => void } })
      .__STOCK_SCORE_TEST__;
    expect(testApi?.handleViewChange).toBeDefined();

    await act(async () => {
      testApi!.handleViewChange('fundamental-pe-industry');
    });

    await waitFor(
      () => {
        expect(
          screen.getByText(/Du har inte tillgång|You do not have access|tillgång till denna vy/i)
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(screen.queryByText(/PE Industry|Pe Industry/i)).not.toBeInTheDocument();
  });

  it('direct URL to unauthorized view redirects and shows toast', async () => {
    renderWithAppProviders(<App />, {
      userRole: 'viewer',
      allowedViews: ['score-board'],
      initialPath: '/fundamental-pe-industry',
    });

    await waitFor(
      () => {
        expect(screen.getByText(/Du har inte tillgång|You do not have access|tillgång till denna vy/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    await waitFor(
      () => {
        expect(screen.getByText(/SCORE BOARD|Score Board/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
