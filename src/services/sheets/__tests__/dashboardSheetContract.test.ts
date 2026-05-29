import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_CONSUMER_FIELDS,
  DASHBOARD_ISM_SECTOR_COLUMNS,
  DASHBOARD_INDUSTRY_KEY_COLUMNS,
  dashboardRowHasKnownHeaders,
} from '../dashboardSheetContract';

describe('dashboardSheetContract', () => {
  it('exposes disjoint ISM vs industry-key column sets', () => {
    const ism = new Set(DASHBOARD_ISM_SECTOR_COLUMNS);
    const industry = new Set(DASHBOARD_INDUSTRY_KEY_COLUMNS);
    expect(ism.size).toBeGreaterThan(0);
    expect(industry.size).toBeGreaterThan(ism.size);
    for (const h of ism) {
      expect(industry.has(h)).toBe(true);
    }
  });

  it('lists consumers for each pipeline', () => {
    expect(DASHBOARD_CONSUMER_FIELDS.scoreBoard.length).toBeGreaterThan(5);
    expect(DASHBOARD_CONSUMER_FIELDS.benjaminGraham).toContain('entryF1');
    expect(DASHBOARD_CONSUMER_FIELDS.peIndustry).toContain('pe1');
    expect(DASHBOARD_CONSUMER_FIELDS.ismIngest).toContain('sectorIsm');
  });

  it('dashboardRowHasKnownHeaders detects alias keys', () => {
    expect(dashboardRowHasKnownHeaders({ 'Company Name': 'Acme' })).toBe(true);
    expect(dashboardRowHasKnownHeaders({ 'SECTOR (ISM)': 'Tech' })).toBe(true);
    expect(dashboardRowHasKnownHeaders({ 'Unknown': 'x' })).toBe(false);
  });
});
