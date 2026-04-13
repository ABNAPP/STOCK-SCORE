import { describe, it, expect } from 'vitest';
import {
  parseTickerParts,
  normalizeTicker,
  buildSymbolId,
  isSameIsmSymbol,
  matchDashBoardToEntryExit,
  compareIsmToLegacyKey,
  slugifySymbolSegment,
} from '../tickerIdentity';

describe('ism tickerIdentity', () => {
  describe('slugifySymbolSegment', () => {
    it('lowercases and maps hyphen to underscore', () => {
      expect(slugifySymbolSegment('ALLIGO-B')).toBe('alligo_b');
    });
  });

  describe('buildSymbolId (spec examples)', () => {
    it('NYSE:BAX -> nyse_bax', () => {
      expect(buildSymbolId('NYSE:BAX')).toBe('nyse_bax');
    });
    it('NASDAQ:LULU -> nasdaq_lulu', () => {
      expect(buildSymbolId('NASDAQ:LULU')).toBe('nasdaq_lulu');
    });
    it('STO:ALLIGO-B -> sto_alligo_b', () => {
      expect(buildSymbolId('STO:ALLIGO-B')).toBe('sto_alligo_b');
    });
    it('MMM -> unknown_mmm', () => {
      expect(buildSymbolId('MMM')).toBe('unknown_mmm');
    });
    it('nyse:bax casing -> nyse_bax', () => {
      expect(buildSymbolId('nyse:bax')).toBe('nyse_bax');
    });
  });

  describe('normalizeTicker', () => {
    it('returns exchange:symbol slugs', () => {
      expect(normalizeTicker('NYSE:BAX')).toBe('nyse:bax');
      expect(normalizeTicker('MMM')).toBe('unknown:mmm');
    });
  });

  describe('parseTickerParts', () => {
    it('preserves tickerRaw without trimming', () => {
      const raw = '  MMM  ';
      const p = parseTickerParts(raw);
      expect(p.tickerRaw).toBe('  MMM  ');
      expect(p.symbolId).toBe('unknown_mmm');
      expect(p.needsReview).toBe(false);
    });

    it('flags needsReview for empty after trim', () => {
      const p = parseTickerParts('   ');
      expect(p.needsReview).toBe(true);
      expect(p.symbolId).toBe('unknown_empty');
    });

    it('flags needsReview for :MMM (missing exchange)', () => {
      const p = parseTickerParts(':MMM');
      expect(p.needsReview).toBe(true);
      expect(p.exchange).toBe('unknown');
      expect(p.symbolId).toBe('unknown_mmm');
    });

    it('flags needsReview for NYSE: (missing symbol)', () => {
      const p = parseTickerParts('NYSE:');
      expect(p.needsReview).toBe(true);
      expect(p.symbolId).toBe('nyse_empty');
    });

    it('flags needsReview when symbol contains extra colon', () => {
      const p = parseTickerParts('NYSE:BRK:B');
      expect(p.needsReview).toBe(true);
      expect(p.symbolId).toBe('nyse_brk_b');
    });

    it('flags needsReview for invalid exchange characters', () => {
      const p = parseTickerParts('NY-SE:BAX');
      expect(p.needsReview).toBe(true);
      expect(p.symbolId).toBe('ny_se_bax');
    });
  });

  describe('isSameIsmSymbol / matchDashBoardToEntryExit / compareIsmToLegacyKey', () => {
    it('matches same exchange ticker', () => {
      expect(isSameIsmSymbol('NYSE:BAX', 'nyse:bax')).toBe(true);
    });
    it('matches plain ticker to itself', () => {
      expect(compareIsmToLegacyKey('MMM', 'MMM')).toBe(true);
    });
    it('does not match different symbols', () => {
      expect(matchDashBoardToEntryExit('MMM', 'LULU')).toBe(false);
    });
    it('matches NYSE:MMM with MMM under unknown slug', () => {
      expect(isSameIsmSymbol('NYSE:MMM', 'MMM')).toBe(false);
    });
  });
});
