/**
 * Calendar labelling for weekly ISM rebalance (America/New_York).
 * Scheduling “after US close on Friday” is done by the caller; this returns the NY **Friday** date string.
 */

/** YYYY-MM-DD of the calendar day in America/New_York for instant `d`. */
export function nyCalendarDateIso(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Walks backward up to 10 days to find the most recent Friday in America/New_York.
 * Suitable right after Friday’s close (still “Friday” in NY) or on the weekend.
 */
export function isoLastCompletedFridayAmericaNewYork(d: Date): string {
  let probe = new Date(d.getTime());
  for (let i = 0; i < 10; i++) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(probe);
    if (wd === 'Friday') {
      return probe.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    }
    probe = new Date(probe.getTime() - 86400000);
  }
  return nyCalendarDateIso(d);
}
