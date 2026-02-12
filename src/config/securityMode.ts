/**
 * Security mode detection for Steg C prod-lock.
 * Secure mode = token set OR VITE_APPS_SCRIPT_SECURE_MODE=true.
 * In secure mode: no legacy GET to Apps Script; proxy + auth required.
 */

const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN || '';
const SECURE_MODE_FLAG = import.meta.env.VITE_APPS_SCRIPT_SECURE_MODE === 'true';
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const APPS_SCRIPT_PROXY_URL = import.meta.env.VITE_APPS_SCRIPT_PROXY_URL || '';

/**
 * Returns true when secure mode is active.
 * Secure mode = VITE_APPS_SCRIPT_TOKEN is set OR VITE_APPS_SCRIPT_SECURE_MODE=true.
 */
export function isSecureMode(): boolean {
  return !!APPS_SCRIPT_TOKEN || SECURE_MODE_FLAG;
}

/**
 * Ensures proxy is configured when secure mode is active and Apps Script URL is set.
 * Throws with a clear message if proxy is missing.
 */
export function requireProxyInSecureMode(): void {
  if (!isSecureMode()) return;
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_URL.trim()) return;

  if (!APPS_SCRIPT_PROXY_URL || !APPS_SCRIPT_PROXY_URL.trim()) {
    throw new Error(
      'Secure mode: VITE_APPS_SCRIPT_PROXY_URL is required when using Apps Script. ' +
        'Set VITE_APPS_SCRIPT_PROXY_URL to your appsScriptProxy Cloud Function URL (e.g. https://REGION-PROJECT.cloudfunctions.net/appsScriptProxy).'
    );
  }
}
