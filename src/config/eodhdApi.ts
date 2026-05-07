/**
 * Base URL for EODHD REST paths (`/eod/...`, `/real-time/...`).
 *
 * **Browser CORS:** Direct `fetch('https://eodhd.com/api/...')` from the SPA origin is usually blocked
 * because EODHD does not send `Access-Control-Allow-Origin` for arbitrary sites (Postman works since it
 * does not enforce CORS).
 *
 * Default is the **same-origin** prefix **`/eodhd-proxy/api`** so the browser talks to your host only:
 * - **Vite dev:** `server.proxy` forwards to `https://eodhd.com` (see `vite.config.ts`).
 * - **Production:** proxy `/eodhd-proxy/*` → `https://eodhd.com/*` on your host (see `vercel.json`).
 *
 * Optional **`VITE_EODHD_API_ORIGIN`**: set to `https://eodhd.com/api` only for non-browser callers.
 *
 * @see https://eodhd.com/financial-apis
 */
const DIRECT_ORIGIN = 'https://eodhd.com/api';

/** Served by your dev server / deployment proxy—not by EODHD directly. */
const SAME_ORIGIN_PROXY_PREFIX = '/eodhd-proxy/api';

function resolveEodhdApiOrigin(): string {
  const override =
    typeof import.meta.env.VITE_EODHD_API_ORIGIN === 'string' ? import.meta.env.VITE_EODHD_API_ORIGIN.trim() : '';
  if (override) return override.replace(/\/$/, '');
  if (import.meta.env.MODE === 'test') return DIRECT_ORIGIN;
  return SAME_ORIGIN_PROXY_PREFIX;
}

export const EODHD_API_ORIGIN = resolveEodhdApiOrigin();
