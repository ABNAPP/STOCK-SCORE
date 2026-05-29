/**
 * Smoke-test EODHD daily JSON for SPY.US using EODHD_API_KEY from functions/.env.
 * Does not touch Firestore (no service account needed).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, 'functions', '.env');

function loadFunctionsEnv() {
  if (!fs.existsSync(envPath)) {
    console.error('Missing', envPath, '— run: npm run functions:sync-env');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
const apiKey = process.env.EODHD_API_KEY?.trim();
if (!apiKey) {
  console.error('EODHD_API_KEY not set in functions/.env');
  process.exit(1);
}

const toIso = new Date().toISOString().slice(0, 10);
const fromD = new Date(`${toIso}T12:00:00.000Z`);
fromD.setUTCDate(fromD.getUTCDate() - 30);
const fromIso = fromD.toISOString().slice(0, 10);

const url = `https://eodhd.com/api/eod/${encodeURIComponent('CLSK.US')}?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(
  toIso
)}&period=d&fmt=json&api_token=${encodeURIComponent(apiKey)}`;

const res = await fetch(url, { headers: { Accept: 'application/json' } });
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error('EODHD non-JSON response', res.status, text.slice(0, 200));
  process.exit(1);
}

if (!res.ok || !Array.isArray(data)) {
  console.error('EODHD error', res.status, data);
  process.exit(1);
}

const last = data[data.length - 1];
console.log('EODHD daily fetch OK:', {
  bars: data.length,
  lastDate: last?.date,
  lastAdjustedClose: last?.adjusted_close ?? last?.close,
});
