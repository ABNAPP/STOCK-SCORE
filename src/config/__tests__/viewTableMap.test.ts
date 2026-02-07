import { describe, it, expect } from 'vitest';
import { getTableId } from '../viewTableMap';
import { getTableMetadata } from '../tableMetadata';
import type { ViewId } from '../../types/navigation';

describe('viewTableMap', () => {
  describe('getTableId', () => {
    it('maps score-board to score-board', () => {
      expect(getTableId('score-board' as ViewId)).toBe('score-board');
    });

    it('maps score to score', () => {
      expect(getTableId('score' as ViewId)).toBe('score');
    });

    it('maps entry-exit-benjamin-graham to benjamin-graham', () => {
      expect(getTableId('entry-exit-benjamin-graham' as ViewId)).toBe('benjamin-graham');
    });

    it('maps fundamental-pe-industry to pe-industry', () => {
      expect(getTableId('fundamental-pe-industry' as ViewId)).toBe('pe-industry');
    });

    it('maps threshold-industry to threshold-industry', () => {
      expect(getTableId('threshold-industry' as ViewId)).toBe('threshold-industry');
    });

    it('maps personal-portfolio to personal-portfolio', () => {
      expect(getTableId('personal-portfolio' as ViewId)).toBe('personal-portfolio');
    });

    it('personal-portfolio has metadata for ConditionsModal (no null)', () => {
      const tableId = getTableId('personal-portfolio' as ViewId);
      expect(tableId).toBe('personal-portfolio');
      const metadata = getTableMetadata(tableId!);
      expect(metadata).toBeDefined();
      expect(metadata?.tableId).toBe('personal-portfolio');
    });

    it('returns null for admin', () => {
      expect(getTableId('admin' as ViewId)).toBeNull();
    });

    it('returns null for other ViewIds without table mapping', () => {
      expect(getTableId('entry-exit-entry2' as ViewId)).toBeNull();
      expect(getTableId('fundamental-current-ratio' as ViewId)).toBeNull();
    });
  });
});
