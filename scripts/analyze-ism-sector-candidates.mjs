/**
 * Fetches the live DashBoard Google Sheet (CSV export) and reports which rows are
 * candidates for ISM sector assignment, using the same column contract as ISM ingest.
 *
 * With `--sector`, also reads Firestore (active rebalance basket, symbols, EOD cache)
 * and explains why sheet rows do or do not appear as index constituents.
 * Requires: `npm run build --prefix functions` and Application Default Credentials.
 *
 * Usage:
 *   npm run analyze:ism-candidates
 *   npm run analyze:ism-candidates -- --sector Mining
 *   npm run analyze:ism-candidates -- --json --sector Mining
 *   npm run analyze:ism-candidates -- --out docs/ism-sector-candidates-report.md --sector Mining
 *   npm run analyze:ism-candidates -- --sector Mining --skip-firestore
 *
 * See docs/ism-sheet-to-sector-index.md for the full pipeline.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'functions', 'package.json'));

/** Same gate as ISM_MIN_HISTORY_DAYS_FOR_QUALIFIED in src/types/ismSymbolDocument.ts */
const ISM_MIN_HISTORY_DAYS = 300;
/** Same as ISM_HISTORY_TARGET_DAYS in src/services/ism/fetchEngine/constants.ts */
const ISM_HISTORY_TARGET_DAYS = 5 * 365;

const DASHBOARD_SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE';
const DASHBOARD_GID = '1180885830';
const DASHBOARD_CSV_URL = `https://docs.google.com/spreadsheets/d/${DASHBOARD_SHEET_ID}/export?format=csv&gid=${DASHBOARD_GID}`;

const COMPANY_COLUMNS = ['Company Name', 'Company', 'company'];
const TICKER_COLUMNS = ['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'];
const ISM_SECTOR_COLUMNS = ['SECTOR (ISM)', 'Sector (ISM)', 'sector (ism)'];
const INDUSTRY_COLUMNS = ['INDUSTRY', 'Industry', 'industry'];
const MARKET_CAP_COLUMNS = [
  'Market Cap',
  'Market cap',
  'MARKET CAP',
  'MarketCap',
  'marketcap',
  'MARKET_CAP',
  'MarketCap.',
];
const DATE_UPDATE_COLUMNS = [
  'Date of Update',
  'date of update',
  'DATE OF UPDATE',
  'Date of update',
  'DATE_OF_UPDATE',
];

const EXCHANGE_PART_OK = /^[a-zA-Z0-9]+$/;

function parseArgs(argv) {
  const opts = { json: false, out: null, sector: null, skipFirestore: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--skip-firestore') opts.skipFirestore = true;
    else if (a === '--out' && argv[i + 1]) opts.out = path.resolve(root, argv[++i]);
    else if (a === '--sector' && argv[i + 1]) opts.sector = argv[++i].trim();
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 20).join('\n'));
      process.exit(0);
    } else {
      console.error('Unknown argument:', a);
      process.exit(1);
    }
  }
  return opts;
}

function readDefaultProjectId() {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
    return rc?.projects?.default ?? process.env.GCLOUD_PROJECT ?? null;
  } catch {
    return process.env.GCLOUD_PROJECT ?? null;
  }
}

/** Mirrors buildSymbolId in src/utils/ism/tickerIdentity.ts */
function buildSymbolId(ticker) {
  const trimmed = ticker.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) return `unknown_${slugifySegment(trimmed)}`;
  const ex = slugifySegment(trimmed.slice(0, colonIdx));
  const sym = slugifySegment(trimmed.slice(colonIdx + 1));
  return ex === 'unknown' ? `unknown_${sym}` : `${ex}_${sym}`;
}

function isValidValue(value) {
  if (value === undefined || value === null) return false;
  const s = String(value).trim();
  if (!s) return false;
  const n = s.toUpperCase();
  return (
    n !== '#N/A' &&
    n !== 'N/A' &&
    n !== '#NUM!' &&
    n !== '#VALUE!' &&
    n !== '#DIV/0!' &&
    n !== '#REF!' &&
    n !== 'LOADING...'
  );
}

