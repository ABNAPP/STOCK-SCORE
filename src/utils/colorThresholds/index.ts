/**
 * Centralized color logic and thresholds.
 * Single source of truth for ScoreBoardTable, calculateScore, calculateScoreDetailed.
 */

export type { ColorType } from './types';
export * from './colorLogic';
export * from './theoEntryLogic';
export { COLORS, colorTypeToCssClass } from './cssMapping';
export type { ColorToCssOptions } from './cssMapping';
