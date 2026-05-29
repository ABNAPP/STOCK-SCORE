export type EodAdjustedDailyRangePreset = '5y' | '1y' | 'ytd' | 'mtd';

export type EodAdjustedDailyPricePoint = { date: string; price: number };

/** Parse YYYY-MM-DD as local calendar date (noon) for safe calendar math. */
function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/**
 * First calendar date (inclusive) for the preset, relative to the last bar date `endIso`.
 */
export function rangeFromIsoForPreset(endIso: string, preset: EodAdjustedDailyRangePreset): string | null {
  const end = parseIsoDateLocal(endIso);
  if (!end) return null;

  if (preset === 'ytd') {
    return `${end.getFullYear()}-01-01`;
  }
  if (preset === 'mtd') {
    const mo = String(end.getMonth() + 1).padStart(2, '0');
    return `${end.getFullYear()}-${mo}-01`;
  }
  if (preset === '1y') {
    const from = new Date(end);
    from.setFullYear(from.getFullYear() - 1);
    return toIsoLocal(from);
  }
  if (preset === '5y') {
    const from = new Date(end);
    from.setFullYear(from.getFullYear() - 5);
    return toIsoLocal(from);
  }
  return null;
}

/** Oldest→newest input; returns points with date >= range start for preset (by last bar in series). */
export function filterEodPointsByPreset(
  points: EodAdjustedDailyPricePoint[],
  preset: EodAdjustedDailyRangePreset
): EodAdjustedDailyPricePoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const endIso = sorted[sorted.length - 1]!.date;
  const fromIso = rangeFromIsoForPreset(endIso, preset);
  if (fromIso == null) return sorted;
  return sorted.filter((p) => p.date >= fromIso);
}
