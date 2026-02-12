/**
 * ShareableLink payload schemaVersion/back-compat.
 * Verifies serialize/deserialize and defaulting for optional fields.
 */

import { describe, it, expect } from 'vitest';
import {
  SHAREABLE_LINK_SCHEMA_VERSION,
  generateShareableUrl,
} from '../shareableLinkService';
import type { ShareableLink } from '../shareableLinkService';

describe('ShareableLink schemaVersion/back-compat', () => {
  it('has expected schema version', () => {
    expect(SHAREABLE_LINK_SCHEMA_VERSION).toBe(1);
  });

  it('minimal link structure - optional columnFilters, searchValue, sortConfig', () => {
    const minimal: ShareableLink = {
      id: 'min-1',
      schemaVersion: 1,
      filterState: {},
      viewId: 'score',
      tableId: 'score',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      createdBy: 'user-1',
    };

    expect(minimal.columnFilters).toBeUndefined();
    expect(minimal.searchValue).toBeUndefined();
    expect(minimal.sortConfig).toBeUndefined();

    const serialized = JSON.stringify(minimal);
    const parsed = JSON.parse(serialized) as ShareableLink;

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.viewId).toBe('score');
    expect(parsed.tableId).toBe('score');
    expect(parsed.columnFilters).toBeUndefined();
    expect(parsed.searchValue).toBeUndefined();
    expect(parsed.sortConfig).toBeUndefined();
  });

  it('full link structure with optional fields', () => {
    const full: ShareableLink = {
      id: 'full-1',
      schemaVersion: 1,
      filterState: { score: { min: 50, max: 100 } },
      viewId: 'score',
      tableId: 'score',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      createdBy: 'user-1',
      columnFilters: {
        industry: {
          columnKey: 'industry',
          type: 'values',
          selectedValues: ['Tech'],
        },
      },
      searchValue: 'foo',
      sortConfig: { key: 'score', direction: 'desc' },
    };

    const serialized = JSON.stringify(full);
    const parsed = JSON.parse(serialized) as ShareableLink;

    expect(parsed.columnFilters).toEqual(full.columnFilters);
    expect(parsed.searchValue).toBe('foo');
    expect(parsed.sortConfig).toEqual({ key: 'score', direction: 'desc' });
  });

  it('serialize/deserialize schema snapshot for back-compat', () => {
    const link: ShareableLink = {
      id: 'snap-1',
      schemaVersion: SHAREABLE_LINK_SCHEMA_VERSION,
      filterState: { score: { min: 50, max: 100 } },
      viewId: 'score-board',
      tableId: 'score-board',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      createdBy: 'user-1',
      columnFilters: {
        industry: {
          columnKey: 'industry',
          type: 'values',
          selectedValues: ['Tech'],
        },
      },
      searchValue: 'bar',
      sortConfig: { key: 'score', direction: 'desc' },
    };

    const serialized = JSON.stringify(link);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    const snapshot = {
      schemaVersion: parsed.schemaVersion,
      viewId: parsed.viewId,
      tableId: parsed.tableId,
      filterState: parsed.filterState,
      columnFilters: parsed.columnFilters,
      searchValue: parsed.searchValue ?? '',
      sortConfig: parsed.sortConfig,
    };

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "columnFilters": {
          "industry": {
            "columnKey": "industry",
            "selectedValues": [
              "Tech",
            ],
            "type": "values",
          },
        },
        "filterState": {
          "score": {
            "max": 100,
            "min": 50,
          },
        },
        "schemaVersion": 1,
        "searchValue": "bar",
        "sortConfig": {
          "direction": "desc",
          "key": "score",
        },
        "tableId": "score-board",
        "viewId": "score-board",
      }
    `);
  });

  it('generateShareableUrl produces correct format', () => {
    const url = generateShareableUrl('abc123');
    expect(url).toMatch(/\/share\/abc123$/);
  });
});
