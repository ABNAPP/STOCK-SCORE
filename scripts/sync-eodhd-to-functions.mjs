/**
 * Copies VITE_EODHD_API_KEY from root `.env.local` into `functions/.env` as EODHD_API_KEY.
 * Firebase CLI loads `functions/.env` at deploy time (gitignored). No secrets in git.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const localPath = path.join(root, '.env.local');
const outPath = path.join(root, 'functions', '.env');

if (!fs.existsSync(localPath)) {
  console.warn('sync-eodhd-to-functions: .env.local not found; skip writing functions/.env');
  process.exit(0);
}

const raw = fs.readFileSync(localPath, 'utf8');
const m = raw.match(/^VITE_EODHD_API_KEY\s*=\s*(.+)$/m);
if (!m?.[1]?.trim()) {
  console.warn('sync-eodhd-to-functions: VITE_EODHD_API_KEY missing or empty in .env.local');
  process.exit(0);
}

const key = m[1].trim();
const content =
  `# Synced from root .env.local (VITE_EODHD_API_KEY). Gitignored — do not commit.\nEODHD_API_KEY=${key}\n`;
fs.writeFileSync(outPath, content, 'utf8');
console.log('sync-eodhd-to-functions: wrote', path.relative(root, outPath));
