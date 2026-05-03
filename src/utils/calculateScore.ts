import { ScoreBoardData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValuesForScore } from '../types/score';
import { calculateDetailedScore } from './calculateScoreDetailed';

/**
 * Calculates the overall stock score (0–100).
 * Same algorithm as {@link calculateDetailedScore} (fundamental 55 + technical 45 = 100 raw weight).
 */
export function calculateScore(
  scoreBoardData: ScoreBoardData,
  benjaminGrahamData: BenjaminGrahamData[],
  entryExitValues: Map<string, EntryExitValuesForScore>
): number {
  return calculateDetailedScore(scoreBoardData, benjaminGrahamData, entryExitValues);
}
