/**
 * Fetch service configuration: Apps Script URL, CORS proxies, timeouts.
 * URL validation runs at module load (side effect).
 */

import { logger } from '../../utils/logger';

export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

export const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

const FETCH_TIMEOUT_SECONDS_NUM = parseInt(import.meta.env.VITE_FETCH_TIMEOUT_SECONDS || '30', 10);
export const FETCH_TIMEOUT_SECONDS = FETCH_TIMEOUT_SECONDS_NUM;
export const FETCH_TIMEOUT = FETCH_TIMEOUT_SECONDS_NUM * 1000;

// Validate Apps Script URL format at startup (warn only, don't fail)
if (APPS_SCRIPT_URL) {
  if (import.meta.env.DEV) {
    if (APPS_SCRIPT_URL.includes('/library/')) {
      logger.error(
        'Invalid Apps Script URL: Looks like a library deployment, not a Web App! Expected format: https://script.google.com/macros/s/SCRIPT_ID/exec. SOLUTION: Redeploy as "Web app" (not "Library") in Apps Script → Deploy → New deployment',
        undefined,
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    } else if (!APPS_SCRIPT_URL.includes('script.google.com/macros/s/') || !APPS_SCRIPT_URL.endsWith('/exec')) {
      logger.warn(
        'Apps Script URL format may be incorrect. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    } else {
      logger.info(
        'Apps Script URL configured successfully. Status: Ready to use (will bypass CSV proxy)',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  }
} else {
  const isProduction = import.meta.env.PROD;
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

  if (isProduction || isVercel) {
    if (import.meta.env.DEV) {
      logger.error(
        'Apps Script URL NOT configured in Vercel! App will fall back to slower CSV proxy method. TO FIX: Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add VITE_APPS_SCRIPT_URL → Select all environments → Save and REDEPLOY',
        undefined,
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  } else {
    if (import.meta.env.DEV) {
      logger.info(
        'Apps Script URL not configured locally. App will use CSV fallback. To enable locally: Create .env.local file with VITE_APPS_SCRIPT_URL=your-apps-script-url',
        { component: 'fetchService', operation: 'validateAppsScriptUrl' }
      );
    }
  }
}
