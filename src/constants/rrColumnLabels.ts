/** User-visible labels for return columns; data keys remain irr1 (sheet) and rr2 (derived). */
export type RrColumnKey = 'irr1' | 'rr2';

export const RR_COLUMN_LABELS: Record<RrColumnKey, string> = {
  irr1: 'RR T1',
  rr2: 'RR T2',
};