function getValueAllowZero(columns, row) {
  for (const name of columns) {
    if (row[name] !== undefined && row[name] !== null) {
      const value = row[name];
      if (value === 0 || value === '0') return '0';
      if (value === '') continue;
      return String(value).trim();
    }
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() !== lower) continue;
      const value = row[key];
      if (value === 0 || value === '0') return '0';
      if (value === '' || value === undefined || value === null) continue;
      return String(value).trim();
    }
  }
  return '';
}

function readSectorIsm(row) {
  for (const col of ISM_SECTOR_COLUMNS) {
    const v = getValueAllowZero([col], row);
    if (isValidValue(v)) return v.trim();
  }
  return '';
}

function readIndustry(row) {
  for (const col of INDUSTRY_COLUMNS) {
    const v = getValueAllowZero([col], row);
    if (isValidValue(v)) return v.trim();
  }
  return '';
}

function parseNumericNullable(valueStr) {
  if (!isValidValue(valueStr)) return null;
  const raw = String(valueStr).replace(/\s/g, '').replace(/#/g, '').replace(/%/g, '').replace(/\$/g, '');
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function slugifySegment(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function ismSectorIdFromName(sectorName) {
  const t = sectorName.trim().toLowerCase();
  if (!t) return 'unknown_sector';
  return slugifySegment(t).slice(0, 120);
}

function isoTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarDays(isoYmd, deltaDays) {
  const d = new Date(`${isoYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(fromIso, toIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso) || fromIso > toIso) {
    return 0;
  }
  const a = new Date(`${fromIso}T12:00:00.000Z`).getTime();
  const b = new Date(`${toIso}T12:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

function ismHistoryWindow() {
  const toIso = isoTodayUtc();
  const fromIso = addCalendarDays(toIso, -(ISM_HISTORY_TARGET_DAYS - 1));
  return { fromIso, toIso };
}

/**
 * Inspect eodAdjustedDaily doc the same way refreshSectorRebalanceSnapshot overlays history.
 * @param {object | null} eodDoc
 * @param {number | null} systemGeneration
 * @param {string} fromIso
 * @param {string} toIso
 */
function inspectEodHistoryDoc(eodDoc, systemGeneration, fromIso, toIso) {
  if (!eodDoc) {
    return {
      eodDoc: 'no',
      generationOk: false,
      barCountInWindow: 0,
      rangeDays: 0,
      lastBarDate: null,
      windowSpanDays: 0,
    };
  }

  const gen = typeof eodDoc.generation === 'number' ? eodDoc.generation : null;
  const generationOk = systemGeneration != null && gen === systemGeneration;
  const range =
    eodDoc.range && typeof eodDoc.range.from === 'string' && typeof eodDoc.range.to === 'string'
      ? { from: eodDoc.range.from, to: eodDoc.range.to }
      : null;
  const rangeDays = range ? daysInclusive(range.from, range.to) : 0;
  const lastBarDate = typeof eodDoc.lastBarDate === 'string' ? eodDoc.lastBarDate : null;

  let barCountInWindow = 0;
  let windowFirst = null;
  let windowLast = null;
  if (generationOk && Array.isArray(eodDoc.bars)) {
    for (const row of eodDoc.bars) {
      if (!row || typeof row !== 'object') continue;
      const date = typeof row.date === 'string' ? row.date : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < fromIso || date > toIso) continue;
      const ac = row.adjustedClose !== undefined ? row.adjustedClose : row.adjusted_close;
      const v = typeof ac === 'number' ? ac : Number(ac);
      if (!Number.isFinite(v) || v <= 0) continue;
      barCountInWindow += 1;
      if (!windowFirst || date < windowFirst) windowFirst = date;
      if (!windowLast || date > windowLast) windowLast = date;
    }
  }

  const windowSpanDays =
    windowFirst && windowLast ? daysInclusive(windowFirst, windowLast) : generationOk ? rangeDays : 0;

  let eodDocLabel = 'yes';
  if (!generationOk) eodDocLabel = systemGeneration == null ? 'no_sys_gen' : 'stale_gen';

  return {
    eodDoc: eodDocLabel,
    generationOk,
    barCountInWindow,
    rangeDays,
    lastBarDate,
    windowSpanDays,
  };
}

/** Mirrors src/utils/ism/tickerIdentity.ts parseTickerParts needsReview rules. */
function parseTickerNeedsReview(rawTicker) {
  const trimmed = rawTicker.trim();
  if (trimmed === '') return true;

  const colonIdx = trimmed.indexOf(':');
  let exchangePart;
  let symbolPart;

  if (colonIdx === -1) {
    exchangePart = '';
    symbolPart = trimmed;
  } else {
    exchangePart = trimmed.slice(0, colonIdx).trim();
    symbolPart = trimmed.slice(colonIdx + 1).trim();
    if (symbolPart.includes(':')) return true;
    if (exchangePart === '' || symbolPart === '') return true;
  }

  const hasExplicitExchange = colonIdx !== -1 && exchangePart.length > 0;
  if (hasExplicitExchange && !EXCHANGE_PART_OK.test(exchangePart)) return true;
  return false;
}

function analyzeRow(row) {
  const companyName = getValueAllowZero(COMPANY_COLUMNS, row);
  const ticker = getValueAllowZero(TICKER_COLUMNS, row);
  if (!isValidValue(companyName) || !isValidValue(ticker)) {
    return { bucket: 'invalid_row', companyName, ticker, sectorIsm: '', industry: '' };
  }

  const sectorIsm = readSectorIsm(row);
  const industry = readIndustry(row);
  const marketCap = parseNumericNullable(getValueAllowZero(MARKET_CAP_COLUMNS, row));
  const dashboardDateOfUpdateRaw = getValueAllowZero(DATE_UPDATE_COLUMNS, row);
  const dashboardDateOfUpdate = isValidValue(dashboardDateOfUpdateRaw)
    ? dashboardDateOfUpdateRaw.trim()
    : null;
  const tickerNeedsReview = parseTickerNeedsReview(ticker);

  const missingSector = !isValidValue(sectorIsm);
  const missingMarketCap = marketCap === null;
  const missingDashboardDate = dashboardDateOfUpdate === null;

  const record = {
    companyName,
    ticker,
    symbolId: buildSymbolId(ticker),
    sectorIsm,
    industry,
    sectorId: ismSectorIdFromName(sectorIsm),
    suggestedSector: industry || null,
    suggestedSectorId: industry ? ismSectorIdFromName(industry) : null,
    marketCap,
    dashboardDateOfUpdate,
    tickerNeedsReview,
    missingSector,
    missingMarketCap,
    missingDashboardDate,
  };

  if (tickerNeedsReview) {
    return { bucket: 'ticker_review', ...record };
  }
  const missingFields = [];
  if (missingMarketCap) missingFields.push('market_cap');
  if (missingDashboardDate) missingFields.push('date_of_update');

  if (missingSector) {
    return { bucket: 'missing_sector', missingFields, ...record };
  }
  if (missingFields.length > 0) {
    return { bucket: 'in_sector_incomplete', missingFields, ...record };
  }
  return { bucket: 'in_sector_ready', missingFields, ...record };
}

async function fetchDashboardRows() {
  const res = await fetch(DASHBOARD_CSV_URL, {
    headers: { Accept: 'text/csv,text/plain,*/*' },
  });
  if (!res.ok) {
    throw new Error(`DashBoard CSV fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row})`);
  }
  return /** @type {Record<string, string>[]} */ (parsed.data);
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function formatTable(rows, columns) {
  if (rows.length === 0) return '_(none)_\n';
  const widths = columns.map((c) => c.label.length);
  const lines = rows.map((r) =>
    columns.map((c, i) => {
      const cell = String(c.get(r) ?? '').slice(0, 80);
      widths[i] = Math.max(widths[i], cell.length);
      return cell;
    })
  );
  const header = columns.map((c, i) => c.label.padEnd(widths[i])).join('  ');
  const sep = columns.map((_, i) => '-'.repeat(widths[i])).join('  ');
  const body = lines.map((cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  return [header, sep, ...body].join('\n') + '\n';
}

/**
 * @param {Awaited<ReturnType<typeof loadConstituentDiagnostics>> | null} constituentDiagnostics
 */
function buildReport(analyzed, opts, constituentDiagnostics) {
  const byBucket = groupBy(analyzed, (r) => r.bucket);
  const inSectorReady = byBucket.get('in_sector_ready') ?? [];
  const missingSector = byBucket.get('missing_sector') ?? [];
  const inSectorIncomplete = byBucket.get('in_sector_incomplete') ?? [];
  const inSector = [...inSectorReady, ...inSectorIncomplete];
  const tickerReview = byBucket.get('ticker_review') ?? [];
  const invalid = byBucket.get('invalid_row') ?? [];

  const sectorFilter = opts.sector
    ? (r) =>
        ismSectorIdFromName(r.sectorIsm) === ismSectorIdFromName(opts.sector) ||
        (r.suggestedSector && ismSectorIdFromName(r.suggestedSector) === ismSectorIdFromName(opts.sector))
    : () => true;

  const missingFiltered = missingSector.filter(sectorFilter);
  const inSectorFiltered = opts.sector
    ? inSector.filter((r) => ismSectorIdFromName(r.sectorIsm) === ismSectorIdFromName(opts.sector))
    : [];
  const inSectorByName = groupBy(inSector, (r) => r.sectorIsm || '(empty)');
  const sectorCounts = [...inSectorByName.entries()]
    .map(([name, rows]) => ({
      sector: name,
      sectorId: ismSectorIdFromName(name),
      count: rows.length,
      ready: rows.filter((r) => r.bucket === 'in_sector_ready').length,
      incomplete: rows.filter((r) => r.bucket === 'in_sector_incomplete').length,
    }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));

  const suggestedGroups = groupBy(
    missingFiltered.filter((r) => r.suggestedSector),
    (r) => r.suggestedSector
  );
  const noSuggestion = missingFiltered.filter((r) => !r.suggestedSector);

  const summary = {
    fetchedAt: new Date().toISOString(),
    totalRows: analyzed.length,
    inSector: inSector.length,
    inSectorReady: inSectorReady.length,
    inSectorIncomplete: inSectorIncomplete.length,
    missingSector: missingSector.length,
    tickerReview: tickerReview.length,
    invalidRow: invalid.length,
    ismSectors: sectorCounts,
    sectorFilter: opts.sector,
    missingSectorFiltered: missingFiltered.length,
    inSectorFilteredCount: opts.sector ? inSectorFiltered.length : null,
  };

  if (opts.json) {
    return JSON.stringify(
      {
        summary,
        missingSectorCandidates: missingFiltered,
        missingSectorNoIndustryHint: noSuggestion,
        inSectorIncomplete,
        inSectorReady,
        tickerReview,
        inSectorBySector: Object.fromEntries(inSectorByName),
        constituentDiagnostics,
      },
      null,
      2
    );
  }

  const cols = [
    { label: 'Company', get: (r) => r.companyName },
    { label: 'Ticker', get: (r) => r.ticker },
    { label: 'SECTOR (ISM)', get: (r) => r.sectorIsm || '—' },
    { label: 'Industry', get: (r) => r.industry || '—' },
    { label: 'Market cap', get: (r) => (r.marketCap != null ? String(r.marketCap) : '—') },
  ];

  let md = '';
  md += `# ISM sector candidate report\n\n`;
  md += `Generated: ${summary.fetchedAt}\n\n`;
  md += `Source: [DashBoard CSV](${DASHBOARD_CSV_URL})\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n|--------|------:|\n`;
  md += `| Total sheet rows | ${summary.totalRows} |\n`;
  md += `| **In ISM sector** (SECTOR (ISM) set) | ${summary.inSector} |\n`;
  md += `| ↳ Fully ready (cap + date of update) | ${summary.inSectorReady} |\n`;
  md += `| ↳ Incomplete metadata | ${summary.inSectorIncomplete} |\n`;
  md += `| **Missing SECTOR (ISM)** — add candidates | ${summary.missingSector} |\n`;
  md += `| Ticker needs review | ${summary.tickerReview} |\n`;
  md += `| Invalid row (no company/ticker) | ${summary.invalidRow} |\n`;
  if (opts.sector) {
    md += `| Rows in sector \`${opts.sector}\` | ${summary.inSectorFilteredCount} |\n`;
    md += `| Missing-sector candidates (Industry hint = \`${opts.sector}\`) | ${summary.missingSectorFiltered} |\n`;
  }
  md += `\n`;

  md += `## ISM sector roster (from **SECTOR (ISM)**)\n\n`;
  md += `| Sector | sectorId | Total | Ready | Incomplete |\n|--------|----------|------:|------:|-----------:|\n`;
  for (const s of sectorCounts) {
    md += `| ${s.sector} | \`${s.sectorId}\` | ${s.count} | ${s.ready} | ${s.incomplete} |\n`;
  }
  md += `\n`;

  if (opts.sector && inSectorFiltered.length > 0) {
    md += `## Roster: \`${opts.sector}\` (${inSectorFiltered.length} companies on sheet)\n\n`;
    md += '```\n' + formatTable(inSectorFiltered, cols) + '```\n\n';
  }

  if (constituentDiagnostics) {
    md += buildConstituentDiagnosticsMarkdown(constituentDiagnostics, opts.sector);
  } else if (opts.sector && !opts.skipFirestore) {
    md += `## Index basket vs sheet (\`${opts.sector}\`)\n\n`;
    md += `_Firestore diagnostics skipped (no credentials or \`functions/lib\` missing)._\n`;
    md += `Run \`npm run build --prefix functions\` and \`gcloud auth application-default login\`, then retry.\n\n`;
  }

  md += `## Primary candidates — missing **SECTOR (ISM)**\n\n`;
  md += `These rows have company + ticker but no ISM sector label. `;
  md += `ISM ingest ignores the **Industry** column for \`sectorIsm\`; fill **SECTOR (ISM)** on the sheet.\n\n`;
  if (missingFiltered.length === 0) {
    md += `_(none`;
    md += opts.sector ? ` matching filter\`${opts.sector}\`` : '';
    md += `)_\n\n`;
  } else {
    md += '```\n' + formatTable(missingFiltered, cols) + '```\n\n';
  }

  if (suggestedGroups.size > 0) {
    md += `### Grouped by **Industry** (hint only — not used by ISM ingest)\n\n`;
    for (const [industry, rows] of [...suggestedGroups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      md += `#### ${industry} (\`${ismSectorIdFromName(industry)}\`) — ${rows.length} row(s)\n\n`;
      md += '```\n' + formatTable(rows, cols) + '```\n\n';
    }
  }

  if (noSuggestion.length > 0) {
    md += `### Missing sector and no Industry hint (${noSuggestion.length})\n\n`;
    md += '```\n' + formatTable(noSuggestion, cols) + '```\n\n';
  }

  if (inSectorIncomplete.length > 0 && !opts.sector) {
    const sample = inSectorIncomplete.slice(0, 40);
    md += `## In ISM sector but missing sheet metadata (${inSectorIncomplete.length})\n\n`;
    md += `Usually missing **Date of Update** and/or **Market Cap**. Showing first ${sample.length}:\n\n`;
    const colsWithGaps = [
      ...cols,
      { label: 'Missing', get: (r) => (r.missingFields ?? []).join(', ') },
    ];
    md += '```\n' + formatTable(sample, colsWithGaps) + '```\n\n';
  }

  if (tickerReview.length > 0) {
    md += `## Ticker parse needs review (${tickerReview.length})\n\n`;
    md += '```\n' + formatTable(tickerReview, cols) + '```\n\n';
  }

  md += `---\n\n`;
  md += `Sheet rules: \`mergeIsmIngestFromDashboardRows\` / \`readDashboardSectorIsm\`.\n`;
  md += `Basket rules: \`computeIsmRebalanceRowMetrics\` / \`computeSectorRebalanceSnapshot\`.\n`;
  md += `See [ism-sheet-to-sector-index.md](docs/ism-sheet-to-sector-index.md).\n`;

  return md;
}

function buildConstituentDiagnosticsMarkdown(diag, sectorLabel) {
  const sectorId = diag.sectorId;
  let md = `## Index basket vs sheet (\`${sectorLabel}\` → \`${sectorId}\`)\n\n`;
  md += `The **constituent table** in ISM Posture comes from the active weekly rebalance snapshot in Firestore, not directly from the sheet.\n\n`;

  if (!diag.activeSnapshot) {
    md += `No active \`sector_rebalances/${sectorId}/snapshots\` document.\n\n`;
    return md;
  }

  const s = diag.activeSnapshot;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Snapshot id | \`${s.id}\` |\n`;
  md += `| total_candidates (sheet sector rows) | ${s.total_candidates ?? '—'} |\n`;
  md += `| qualified_count | ${s.qualified_count ?? '—'} |\n`;
  md += `| constituents in basket | ${s.constituentCount ?? '—'} |\n`;
  md += `\n`;

  if (s.topExclusionReasons?.length) {
    md += `### Top exclusion reasons (non-basket)\n\n`;
    md += `| Reason | Count |\n|--------|------:|\n`;
    for (const { reason, count } of s.topExclusionReasons) {
      md += `| \`${reason}\` | ${count} |\n`;
    }
    md += `\n`;
  }

  if (s.basket?.length) {
    md += `### Current basket\n\n`;
    md += `| Rank | Company | Ticker | market_cap_usd |\n|-----:|---------|--------|---------------:|\n`;
    for (const c of s.basket) {
      md += `| ${c.rank} | ${c.company_name} | ${c.ticker_raw} | ${c.market_cap_usd} |\n`;
    }
    md += `\n`;
  }

  if (diag.historySummary) {
    const h = diag.historySummary;
    md += `### EOD price history (eodAdjustedDaily)\n\n`;
    md += `ISM window: **${h.windowFrom}** → **${h.windowTo}** (${h.windowCalendarDays} calendar days). `;
    md += `Qualification needs **≥ ${ISM_MIN_HISTORY_DAYS}** days (from symbol doc, EOD bars in window, or EOD range span).\n\n`;
    md += `| Metric | Count |\n|--------|------:|\n`;
    md += `| Rows on sheet | ${h.totalRows} |\n`;
    md += `| EOD doc present | ${h.withEodDoc} |\n`;
    md += `| EOD generation current | ${h.withCurrentGeneration} |\n`;
    md += `| History OK (≥ ${ISM_MIN_HISTORY_DAYS} d) | ${h.withHistoryOk} |\n`;
    md += `| In basket | ${h.inBasket} |\n`;
    md += `\n`;
  }

  if (diag.perRow?.length) {
    const gateCols = [
      { label: 'Company', get: (r) => r.companyName },
      { label: 'Ticker', get: (r) => r.ticker },
      { label: 'EOD id', get: (r) => r.eodSymbol },
      { label: 'EOD doc', get: (r) => r.eodDoc },
      { label: 'Bars', get: (r) => String(r.barCountInWindow) },
      { label: 'Win days', get: (r) => String(r.windowSpanDays) },
      { label: 'Range d', get: (r) => (r.rangeDays > 0 ? String(r.rangeDays) : '—') },
      { label: 'Last bar', get: (r) => r.lastBarDate || '—' },
      { label: 'Hist eff', get: (r) => String(r.effectiveHistoryDays) },
      { label: 'Hist OK', get: (r) => (r.historyOk ? 'yes' : 'no') },
      { label: 'Basket', get: (r) => (r.inBasket ? 'yes' : 'no') },
      { label: 'Blockers', get: (r) => (r.blockers.length ? r.blockers.join('; ') : '—') },
    ];
    md += `### Per-row gates (sheet + symbol doc + EOD cache history)\n\n`;
    md += '```\n' + formatTable(diag.perRow, gateCols) + '```\n\n';
  }

  return md;
}

async function loadConstituentDiagnostics(sectorLabel, sectorRows) {
  const sectorId = ismSectorIdFromName(sectorLabel);
  const eodTranslatePath = path.join(root, 'functions', 'lib', 'ismEodTranslate.js');
  if (!fs.existsSync(eodTranslatePath)) {
    throw new Error('Missing functions/lib/ismEodTranslate.js — run: npm run build --prefix functions');
  }

  const admin = require('firebase-admin');
  const { eodSymbolFromTickerRaw } = require(eodTranslatePath);

  if (!admin.apps.length) {
    const projectId = readDefaultProjectId();
    if (!projectId) throw new Error('No Firebase project id in .firebaserc');
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  const snapCol = await db.collection('sector_rebalances').doc(sectorId).collection('snapshots').get();
  let activeSnap = null;
  let activeTs = 0;
  for (const d of snapCol.docs) {
    const data = d.data();
    const ts = typeof data.rebalance_timestamp === 'number' ? data.rebalance_timestamp : 0;
    if (data.is_active === true && ts >= activeTs) {
      activeTs = ts;
      activeSnap = { id: d.id, ...data };
    }
  }

  const symbolSnaps = await db.collection('symbols').get();
  const symbolById = new Map();
  const sectorSymbolIds = new Set(sectorRows.map((r) => r.symbolId));
  for (const d of symbolSnaps.docs) {
    const data = d.data();
    const id = typeof data.symbol_id === 'string' ? data.symbol_id : d.id;
    if (ismSectorIdFromName(data.sector ?? '') === sectorId || sectorSymbolIds.has(id)) {
      symbolById.set(id, data);
    }
  }

  let systemGeneration = null;
  try {
    const sysSnap = await db.doc('system/eodAdjustedCache').get();
    if (sysSnap.exists) {
      const g = sysSnap.data()?.generation;
      if (typeof g === 'number' && g > 0) systemGeneration = g;
    }
  } catch {
    /* ignore */
  }

  const eodSnaps = await db.collection('eodAdjustedDaily').get();
  const eodDocById = new Map(eodSnaps.docs.map((d) => [d.id, d.data()]));
  const { fromIso, toIso } = ismHistoryWindow();

  const constituentIds = new Set(
    (Array.isArray(activeSnap?.constituents) ? activeSnap.constituents : [])
      .map((c) => c.symbol_id)
      .filter(Boolean)
  );

  const perRow = sectorRows.map((row) => {
    const sym = symbolById.get(row.symbolId);
    const eodSymbol = eodSymbolFromTickerRaw(row.ticker);
    const eodRaw = eodDocById.get(eodSymbol) ?? null;
    const eod = inspectEodHistoryDoc(eodRaw, systemGeneration, fromIso, toIso);

    const symbolHistoryDays =
      typeof sym?.history_days_available === 'number' && sym.history_days_available > 0
        ? sym.history_days_available
        : 0;

    let effectiveHistoryDays = symbolHistoryDays;
    if (eod.windowSpanDays > 0) effectiveHistoryDays = Math.max(effectiveHistoryDays, eod.windowSpanDays);
    if (eod.generationOk && eod.rangeDays > 0 && effectiveHistoryDays < ISM_MIN_HISTORY_DAYS) {
      effectiveHistoryDays = Math.max(effectiveHistoryDays, eod.rangeDays);
    }
    effectiveHistoryDays = Math.min(effectiveHistoryDays, ISM_HISTORY_TARGET_DAYS);

    const historyOk = effectiveHistoryDays >= ISM_MIN_HISTORY_DAYS;
    const hasPriceDate =
      (typeof sym?.latest_price_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sym.latest_price_date)) ||
      eod.barCountInWindow > 0;

    const blockers = [];
    if (row.tickerNeedsReview) blockers.push('ticker_review');
    if (row.missingMarketCap) blockers.push('sheet_cap');
    if (!sym) blockers.push('no_symbol_doc');
    else {
      if (sym.needs_review) blockers.push(`review:${(sym.needs_review_reason_codes ?? []).join(',')}`);
      if (!sym.local_currency) blockers.push('no_currency');
      if (sym.market_cap_usd == null) blockers.push('no_cap_usd');
      if (!historyOk) blockers.push(`history<${ISM_MIN_HISTORY_DAYS}(${effectiveHistoryDays})`);
      if (!hasPriceDate) blockers.push('no_price_date');
      if (sym.discovery_status !== 'qualified') blockers.push(`status=${sym.discovery_status}`);
    }
    if (eod.eodDoc === 'no') blockers.push('no_eod_cache');
    else if (eod.eodDoc === 'stale_gen') blockers.push('eod_stale_generation');
    else if (eod.barCountInWindow === 0 && eod.rangeDays === 0) blockers.push('eod_empty_bars');

    return {
      companyName: row.companyName,
      ticker: row.ticker,
      symbolId: row.symbolId,
      eodSymbol,
      inBasket: constituentIds.has(row.symbolId),
      eodDoc: eod.eodDoc,
      generationOk: eod.generationOk,
      barCountInWindow: eod.barCountInWindow,
      rangeDays: eod.rangeDays,
      lastBarDate: eod.lastBarDate,
      windowSpanDays: eod.windowSpanDays,
      symbolHistoryDays,
      effectiveHistoryDays,
      historyOk,
      hasPriceDate,
      blockers,
    };
  });

  const historySummary = {
    windowFrom: fromIso,
    windowTo: toIso,
    windowCalendarDays: ISM_HISTORY_TARGET_DAYS,
    systemGeneration,
    totalRows: perRow.length,
    withEodDoc: perRow.filter((r) => r.eodDoc !== 'no').length,
    withCurrentGeneration: perRow.filter((r) => r.generationOk).length,
    withHistoryOk: perRow.filter((r) => r.historyOk).length,
    inBasket: perRow.filter((r) => r.inBasket).length,
  };

  const cons = Array.isArray(activeSnap?.constituents) ? activeSnap.constituents : [];
  return {
    sectorId,
    historySummary,
    activeSnapshot: activeSnap
      ? {
          id: activeSnap.id,
          total_candidates: activeSnap.total_candidates,
          qualified_count: activeSnap.qualified_count,
          constituentCount: cons.length,
          topExclusionReasons: Array.isArray(activeSnap.top_exclusion_reasons)
            ? activeSnap.top_exclusion_reasons
            : [],
          basket: cons.map((c) => ({
            rank: c.rank,
            company_name: c.company_name,
            ticker_raw: c.ticker_raw,
            market_cap_usd: c.market_cap_usd,
            symbol_id: c.symbol_id,
          })),
        }
      : null,
    perRow,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  console.error('Fetching DashBoard CSV…');
  const rows = await fetchDashboardRows();
  console.error(`Parsed ${rows.length} rows.`);

  const analyzed = rows.map(analyzeRow);

  let constituentDiagnostics = null;
  if (opts.sector && !opts.skipFirestore) {
    const sectorId = ismSectorIdFromName(opts.sector);
    const sectorRows = analyzed.filter(
      (r) => r.sectorId === sectorId && (r.bucket === 'in_sector_ready' || r.bucket === 'in_sector_incomplete')
    );
    try {
      console.error(`Loading Firestore basket diagnostics for sector "${opts.sector}" (${sectorRows.length} sheet rows)…`);
      constituentDiagnostics = await loadConstituentDiagnostics(opts.sector, sectorRows);
    } catch (err) {
      console.error('Firestore diagnostics failed:', err instanceof Error ? err.message : err);
    }
  }

  const report = buildReport(analyzed, opts, constituentDiagnostics);

  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, report, 'utf8');
    console.error('Wrote', opts.out);
  }

  console.log(report);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
