/**
 * One-off script: builds CODEBASE_SNAPSHOT.md with the entire codebase.
 * Excludes: node_modules, .git, dist, .env.local, package-lock.json, binary assets.
 * Run: node scripts/build-codebase-snapshot.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CODEBASE_SNAPSHOT.md');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'storybook-static', '.firebase']);
const SKIP_FILES = new Set(['.env.local', 'package-lock.json', 'CODEBASE_SNAPSHOT.md']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif', '.svg', '.woff', '.woff2', '.ttf', '.eot']);
const SKIP_PATHS = ['temp-set-admin/serviceAccountKey', 'serviceAccountKey.json']; // sensitive

function shouldSkip(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (SKIP_FILES.has(path.basename(filePath))) return true;
  if (rel.split(path.sep).some(seg => SKIP_DIRS.has(seg))) return true;
  if (SKIP_PATHS.some(p => rel.includes(p))) return true;
  return false;
}

function isBinary(filePath) {
  return BINARY_EXT.has(path.extname(filePath).toLowerCase());
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else {
      if (shouldSkip(full)) continue;
      yield full;
    }
  }
}

function escapeCodeBlock(content) {
  if (typeof content !== 'string') return content;
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getLang(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = { '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx', '.json': 'json', '.css': 'css', '.html': 'html', '.md': 'markdown', '.mdx': 'mdx', '.gs': 'javascript', '.bat': 'batch', '.rules': 'text' };
  return map[ext] || 'text';
}

const lines = [];
lines.push('# Stock Score – Kodbas (snapshot)');
lines.push('');
lines.push('*Genererad för personlig referens. En fil per sektion nedan.*');
lines.push('');
lines.push('---');
lines.push('');

const files = [...walk(ROOT)].sort((a, b) => a.localeCompare(b));
for (const filePath of files) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  lines.push(`## \`${rel}\``);
  lines.push('');

  if (isBinary(filePath)) {
    lines.push('*(Binärfil – se repo för asset.)*');
    lines.push('');
    continue;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    lines.push('*(Kunde inte läsa fil.)*');
    lines.push('');
    continue;
  }

  const lang = getLang(filePath);
  const escaped = escapeCodeBlock(content);
  lines.push('```' + lang);
  lines.push(escaped);
  lines.push('```');
  lines.push('');
}

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('Wrote', OUT, 'with', files.length, 'files');
