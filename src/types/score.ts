/**
 * Types used by score calculation (utils/calculateScore).
 * Kept separate from contexts so domain logic does not depend on React context types.
 */

export interface EntryExitValuesForScore {
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  currency: string;
  dateOfUpdate: string | null;
}
