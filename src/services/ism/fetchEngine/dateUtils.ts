/** ISO YYYY-MM-DD in UTC (date-only math at noon UTC avoids DST issues). */
export function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoTodayUtc(): string {
  return isoDateUtc(new Date());
}

export function addCalendarDays(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return isoDateUtc(d);
}

export function daysInclusive(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00.000Z`).getTime();
  const b = new Date(`${toIso}T12:00:00.000Z`).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}
