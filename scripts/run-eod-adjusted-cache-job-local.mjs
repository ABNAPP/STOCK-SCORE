/**
 * Runs runEodAdjustedCacheNightlyJob() against production Firestore (requires ADC).
 * Uses GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth application-default login`.
 * Loads EODHD_API_KEY from functions/.env first.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
/** Resolve deps from `functions/` (firebase-admin lives there, not repo root). */
const require = createRequire(path.join(root, 'functions', 'package.json'));

function loadFunctionsEnv() {
  const p = path.join(root, 'functions', '.env');
  if (!fs.existsSync(p)) {
    console.error('Missing functions/.env — run: npm run functions:sync-env');
    process.exit(1);
  }
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && v) process.env[k] = v;
  }
}

loadFunctionsEnv();

const admin = require('firebase-admin');
const { runEodAdjustedCacheNightlyJob } = require(path.join(root, 'functions', 'lib', 'eodAdjustedCache.js'));

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
  if (!projectId) {
    console.error('Could not read Firebase project id from .firebaserc or GCLOUD_PROJECT.');
    process.exit(1);
  }
  try {
    admin.initializeApp({ projectId });
  } catch (e) {
    console.error('firebase-admin initializeApp failed:', e?.message ?? e);
    console.error('Use: gcloud auth application-default login  OR  set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.');
    process.exit(1);
  }
}

function printRemoteTriggerHelp() {
  console.log(`
No local Google credentials for Firestore (expected on many dev machines).

To run the same job in production (writes eodAdjustedDaily):
  • Google Cloud Console → Cloud Scheduler → project stock-score-df698
  • Open job: firebase-schedule-eodAdjustedCacheNightly-us-central1 → Run now
  • Or Firebase Console → Functions → use callable adminWarmEodAdjustedCache as an admin user.

Then: npm run functions:log:eod
`);
}

console.log('Running runEodAdjustedCacheNightlyJob (production Firestore)...');
try {
  const result = await runEodAdjustedCacheNightlyJob();
  console.log(JSON.stringify(result, null, 2));
  if (result.skipped) {
    console.error('Job skipped:', result.skipReason);
    process.exit(1);
  }
  if (!result.warmed?.length) {
    console.error('No symbols warmed; check EODHD key and logs.');
    process.exit(1);
  }
  console.log('OK: warmed', result.warmed.length, 'symbols.');
  process.exit(0);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/default credentials|NO_ADC_FOUND|Could not load the default credentials/i.test(msg)) {
    printRemoteTriggerHelp();
    process.exit(2);
  }
  throw e;
}
