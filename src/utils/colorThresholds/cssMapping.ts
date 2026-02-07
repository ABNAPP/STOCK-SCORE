/**
 * Maps ColorType to CSS class strings for ScoreBoardTable.
 */

import type { ColorType } from './types';

export const COLORS = {
  red: 'text-red-700 dark:text-red-400',
  green: 'text-green-700 dark:text-green-200',
  blue: 'text-blue-700 dark:text-blue-400',
  yellow: 'text-yellow-700 dark:text-yellow-300',
} as const;

export interface ColorToCssOptions {
  /** Use yellow for ORANGE (SMA equal case). Default: blue */
  orangeVariant?: 'blue' | 'yellow';
}

/**
 * Maps ColorType to CSS class string. Returns null for BLANK.
 */
export function colorTypeToCssClass(
  color: ColorType,
  options?: ColorToCssOptions
): string | null {
  if (color === 'BLANK') return null;
  if (color === 'GREEN') return COLORS.green;
  if (color === 'RED') return COLORS.red;
  if (color === 'ORANGE') {
    return options?.orangeVariant === 'yellow' ? COLORS.yellow : COLORS.blue;
  }
  return null;
}
