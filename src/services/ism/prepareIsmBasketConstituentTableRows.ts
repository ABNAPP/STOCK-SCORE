import type { IsmBasketConstituentTableRow } from '../../types/ismBasketConstituentTableRow';

/** One row from the active weekly rebalance snapshot (subset used for basket table prep). */
export type IsmBasketConstituentSnapshotRow = {
  symbol_id: string;
  ticker_raw: string;
  company_name: string;
  synthetic_shares: number;
  last_close: number | null;
};

/** Subset of local analysis params that affect per-name SMA / breadth math. */
export type IsmBasketTableLocalSmaParams = {
  sectorSmaLength: number;
  slopeLookback: number;
};

/** Oldest → newest closes from a date → close map. */
export function closesAscendingFromDailyMap(m: Map<string, number>): number[] {
  const entries = [...m.entries()].filter(([, v]) => Number.isFinite(v) && v > 0);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([, v]) => v);
}

function smaSeries(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (length < 1) return out;
  for (let i = length - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - length + 1; j <= i; j++) s += values[j]!;
    out[i] = s / length;
  }
  return out;
}

function latestPxForRow(c: IsmBasketConstituentSnapshotRow, closes: number[] | null): number | null {
  if (closes && closes.length > 0) {
    const v = closes[closes.length - 1]!;
    if (Number.isFinite(v) && v > 0) return v;
  }
  if (c.last_close != null && Number.isFinite(c.last_close) && c.last_close > 0) return c.last_close;
  return null;
}

export type PrepareIsmBasketConstituentTableRowsInput = {
  constituents: IsmBasketConstituentSnapshotRow[];
  closeBySymbolId: Map<string, Map<string, number>>;
  localParams: IsmBasketTableLocalSmaParams;
  selectedSymbolIds: readonly string[];
};

/**
 * Builds one row per official basket constituent. Breadth math mirrors `computeDailySectorIndex`
 * (price vs own SMA, SMA slope, cap-weighted denominator), and uses local SMA length / slope lookback
 * for per-name technical fields. Basket list and synthetic_shares come from callers' snapshot rows only.
 */
export function prepareIsmBasketConstituentTableRows(input: PrepareIsmBasketConstituentTableRowsInput): IsmBasketConstituentTableRow[] {
  const { constituents, closeBySymbolId, localParams, selectedSymbolIds } = input;
  const selected = new Set(selectedSymbolIds);
  const smaLen = localParams.sectorSmaLength;
  const look = localParams.slopeLookback;

  const latestPxById = new Map<string, number | null>();
  const closesById = new Map<string, number[] | null>();

  for (const c of constituents) {
    const map = closeBySymbolId.get(c.symbol_id);
    const closes = map ? closesAscendingFromDailyMap(map) : null;
    closesById.set(c.symbol_id, closes);
    latestPxById.set(c.symbol_id, latestPxForRow(c, closes));
  }

  let weightDen = 0;
  const rawW = new Map<string, number>();
  for (const c of constituents) {
    const px = latestPxById.get(c.symbol_id);
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    const w = px * c.synthetic_shares;
    if (!Number.isFinite(w) || w <= 0) continue;
    rawW.set(c.symbol_id, w);
    weightDen += w;
  }

  type BreadthScratch = {
    w: number;
    breadthEligible: boolean;
    priceVsSmaPct: number | null;
    smaSlopeRising: boolean | null;
    inBreadth: boolean | null;
  };

  const scratch = new Map<string, BreadthScratch>();
  let breadthDen = 0;

  for (const c of constituents) {
    const w = rawW.get(c.symbol_id);
    if (w == null || w <= 0) {
      scratch.set(c.symbol_id, {
        w: 0,
        breadthEligible: false,
        priceVsSmaPct: null,
        smaSlopeRising: null,
        inBreadth: null,
      });
      continue;
    }

    const closes = closesById.get(c.symbol_id);
    const px = latestPxById.get(c.symbol_id);
    if (!closes || closes.length < smaLen + look + 1 || px == null) {
      scratch.set(c.symbol_id, {
        w,
        breadthEligible: false,
        priceVsSmaPct: null,
        smaSlopeRising: null,
        inBreadth: null,
      });
      continue;
    }

    const smaSeriesArr = smaSeries(closes, smaLen);
    const smaNow = smaSeriesArr[closes.length - 1];
    const smaPast = smaSeriesArr[closes.length - 1 - look];
    const priceVsSmaPct =
      smaNow != null && Number.isFinite(smaNow) && smaNow > 0 ? (px / smaNow - 1) * 100 : null;
    const smaSlopeRising =
      smaNow != null && smaPast != null && Number.isFinite(smaNow) && Number.isFinite(smaPast) ? smaNow > smaPast : null;
    const priceOk = smaNow != null && px > smaNow;
    const risingOk = smaNow != null && smaPast != null && smaNow > smaPast;
    const inBreadth = priceOk && risingOk;

    breadthDen += w;

    scratch.set(c.symbol_id, {
      w,
      breadthEligible: true,
      priceVsSmaPct,
      smaSlopeRising,
      inBreadth,
    });
  }

  const rows: IsmBasketConstituentTableRow[] = constituents.map((c) => {
    const w = rawW.get(c.symbol_id);
    const currentWeightPct =
      w != null && weightDen > 0 && Number.isFinite(w) ? (w / weightDen) * 100 : null;

    const s = scratch.get(c.symbol_id)!;
    let breadthContributionPct: number | null = null;
    if (s.breadthEligible) {
      breadthContributionPct = breadthDen > 0 && s.inBreadth === true ? (s.w / breadthDen) * 100 : 0;
    }

    return {
      symbol_id: c.symbol_id,
      ticker_raw: c.ticker_raw,
      company_name: c.company_name,
      currentWeightPct,
      priceVsSmaPct: s.priceVsSmaPct,
      smaSlopeRising: s.smaSlopeRising,
      inBreadth: s.inBreadth,
      breadthContributionPct,
      isSelected: selected.has(c.symbol_id),
    };
  });

  rows.sort((a, b) => {
    const wa = a.currentWeightPct;
    const wb = b.currentWeightPct;
    if (wa == null && wb == null) return a.ticker_raw.localeCompare(b.ticker_raw);
    if (wa == null) return 1;
    if (wb == null) return -1;
    if (wb !== wa) return wb - wa;
    return a.ticker_raw.localeCompare(b.ticker_raw);
  });

  return rows;
}
