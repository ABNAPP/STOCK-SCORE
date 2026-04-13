import type { ParsedSectorIndexDaily } from '../../services/ism/dailySector/readSectorIndexDaily';

export type IsmSectorChartPoint = {
  date: string;
  sectorIndex: number | null;
  rs: number | null;
  histogram: number | null;
  sectorBase100: number | null;
  /** Derived from official index_value + rs_value (same window anchor); not persisted in Firestore. */
  spyBase100: number | null;
};

export type IsmSectorChartRow = IsmSectorChartPoint & Record<string, number | null>;

export function dailyRowsToChartPoints(rows: ParsedSectorIndexDaily[]): IsmSectorChartPoint[] {
  const base: IsmSectorChartPoint[] = rows
    .filter((r) => r.trade_date)
    .map((r) => ({
      date: r.trade_date!,
      sectorIndex: r.index_value,
      rs: r.rs_value,
      histogram: r.histogram_value,
      sectorBase100: r.index_base_100,
      spyBase100: null,
    }));
  const i0 = base.findIndex(
    (p) => p.sectorIndex != null && p.rs != null && p.sectorIndex > 0 && Math.abs(p.rs as number) > 1e-9
  );
  if (i0 < 0) return base;
  const I0 = base[i0]!.sectorIndex!;
  const rs0 = base[i0]!.rs!;
  return base.map((p) => {
    if (p.sectorIndex == null || p.rs == null || p.sectorIndex <= 0 || Math.abs(p.rs) < 1e-9) {
      return { ...p, spyBase100: null };
    }
    const spyB = 100 * (p.sectorIndex / I0) * (rs0 / p.rs);
    return { ...p, spyBase100: Number.isFinite(spyB) ? spyB : null };
  });
}

/** First chart date that has a stock close defines base 100 for that symbol in this window. */
export function attachStockColumns(
  points: IsmSectorChartPoint[],
  stocks: { symbolId: string; closeByDate: Map<string, number> }[]
): IsmSectorChartRow[] {
  const anchors = new Map<string, { c0: number }>();
  for (const { symbolId, closeByDate } of stocks) {
    const anchorDate = points.map((p) => p.date).find((d) => closeByDate.has(d));
    if (!anchorDate) continue;
    const c0 = closeByDate.get(anchorDate);
    if (c0 != null && Number.isFinite(c0) && Math.abs(c0) > 1e-12) anchors.set(symbolId, { c0 });
  }

  return points.map((p) => {
    const row: IsmSectorChartRow = { ...p };
    for (const { symbolId, closeByDate } of stocks) {
      const key = `stockBase100_${symbolId}`;
      const a = anchors.get(symbolId);
      if (!a) {
        row[key] = null;
        continue;
      }
      const c = closeByDate.get(p.date);
      row[key] = c != null && Number.isFinite(c) ? (100 * c) / a.c0 : null;
    }
    return row;
  });
}
