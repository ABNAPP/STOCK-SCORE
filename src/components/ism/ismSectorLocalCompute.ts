import type { IsmSectorChartPoint } from './ismSectorChartModel';
import type { IsmLocalParamSettings } from './ismSectorLocalAnalysisDefaults';

export function smaSeriesAtIndices(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (length < 1) return out;
  for (let i = length - 1; i < values.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = i - length + 1; j <= i; j++) {
      const v = values[j];
      if (v == null || !Number.isFinite(v)) {
        s = NaN;
        break;
      }
      s += v;
      c++;
    }
    out[i] = !Number.isFinite(s) || c !== length ? null : s / length;
  }
  return out;
}

function risingAtSeries(series: (number | null)[], lookback: number): boolean | null {
  const n = series.length;
  if (n < 2) return null;
  const lb = Math.min(lookback, n - 1);
  if (lb < 1) return null;
  const a = series[n - 1];
  const b = series[n - 1 - lb];
  if (a == null || b == null) return null;
  return a > b;
}

export type LocalSeriesSnapshot = {
  sectorSmaLast: number | null;
  sectorAboveSma: boolean | null;
  sectorSmaRising: boolean | null;
  rsMaLast: number | null;
  rsAboveMa: boolean | null;
  rsMaRising: boolean | null;
  histogramLocalLast: number | null;
  breadthConfirmedLocal: boolean | null;
};

export function computeLocalSeriesSnapshot(
  points: IsmSectorChartPoint[],
  latestOfficialBreadthPct: number | null,
  p: IsmLocalParamSettings
): LocalSeriesSnapshot {
  const empty: LocalSeriesSnapshot = {
    sectorSmaLast: null,
    sectorAboveSma: null,
    sectorSmaRising: null,
    rsMaLast: null,
    rsAboveMa: null,
    rsMaRising: null,
    histogramLocalLast: null,
    breadthConfirmedLocal: null,
  };
  if (points.length === 0) return empty;

  const idx = points.map((x) => x.sectorIndex);
  const rs = points.map((x) => x.rs);
  const sectorSma = smaSeriesAtIndices(idx, p.sectorSmaLength);
  const rsMa = smaSeriesAtIndices(rs, p.rsMaLength);
  const n = points.length;
  const last = n - 1;
  const idxLast = idx[last];
  const secS = sectorSma[last];
  const rsLast = rs[last];
  const rsMaL = rsMa[last];

  const sectorAboveSma =
    idxLast != null && secS != null && Number.isFinite(idxLast) && Number.isFinite(secS) ? idxLast > secS : null;

  const sectorSmaRising = risingAtSeries(sectorSma, Math.min(p.slopeLookback, Math.max(1, n - 1)));

  const rsAboveMa =
    rsLast != null && rsMaL != null && Number.isFinite(rsLast) && Number.isFinite(rsMaL) ? rsLast > rsMaL : null;

  const rsMaRising = risingAtSeries(rsMa, Math.min(p.slopeLookback, Math.max(1, n - 1)));

  const histogramLocalLast =
    rsLast != null && rsMaL != null && Number.isFinite(rsLast) && Number.isFinite(rsMaL) ? rsLast - rsMaL : null;

  const breadthConfirmedLocal =
    latestOfficialBreadthPct != null && Number.isFinite(latestOfficialBreadthPct)
      ? latestOfficialBreadthPct >= p.breadthThreshold
      : null;

  return {
    sectorSmaLast: secS,
    sectorAboveSma,
    sectorSmaRising,
    rsMaLast: rsMaL,
    rsAboveMa,
    rsMaRising,
    histogramLocalLast,
    breadthConfirmedLocal,
  };
}

/** Chart row enrichments from local params (detail-only). */
export function enrichPointsWithLocalSeries(
  points: IsmSectorChartPoint[],
  p: IsmLocalParamSettings
): (IsmSectorChartPoint & { sectorSmaLocal?: number | null; rsMaLocal?: number | null; histogramLocal?: number | null })[] {
  const idx = points.map((x) => x.sectorIndex);
  const rs = points.map((x) => x.rs);
  const sectorSma = smaSeriesAtIndices(idx, p.sectorSmaLength);
  const rsMa = smaSeriesAtIndices(rs, p.rsMaLength);
  return points.map((row, i) => {
    const rml = rsMa[i];
    const rsv = rs[i];
    const histL =
      rsv != null && rml != null && Number.isFinite(rsv) && Number.isFinite(rml) ? rsv - rml : null;
    return {
      ...row,
      sectorSmaLocal: sectorSma[i],
      rsMaLocal: rsMa[i],
      histogramLocal: histL,
    };
  });
}
