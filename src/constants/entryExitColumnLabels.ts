/** User-visible column labels; data keys remain entry1–exit2. */
export type EntryExitFieldKey = 'entry1' | 'entry2' | 'exit1' | 'exit2';

export const ENTRY_EXIT_COLUMN_LABELS: Record<EntryExitFieldKey, string> = {
  entry1: 'ENTRY T1',
  entry2: 'ENTRY T2',
  exit1: 'EXIT T1',
  exit2: 'EXIT T2',
};
