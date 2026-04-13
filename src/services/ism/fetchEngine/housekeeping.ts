import { ISM_HISTORY_TARGET_DAYS } from './constants';
import { addCalendarDays } from './dateUtils';

/**
 * Rolling ~5-year OHLC window (calendar-day approximation).
 * When bar storage exists, a separate housekeeping pass should drop rows older than this date
 * so the dataset stays aligned with bootstrap coverage; the fetch motor only walks chunks
 * backward to the same horizon.
 */
export function rollingHistoryHorizonOldestIso(todayIso: string): string {
  return addCalendarDays(todayIso, -(ISM_HISTORY_TARGET_DAYS - 1));
}
