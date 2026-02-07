/**
 * Color classification types for score calculation and UI.
 * Single source of truth for color logic across ScoreBoardTable, calculateScore, calculateScoreDetailed.
 */

/** Color classification for score calculation (GREEN=1.0, ORANGE=0.70, RED=0, BLANK=0) */
export type ColorType = 'GREEN' | 'ORANGE' | 'RED' | 'BLANK';
