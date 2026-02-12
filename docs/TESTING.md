# Test Guide

## Quick Start

- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration`
- **All tests**: `npm run test`
- **Coverage**: `npm run test:coverage`

## Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner |
| **React Testing Library** | Component testing |
| **jsdom** | DOM environment |
| **@testing-library/jest-dom** | DOM matchers |

Setup file: `src/test/setup.ts`

## Determinism

Tests use deterministic utilities to avoid flakiness:

- **FixedClock** (`src/test/utils/determinism.ts`): `withFixedClock(fn)` or `setupFixedClock()` freezes time to 2020-01-01T00:00:00.000Z
- **StableRandom**: `setupStableRandom(seed)` mocks `Math.random` with a seeded generator
- **StableIntl**: `setupStableIntl()` sets `process.env.TZ = 'UTC'` for consistent date formatting
- **LocalStorage**: `seedLocalStorage({...})` and `readLocalStorageKeys(prefix)` for storage tests

## Test Wrappers

Use `renderWithAppProviders` for full provider tree:

```tsx
import { renderWithAppProviders } from '../test/helpers/renderHelpers';

renderWithAppProviders(<MyComponent />, {
  userRole: 'viewer',
  allowedViews: ['score-board'],
  initialPath: '/',
  loadedShareableLink: mockLink,
});
```

### Auth Mocking

- `userRole`: `'admin'` \| `'viewer'` \| `null`
- `allowedViews`: string[] for viewer permissions
- `user`: Firebase User (default: mock user)

## Writing New Tests

1. Use `renderWithAppProviders` or `renderWithAuth` for components needing providers
2. Use `setupFixedClock()` / `setupStableRandom()` when time or random affects behavior
3. Use `withLoggerCapture(fn)` to assert on log output
4. Mock Firebase/Firestore via `vi.mock` or `vi.spyOn`

## Regression Guards

- **RBAC**: `src/contexts/__tests__/rbac.integration.test.tsx`
- **Migration cutover**: `src/services/__tests__/firestoreCacheService.test.ts`
- **Refresh Cloud Function**: `src/contexts/__tests__/RefreshContext.integration.test.tsx`
- **BaseTable rowKey**: `src/components/__tests__/BaseTable.rowKey.test.tsx`
- **Token redaction**: `src/utils/__tests__/logger.test.ts`

## Nya/ändrade filer

- `src/test/setup.ts` — Vitest setup, jest-dom, localStorage-mock
- `src/test/utils/determinism.ts` — FixedClock, StableRandom, StableIntl, logger-capture för deterministiska tester
- `src/test/helpers/renderHelpers.tsx` — renderWithAppProviders, setAuth, renderWithAuth
- `src/contexts/__tests__/rbac.integration.test.tsx` — RBAC viewData, handleViewChange-blockering
- `src/services/__tests__/shareableLinkService.test.ts` — ShareableLink schemaVersion/snapshot back-compat
- `src/services/__tests__/firestoreCacheService.test.ts` — Migration cutover-regression
- `src/contexts/__tests__/RefreshContext.integration.test.tsx` — Refresh Cloud Function
- `src/components/__tests__/BaseTable.integration.test.tsx` — BaseTable rowKey, filters, export, deterministisk data
- `src/components/__tests__/BaseTable.rowKey.test.tsx` — rowKey-regression
- `src/components/__tests__/BaseTable.filters.test.tsx` — Filter-regression
- `src/components/__tests__/BaseTable.export.test.tsx` — Export-regression
- `src/components/__tests__/BaseTableToolbar.snapshot.test.tsx` — Toolbar-snapshot
- `src/contexts/__tests__/ShareableHydrationContext.test.tsx` — Shareable hydration
- `src/utils/__tests__/logger.test.ts` — Token redaction regression
