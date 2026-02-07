import { describe, it, expect } from 'vitest';
import { colorTypeToCssClass, COLORS } from '../cssMapping';

describe('colorThresholds cssMapping', () => {
  describe('colorTypeToCssClass', () => {
    it('returns green for GREEN', () => {
      expect(colorTypeToCssClass('GREEN')).toBe(COLORS.green);
    });
    it('returns red for RED', () => {
      expect(colorTypeToCssClass('RED')).toBe(COLORS.red);
    });
    it('returns blue for ORANGE by default', () => {
      expect(colorTypeToCssClass('ORANGE')).toBe(COLORS.blue);
    });
    it('returns yellow for ORANGE when orangeVariant=yellow', () => {
      expect(colorTypeToCssClass('ORANGE', { orangeVariant: 'yellow' })).toBe(COLORS.yellow);
    });
    it('returns null for BLANK', () => {
      expect(colorTypeToCssClass('BLANK')).toBeNull();
    });
  });
});
