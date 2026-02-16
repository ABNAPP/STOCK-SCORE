import type { ViewId } from '../types/navigation';

/**
 * Maps a view ID to its corresponding table metadata ID.
 * Single source of truth for viewId → tableId used by App, Header, and ConditionsSidebar.
 */
export function getTableId(viewId: ViewId): string | null {
  if (viewId === 'score-board') return 'score-board';
  if (viewId === 'score') return 'score';
  if (viewId === 'entry-exit-benjamin-graham') return 'benjamin-graham';
  if (viewId === 'fundamental-pe-industry') return 'pe-industry';
  if (viewId === 'industry-threshold') return 'industry-threshold';
  if (viewId === 'personal-portfolio') return 'personal-portfolio';
  return null;
}

/** Alias for getTableId; use when the view→table mapping intent should be explicit. */
export const getTableIdForView = getTableId;
