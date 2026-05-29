/**
 * Compares Firestore `symbols/*` to `eodAdjustedDaily/*` using the same rules as eodAdjustedCache.
 * Writes docs/eod-adjusted-cache-gaps.md (gitignored — see below).
 *
 * Requires Application Default Credentials: `gcloud auth application-default login`
 * or GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'functions', 'package.json'));

const admin = require('firebase-admin');
const { eodSymbolFromTickerRaw } = require(path.join(root, 'functions', 'lib', 'ismEodTranslate.js'));

const ISM_SYMBOL_SCHEMA_VERSION = 1;
const OUT_FILE = path.join(root, 'docs', 'eod-adjusted-cache-gaps.md');

function readDefaultProjectId() {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
    return rc?.projects?.default ?? process.env.GCLOUD_PROJECT ?? null;
  } catch {
    return process.env.GCLOUD_PROJECT ?? null;
  }
}

if (!admin.apps.length) {
  const projectId = readDefaultProjectId();
  if (!projectId) throw new Error('No project id in .firebaserc');
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function main() {
  const [symbolsSnap, dailySnap] = await Promise.all([
    db.collection('symbols').get(),
    db.collection('eodAdjustedDaily').get(),
  ]);

  const cachedEodIds = new Set(dailySnap.docs.map((d) => d.id));

  /** @type {{ symbolId: string, companyName: string, tickerRaw: string, reason: string }[]} */
  const excluded = [];
  /** @type {{ symbolId: string, companyName: string, eodSymbol: string, reason: string }[]} */
  const eligibleMissing = [];

  for (const doc of symbolsSnap.docs) {
    const d = doc.data();
    const symbolId = typeof d.symbol_id === 'string' ? d.symbol_id : doc.id;
    const companyName = typeof d.company_name === 'string' ? d.company_name : '(unknown)';
    const schema = d.ism_symbol_schema_version;
    const tickerRaw = typeof d.ticker_raw === 'string' ? d.ticker_raw.trim() : '';

    if (schema !== ISM_SYMBOL_SCHEMA_VERSION) {
      excluded.push({
        symbolId,
        companyName,
        tickerRaw: tickerRaw || '(empty)',
        reason: `Warm list requires ism_symbol_schema_version === ${ISM_SYMBOL_SCHEMA_VERSION}; this doc has ${schema === undefined ? 'undefined' : JSON.stringify(schema)}.`,
      });
      continue;
    }

    if (!tickerRaw) {
      excluded.push({
        symbolId,
        companyName,
        tickerRaw: '(empty)',
        reason: 'Warm list skips symbols with missing or blank ticker_raw.',
      });
      continue;
    }

    /** Always derive from `ticker_raw` so venue mapping tracks code changes; ignore stale `eodhd_symbol` on doc. */
    const eodSymbol = eodSymbolFromTickerRaw(tickerRaw);

    if (!cachedEodIds.has(eodSymbol)) {
      eligibleMissing.push({
        symbolId,
        companyName,
        eodSymbol,
        reason:
          'No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid).',
      });
    }
  }

  const benchmark = eodSymbolFromTickerRaw('SPY');
  if (!cachedEodIds.has(benchmark)) {
    eligibleMissing.unshift({
      symbolId: '(benchmark)',
      companyName: 'SPY',
      eodSymbol: benchmark,
      reason:
        'Benchmark always requested by the job — missing doc means warm failed for this symbol (same causes as above).',
    });
  }

  excluded.sort((a, b) => a.symbolId.localeCompare(b.symbolId));
  eligibleMissing.sort((a, b) => a.symbolId.localeCompare(b.symbolId));

  const generated = new Date().toISOString();

  const md = `# Adjusted EOD cache — gaps vs Firestore registry

Auto-generated: **${generated}** (run \`node scripts/report-eod-cache-gaps.mjs\` after \`gcloud auth application-default login\`.)

This compares **\`symbols/*\`** (same inclusion rules as [\`eodAdjustedCache.ts\`](../functions/src/eodAdjustedCache.ts)) to documents in **\`eodAdjustedDaily/{eodSymbol}\`**. It does not call EODHD.

---

## A — Not on the warm list (excluded before fetch)

These rows are **never** requested from EODHD.

| symbol_id | company | ticker_raw | Reason |
|-----------|---------|------------|--------|
${excluded.map((r) => `| ${escapeMd(r.symbolId)} | ${escapeMd(r.companyName)} | ${escapeMd(r.tickerRaw)} | ${escapeMd(r.reason)} |`).join('\n')}

${excluded.length === 0 ? '*(none)*\n' : ''}

---

## B — On the warm list but no cache document for their EOD symbol

Eligible docs have schema **${ISM_SYMBOL_SCHEMA_VERSION}** and non-empty **ticker_raw**. **eodSymbol** is **always** computed from \`ticker_raw\` with \`eodSymbolFromTickerRaw\` (same as the nightly warm job) — not from stored \`eodhd_symbol\`. If multiple registry rows map to the same **eodSymbol**, one shared cache doc covers them all — only rows whose **eodSymbol** still has **no** doc appear here.

| symbol_id | company | eod_symbol | Reason |
|-----------|---------|------------|--------|
${eligibleMissing.map((r) => `| ${escapeMd(r.symbolId)} | ${escapeMd(r.companyName)} | ${escapeMd(r.eodSymbol)} | ${escapeMd(r.reason)} |`).join('\n')}

${eligibleMissing.length === 0 ? '*(none)*\n' : ''}

---

## Totals

| Category | Count |
|----------|-------|
| Excluded (section A) | ${excluded.length} |
| Eligible but missing cache doc (section B) | ${eligibleMissing.length} |
| \`symbols\` docs scanned | ${symbolsSnap.size} |
| \`eodAdjustedDaily\` docs | ${dailySnap.size} |
`;

  fs.writeFileSync(OUT_FILE, md, 'utf8');
  console.log('Wrote', path.relative(root, OUT_FILE));
  console.log('Excluded:', excluded.length, 'Eligible missing:', eligibleMissing.length);
}

function escapeMd(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  if (/default credentials|NO_ADC_FOUND|Unable to detect a Project Id/i.test(msg)) {
    console.error('\nFirestore requires Google credentials. Run:\n  gcloud auth application-default login\nThen:\n  npm run report:eod-gaps\n');
  }
  process.exit(1);
});
