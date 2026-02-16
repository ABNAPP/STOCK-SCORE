/**
 * Admin Refresh Helpers
 *
 * Fetch from Apps Script, transform, and write to viewData.
 * Self-contained transformer logic (no imports from client src).
 */

import * as admin from 'firebase-admin';

// Types matching client
type DataRow = Record<string, string | number | undefined>;

interface SnapshotResponse {
  ok: boolean;
  version: number;
  headers: string[];
  rows: Array<{ key: string; values: unknown[] }>;
  generatedAt: string;
  error?: string;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

function getValue(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function getValueAllowZero(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    const value = row[name];
    if (value !== undefined && value !== null) {
      if (value === 0 || value === '0') return '0';
      if (value === '') continue;
      return String(value).trim();
    }
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const val = row[key];
        if (val !== undefined && val !== null) {
          if (val === 0 || val === '0') return '0';
          if (val === '') continue;
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function isValidValue(value: string): boolean {
  if (!value) return false;
  const n = value.trim().toUpperCase();
  return n !== '#N/A' && n !== 'N/A' && n !== '#NUM!' && n !== '#VALUE!' && n !== '#DIV/0!' && n !== '#REF!' && n !== 'LOADING...';
}

function parseNum(s: string): number | null {
  if (!s || typeof s !== 'string' || !isValidValue(s)) return null;
  const cleaned = String(s).replace(/,/g, '.').replace(/\s/g, '').replace(/#/g, '').replace(/%/g, '').replace(/\$/g, '');
  const n = parseFloat(cleaned);
  if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) return null;
  return n;
}

function parsePct(s: string): number | null {
  return parseNum(s);
}

function median(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v) && isFinite(v));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function snapshotToDataRows(snapshot: SnapshotResponse): DataRow[] {
  const dataRows: DataRow[] = [];
  for (const row of snapshot.rows || []) {
    if (!row?.values || !Array.isArray(row.values)) continue;
    const dataRow: DataRow = {};
    (snapshot.headers || []).forEach((h, i) => {
      const v = row.values[i];
      dataRow[h] = v === null || v === undefined || v === '' ? '' : typeof v === 'string' || typeof v === 'number' ? v : String(v);
    });
    dataRows.push(dataRow);
  }
  return dataRows;
}

function transformBenjaminGraham(data: DataRow[]): Array<Record<string, unknown>> {
  return data
    .map((row) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      if (!isValidValue(companyName) || !isValidValue(ticker)) return null;
      return {
        companyName,
        ticker,
        price: parseNum(getValue(['Price', 'price', 'PRICE'], row)),
        benjaminGraham: parseNum(getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row)),
        ivFcf: parseNum(getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row)),
        irr1: parseNum(getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function transformPEIndustry(data: DataRow[]): Array<Record<string, unknown>> {
  const industryMap = new Map<string, { pe: number[]; pe1: number[]; pe2: number[]; count: number }>();
  for (const row of data) {
    const companyName = getValue(['Company Name', 'Company', 'company'], row);
    const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
    const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
    if (!isValidValue(companyName) || !isValidValue(ticker) || !isValidValue(industry)) continue;
    let d = industryMap.get(industry);
    if (!d) {
      d = { pe: [], pe1: [], pe2: [], count: 0 };
      industryMap.set(industry, d);
    }
    d.count++;
    const pe = parseNum(getValue(['P/E', 'P/E', 'pe', 'PE'], row));
    const pe1 = parseNum(getValue(['P/E1', 'P/E 1', 'pe1', 'PE1'], row));
    const pe2 = parseNum(getValue(['P/E2', 'P/E 2', 'pe2', 'PE2'], row));
    if (pe !== null) d.pe.push(pe);
    if (pe1 !== null) d.pe1.push(pe1);
    if (pe2 !== null) d.pe2.push(pe2);
  }
  return Array.from(industryMap.entries())
    .filter(([, d]) => d.count > 0)
    .map(([industry, d]) => ({
      industry,
      pe: median(d.pe),
      pe1: median(d.pe1),
      pe2: median(d.pe2),
      companyCount: d.count,
    }));
}

function transformIndustryThreshold(data: DataRow[]): Array<Record<string, unknown>> {
  return data
    .map((row) => {
      const industry = getValue(['Industry', 'INDUSTRY', 'industry'], row);
      if (!isValidValue(industry)) return null;
      const irr = parseNum(getValue(['IRR', 'irr', 'Irr'], row));
      const leverageF2Min = parseNum(getValue(['Leverage F2 Min', 'Leverage F2 min', 'leverageF2Min', 'leverageF2Min'], row));
      const leverageF2Max = parseNum(getValue(['Leverage F2 Max', 'Leverage F2 max', 'leverageF2Max', 'leverageF2Max'], row));
      const ro40Min = parseNum(getValue(['Ro40 Min', 'Ro40 min', 'ro40Min', 'ro40Min'], row));
      const ro40Max = parseNum(getValue(['Ro40 Max', 'Ro40 max', 'ro40Max', 'ro40Max'], row));
      const cashSdebtMin = parseNum(getValue(['Cash/SDebt Min', 'Cash/SDebt min', 'cashSdebtMin', 'cashSdebtMin'], row));
      const cashSdebtMax = parseNum(getValue(['Cash/SDebt Max', 'Cash/SDebt max', 'cashSdebtMax', 'cashSdebtMax'], row));
      const currentRatioMin = parseNum(getValue(['Current Ratio Min', 'Current Ratio min', 'currentRatioMin', 'currentRatioMin'], row));
      const currentRatioMax = parseNum(getValue(['Current Ratio Max', 'Current Ratio max', 'currentRatioMax', 'currentRatioMax'], row));
      return {
        industry,
        irr: irr ?? 0,
        leverageF2Min: leverageF2Min ?? 0,
        leverageF2Max: leverageF2Max ?? 0,
        ro40Min: ro40Min ?? 0,
        ro40Max: ro40Max ?? 0,
        cashSdebtMin: cashSdebtMin ?? 0,
        cashSdebtMax: cashSdebtMax ?? 0,
        currentRatioMin: currentRatioMin ?? 0,
        currentRatioMax: currentRatioMax ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function transformSMA(data: DataRow[]): Array<Record<string, unknown>> {
  return data
    .map((row) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      if (!isValidValue(companyName) || !isValidValue(ticker)) return null;
      const smaCrossStr = getValue(['SMA Cross', 'SMA Cross', 'sma cross', 'smaCross', 'SMACross', 'SMA CROSS'], row);
      let smaCross: string | null = null;
      if (smaCrossStr?.trim()) {
        const t = smaCrossStr.trim().toUpperCase();
        if (t !== '#N/A' && t !== 'N/A' && t !== '') smaCross = smaCrossStr.trim();
      }
      return {
        companyName,
        ticker,
        sma100: parseNum(getValue(['SMA(100)', 'SMA(100)', 'sma(100)', 'sma100', 'SMA100'], row)),
        sma200: parseNum(getValue(['SMA(200)', 'SMA(200)', 'sma(200)', 'sma200', 'SMA200'], row)),
        smaCross,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function transformScoreBoard(
  data: DataRow[],
  industryPe1Map: Map<string, number>,
  industryPe2Map: Map<string, number>,
  smaDataMap: Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>
): Array<Record<string, unknown>> {
  return data
    .map((row) => {
      const companyName = getValueAllowZero(['Company Name', 'Company', 'company'], row);
      const ticker = getValueAllowZero(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const industryStr = getValueAllowZero(['INDUSTRY', 'Industry', 'industry'], row);
      if (!isValidValue(companyName) || !isValidValue(ticker)) return null;
      const cashSdebtStr = getValueAllowZero(['Cash/SDebt', 'Cash/SDebt', 'cash/sdebt', 'CASH/SDEBT'], row);
      const isDiv0 =
        cashSdebtStr &&
        (cashSdebtStr.trim().toUpperCase() === '#DIV/0!' ||
          cashSdebtStr.trim().toUpperCase() === 'INF' ||
          cashSdebtStr.trim().toUpperCase() === '∞');
      const cashSdebt = parseNum(cashSdebtStr);
      const finalCashSdebt = isDiv0 ? 0 : cashSdebt;
      const pe1 = parseNum(getValueAllowZero(['P/E1', 'P/E 1', 'pe1', 'PE1'], row));
      const pe2 = parseNum(getValueAllowZero(['P/E2', 'P/E 2', 'pe2', 'PE2'], row));
      let pe1Industry: number | null = null;
      let pe2Industry: number | null = null;
      if (isValidValue(industryStr) && pe1 !== null && pe1 > 0) {
        const m = industryPe1Map.get(industryStr.trim().toLowerCase());
        if (m !== undefined && m > 0) pe1Industry = ((pe1 - m) / m) * 100;
      }
      if (isValidValue(industryStr) && pe2 !== null && pe2 > 0) {
        const m = industryPe2Map.get(industryStr.trim().toLowerCase());
        if (m !== undefined && m > 0) pe2Industry = ((pe2 - m) / m) * 100;
      }
      const tickerKey = ticker.toLowerCase().trim();
      const smaMatch = smaDataMap.get(tickerKey);
      return {
        companyName,
        ticker,
        industry: industryStr || '',
        irr: parseNum(getValueAllowZero(['IRR', 'irr', 'Irr'], row)),
        mungerQualityScore: parseNum(getValueAllowZero(['Munger Quality Score', 'Munger Quality Score', 'munger quality score', 'MUNGER QUALITY SCORE'], row)),
        valueCreation: parsePct(getValueAllowZero(['VALUE CREATION', 'Value Creation', 'value creation', 'VALUE_CREATION'], row)),
        tbSPrice: parseNum(getValueAllowZero(['(TB/S)/Price', '(TB/S)/Price', '(tb/s)/price', '(TB/S)/PRICE'], row)),
        ro40Cy: parsePct(getValueAllowZero(['Ro40 CY', 'Ro40 CY', 'ro40 cy', 'RO40 CY'], row)),
        ro40F1: parsePct(getValueAllowZero(['Ro40 F1', 'Ro40 F1', 'ro40 f1', 'RO40 F1'], row)),
        ro40F2: parsePct(getValueAllowZero(['Ro40 F2', 'Ro40 F2', 'ro40 f2', 'RO40 F2'], row)),
        leverageF2: parseNum(getValueAllowZero(['Leverage F2', 'Leverage F2', 'leverage f2', 'LEVERAGE F2'], row)),
        currentRatio: parseNum(getValueAllowZero(['Current Ratio', 'Current Ratio', 'current ratio', 'CURRENT RATIO'], row)),
        cashSdebt: finalCashSdebt,
        isCashSdebtDivZero: !!isDiv0,
        pe1Industry,
        pe2Industry,
        sma100: smaMatch?.sma100 ?? null,
        sma200: smaMatch?.sma200 ?? null,
        smaCross: smaMatch?.smaCross ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export interface RefreshResult {
  viewId: string;
  rows: number;
  source: string;
  wroteViewData: boolean;
  wroteAppCache: boolean;
  durationMs: number;
}

const VIEWIDS_FROM_SHEETS = ['score', 'score-board', 'entry-exit-benjamin-graham', 'fundamental-pe-industry', 'industry-threshold'] as const;
const VIEWID_TO_SHEET: Record<string, string> = {
  'industry-threshold': 'IndustryThreshold',
};
const CACHE_KEYS: Record<string, string> = {
  'score-board': 'scoreBoard',
  'score': 'scoreBoard',
  'entry-exit-benjamin-graham': 'benjaminGraham',
  'fundamental-pe-industry': 'peIndustry',
  'industry-threshold': 'industryThreshold',
};

export async function fetchAppsScriptSnapshot(
  baseUrl: string,
  token: string | undefined,
  sheetName: string
): Promise<SnapshotResponse> {
  const usePost = !!token;
  const url = usePost ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}action=snapshot&sheet=${encodeURIComponent(sheetName)}`;
  // Apps Script Web App cannot read request headers; token MUST be in body for
  // direct Cloud Function->Apps Script calls. Client->Proxy uses header-only.
  // Body required: Apps Script cannot read headers.
  const init: RequestInit = usePost
    ? {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', sheet: sheetName, token }),
      }
    : { method: 'GET', headers: { Accept: 'application/json' } };
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script fetch failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as SnapshotResponse;
  if (!json?.ok) {
    throw new Error(json?.error || 'Apps Script returned error');
  }
  return json;
}

export async function runAdminRefresh(
  baseUrl: string,
  token: string | undefined,
  viewIds: string[],
  adminUid: string,
  migrationMode: 'dual-write' | 'dual-read' | 'cutover',
  dryRun: boolean
): Promise<{ refreshed: RefreshResult[]; errors: string[] }> {
  const refreshed: RefreshResult[] = [];
  const errors: string[] = [];
  const db = admin.firestore();

  const effectiveViewIds = viewIds.length > 0
    ? viewIds.filter((id) => VIEWIDS_FROM_SHEETS.includes(id as (typeof VIEWIDS_FROM_SHEETS)[number]))
    : [...VIEWIDS_FROM_SHEETS];

  let dashboardSnapshot: SnapshotResponse | null = null;
  let smaSnapshot: SnapshotResponse | null = null;

  for (const viewId of effectiveViewIds) {
    const start = Date.now();
    try {
      if (viewId === 'score' || viewId === 'score-board') {
        if (!dashboardSnapshot) {
          dashboardSnapshot = await fetchAppsScriptSnapshot(baseUrl, token, 'DashBoard');
        }
        if (!smaSnapshot) {
          try {
            smaSnapshot = await fetchAppsScriptSnapshot(baseUrl, token, 'SMA');
          } catch (e) {
            errors.push(`SMA fetch failed: ${e instanceof Error ? e.message : String(e)}`);
            smaSnapshot = { ok: true, version: 0, headers: [], rows: [], generatedAt: new Date().toISOString() };
          }
        }
        const dashData = snapshotToDataRows(dashboardSnapshot);
        const peData = transformPEIndustry(dashData);
        const smaData = transformSMA(snapshotToDataRows(smaSnapshot));
        const industryPe1Map = new Map<string, number>();
        const industryPe2Map = new Map<string, number>();
        for (const p of peData as Array<{ industry: string; pe1?: number | null; pe2?: number | null }>) {
          if (p.pe1 != null) industryPe1Map.set(p.industry.toLowerCase(), p.pe1);
          if (p.pe2 != null) industryPe2Map.set(p.industry.toLowerCase(), p.pe2);
        }
        const smaDataMap = new Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>();
        for (const s of smaData as Array<{ ticker: string; sma100?: number | null; sma200?: number | null; smaCross?: string | null }>) {
          smaDataMap.set(s.ticker.toLowerCase().trim(), {
            sma100: s.sma100 ?? null,
            sma200: s.sma200 ?? null,
            smaCross: s.smaCross ?? null,
          });
        }
        const scoreBoard = transformScoreBoard(dashData, industryPe1Map, industryPe2Map, smaDataMap);
        const payload = { scoreBoard };
        if (!dryRun) {
          const now = Date.now();
          const doc = {
            data: payload,
            timestamp: now,
            ttl: DEFAULT_TTL_MS,
            schemaVersion: 1,
            source: 'adminRefreshCache',
            updatedBy: adminUid,
          };
          await db.collection('viewData').doc(viewId).set(doc, { merge: false });
          if (migrationMode !== 'cutover' && viewId === 'score-board') {
            await db.collection('appCache').doc('scoreBoard').set(
              {
                data: scoreBoard,
                timestamp: now,
                ttl: DEFAULT_TTL_MS,
                version: dashboardSnapshot.version,
                lastSnapshotAt: now,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: false }
            );
          }
        }
        refreshed.push({
          viewId,
          rows: scoreBoard.length,
          source: 'adminRefreshCache',
          wroteViewData: !dryRun,
          wroteAppCache: !dryRun && migrationMode !== 'cutover' && viewId === 'score-board',
          durationMs: Date.now() - start,
        });
      } else if (viewId === 'entry-exit-benjamin-graham') {
        if (!dashboardSnapshot) {
          dashboardSnapshot = await fetchAppsScriptSnapshot(baseUrl, token, 'DashBoard');
        }
        const dashData = snapshotToDataRows(dashboardSnapshot);
        const benjaminGraham = transformBenjaminGraham(dashData);
        const payload = { benjaminGraham };
        if (!dryRun) {
          const now = Date.now();
          await db.collection('viewData').doc(viewId).set(
            {
              data: payload,
              timestamp: now,
              ttl: DEFAULT_TTL_MS,
              schemaVersion: 1,
              source: 'adminRefreshCache',
              updatedBy: adminUid,
            },
            { merge: false }
          );
          if (migrationMode !== 'cutover') {
            await db.collection('appCache').doc('benjaminGraham').set(
              {
                data: benjaminGraham,
                timestamp: now,
                ttl: DEFAULT_TTL_MS,
                version: dashboardSnapshot.version,
                lastSnapshotAt: now,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: false }
            );
          }
        }
        refreshed.push({
          viewId,
          rows: benjaminGraham.length,
          source: 'adminRefreshCache',
          wroteViewData: !dryRun,
          wroteAppCache: !dryRun && migrationMode !== 'cutover',
          durationMs: Date.now() - start,
        });
      } else if (viewId === 'fundamental-pe-industry') {
        if (!dashboardSnapshot) {
          dashboardSnapshot = await fetchAppsScriptSnapshot(baseUrl, token, 'DashBoard');
        }
        const dashData = snapshotToDataRows(dashboardSnapshot);
        const peIndustry = transformPEIndustry(dashData);
        const payload = { peIndustry };
        if (!dryRun) {
          const now = Date.now();
          await db.collection('viewData').doc(viewId).set(
            {
              data: payload,
              timestamp: now,
              ttl: DEFAULT_TTL_MS,
              schemaVersion: 1,
              source: 'adminRefreshCache',
              updatedBy: adminUid,
            },
            { merge: false }
          );
          if (migrationMode !== 'cutover') {
            await db.collection('appCache').doc('peIndustry').set(
              {
                data: peIndustry,
                timestamp: now,
                ttl: DEFAULT_TTL_MS,
                version: dashboardSnapshot.version,
                lastSnapshotAt: now,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: false }
            );
          }
        }
        refreshed.push({
          viewId,
          rows: peIndustry.length,
          source: 'adminRefreshCache',
          wroteViewData: !dryRun,
          wroteAppCache: !dryRun && migrationMode !== 'cutover',
          durationMs: Date.now() - start,
        });
      } else if (viewId === 'industry-threshold') {
        const sheetName = VIEWID_TO_SHEET['industry-threshold'] ?? 'IndustryThreshold';
        const thresholdSnapshot = await fetchAppsScriptSnapshot(baseUrl, token, sheetName);
        const thresholdData = snapshotToDataRows(thresholdSnapshot);
        const industryThreshold = transformIndustryThreshold(thresholdData);
        if (!dryRun) {
          const now = Date.now();
          await db.collection('viewData').doc('industry-threshold').set(
            {
              data: { industryThreshold },
              timestamp: now,
              ttl: DEFAULT_TTL_MS,
              schemaVersion: 1,
              source: 'adminRefreshCache',
              updatedBy: adminUid,
            },
            { merge: true }
          );
          if (migrationMode !== 'cutover') {
            await db.collection('appCache').doc(CACHE_KEYS['industry-threshold']).set(
              {
                data: industryThreshold,
                timestamp: now,
                ttl: DEFAULT_TTL_MS,
                version: thresholdSnapshot.version,
                lastSnapshotAt: now,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: false }
            );
          }
        }
        refreshed.push({
          viewId,
          rows: industryThreshold.length,
          source: 'adminRefreshCache',
          wroteViewData: !dryRun,
          wroteAppCache: !dryRun && migrationMode !== 'cutover',
          durationMs: Date.now() - start,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${viewId}: ${msg}`);
    }
  }

  return { refreshed, errors };
}
