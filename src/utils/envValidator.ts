/**
 * Environment Variables Validator
 * 
 * Validates all required and optional environment variables at application startup.
 * Ensures proper configuration before the app initializes.
 */

import { logger } from './logger';

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Firebase API Key format
 * Firebase API keys start with "AIza" and are typically 39 characters long
 */
function validateFirebaseApiKey(apiKey: string | undefined): { isValid: boolean; error?: string } {
  if (!apiKey || apiKey === 'undefined' || apiKey === 'missing-api-key') {
    return { isValid: false, error: 'VITE_FIREBASE_API_KEY is missing or undefined' };
  }

  if (!apiKey.startsWith('AIza')) {
    return { isValid: false, error: 'VITE_FIREBASE_API_KEY format is invalid. Expected to start with "AIza"' };
  }

  if (apiKey.length < 39) {
    return { isValid: false, error: 'VITE_FIREBASE_API_KEY appears to be too short (expected at least 39 characters)' };
  }

  return { isValid: true };
}

/**
 * Validates Firebase Auth Domain format
 * Should match pattern: *.firebaseapp.com
 */
function validateFirebaseAuthDomain(authDomain: string | undefined): { isValid: boolean; error?: string } {
  if (!authDomain || authDomain === 'undefined' || authDomain === 'missing-auth-domain') {
    return { isValid: false, error: 'VITE_FIREBASE_AUTH_DOMAIN is missing or undefined' };
  }

  if (!authDomain.endsWith('.firebaseapp.com')) {
    return { isValid: false, error: 'VITE_FIREBASE_AUTH_DOMAIN format is invalid. Expected: *.firebaseapp.com' };
  }

  return { isValid: true };
}

/**
 * Validates Firebase Project ID
 */
function validateFirebaseProjectId(projectId: string | undefined): { isValid: boolean; error?: string } {
  if (!projectId || projectId === 'undefined' || projectId === 'missing-project-id') {
    return { isValid: false, error: 'VITE_FIREBASE_PROJECT_ID is missing or undefined' };
  }

  if (projectId.trim().length === 0) {
    return { isValid: false, error: 'VITE_FIREBASE_PROJECT_ID cannot be empty' };
  }

  return { isValid: true };
}

/**
 * Validates Firebase Storage Bucket format
 * 
 * **Why this format?**
 * - Firebase Storage Bucket must end with `.appspot.com` for standard Firebase projects
 * - Some projects may use custom domains, but `.appspot.com` is the default format
 * - This validation ensures the bucket URL is correctly formatted for Firebase Storage API
 * 
 * **Edge Case: Custom Storage Buckets**
 * - If using a custom bucket (not `.appspot.com`), validation will fail
 * - In such cases, the bucket URL should still work but validation warns about format
 * 
 * @param storageBucket - Storage bucket URL to validate
 * @returns Validation result with isValid flag and optional error message
 */
function validateFirebaseStorageBucket(storageBucket: string | undefined): { isValid: boolean; error?: string } {
  if (!storageBucket || storageBucket === 'undefined' || storageBucket === 'missing-storage-bucket') {
    return { isValid: false, error: 'VITE_FIREBASE_STORAGE_BUCKET is missing or undefined' };
  }

  // Validate format: should end with .appspot.com for standard Firebase projects
  // Also accept gs:// prefix (Firebase Storage format) or just the bucket name
  const normalizedBucket = storageBucket.replace(/^gs:\/\//, '').trim();
  
  // Check if it's a valid bucket format (ends with .appspot.com or is a valid bucket name)
  if (!normalizedBucket.endsWith('.appspot.com') && !/^[a-z0-9][a-z0-9\-_\.]*[a-z0-9]$/.test(normalizedBucket)) {
    return { 
      isValid: false, 
      error: `VITE_FIREBASE_STORAGE_BUCKET format is invalid. Expected: PROJECT_ID.appspot.com or gs://PROJECT_ID.appspot.com. Current value: ${storageBucket.substring(0, 50)}${storageBucket.length > 50 ? '...' : ''}` 
    };
  }

  // If it doesn't end with .appspot.com, warn but don't fail in development
  if (!normalizedBucket.endsWith('.appspot.com')) {
    // In development, allow custom buckets but warn
    if (import.meta.env.DEV) {
      // Return valid but could add a warning here if needed
      return { isValid: true };
    }
    // In production, be stricter
    return { 
      isValid: false, 
      error: 'VITE_FIREBASE_STORAGE_BUCKET format is invalid. Expected: *.appspot.com' 
    };
  }

  return { isValid: true };
}

/**
 * Validates Firebase Messaging Sender ID
 * Should be a numeric string
 */
function validateFirebaseMessagingSenderId(messagingSenderId: string | undefined): { isValid: boolean; error?: string } {
  if (!messagingSenderId || messagingSenderId === 'undefined' || messagingSenderId === 'missing-messaging-sender-id') {
    return { isValid: false, error: 'VITE_FIREBASE_MESSAGING_SENDER_ID is missing or undefined' };
  }

  if (!/^\d+$/.test(messagingSenderId)) {
    return { isValid: false, error: 'VITE_FIREBASE_MESSAGING_SENDER_ID must be a numeric string' };
  }

  return { isValid: true };
}

/**
 * Validates Firebase App ID format
 * Should match pattern: 1:SENDER_ID:web:APP_ID
 */
function validateFirebaseAppId(appId: string | undefined): { isValid: boolean; error?: string } {
  if (!appId || appId === 'undefined' || appId === 'missing-app-id') {
    return { isValid: false, error: 'VITE_FIREBASE_APP_ID is missing or undefined' };
  }

  if (!/^1:\d+:web:[a-zA-Z0-9]+$/.test(appId)) {
    return { isValid: false, error: 'VITE_FIREBASE_APP_ID format is invalid. Expected: 1:SENDER_ID:web:APP_ID' };
  }

  return { isValid: true };
}

/**
 * Validates Apps Script URL format (optional)
 * Should match: https://script.google.com/macros/s/SCRIPT_ID/exec
 */
function validateAppsScriptUrl(url: string | undefined): { isValid: boolean; warning?: string } {
  if (!url || url.trim().length === 0) {
    return { isValid: true }; // Optional, so missing is OK
  }

  if (url.includes('/library/')) {
    return { 
      isValid: false, 
      warning: 'VITE_APPS_SCRIPT_URL appears to be a library deployment URL. Expected Web App URL format: https://script.google.com/macros/s/SCRIPT_ID/exec' 
    };
  }

  if (!url.includes('script.google.com/macros/s/') || !url.endsWith('/exec')) {
    return { 
      isValid: false, 
      warning: 'VITE_APPS_SCRIPT_URL format may be incorrect. Expected: https://script.google.com/macros/s/SCRIPT_ID/exec' 
    };
  }

  return { isValid: true };
}

/**
 * Validates optional numeric environment variables
 */
function validateOptionalNumeric(
  value: string | undefined,
  varName: string,
  defaultValue: number,
  min?: number,
  max?: number
): { isValid: boolean; warning?: string } {
  if (!value || value.trim().length === 0) {
    return { isValid: true }; // Using default is OK
  }

  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) {
    return { isValid: false, warning: `${varName} must be a valid number. Using default: ${defaultValue}` };
  }

  if (min !== undefined && numValue < min) {
    return { isValid: false, warning: `${varName} (${numValue}) is below minimum (${min}). Using default: ${defaultValue}` };
  }

  if (max !== undefined && numValue > max) {
    return { isValid: false, warning: `${varName} (${numValue}) exceeds maximum (${max}). Using default: ${defaultValue}` };
  }

  return { isValid: true };
}

/**
 * Validates optional boolean environment variables
 */
function validateOptionalBoolean(
  value: string | undefined,
  varName: string,
  defaultValue: boolean
): { isValid: boolean; warning?: string } {
  if (!value || value.trim().length === 0) {
    return { isValid: true }; // Using default is OK
  }

  const lowerValue = value.toLowerCase().trim();
  if (lowerValue !== 'true' && lowerValue !== 'false') {
    return { isValid: false, warning: `${varName} must be "true" or "false". Using default: ${defaultValue}` };
  }

  return { isValid: true };
}

/**
 * Main function to validate all environment variables
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = import.meta.env.PROD;

  // Required Firebase variables
  const apiKeyResult = validateFirebaseApiKey(import.meta.env.VITE_FIREBASE_API_KEY);
  if (!apiKeyResult.isValid && apiKeyResult.error) {
    errors.push(apiKeyResult.error);
  }

  const authDomainResult = validateFirebaseAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  if (!authDomainResult.isValid && authDomainResult.error) {
    errors.push(authDomainResult.error);
  }

  const projectIdResult = validateFirebaseProjectId(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  if (!projectIdResult.isValid && projectIdResult.error) {
    errors.push(projectIdResult.error);
  }

  const storageBucketResult = validateFirebaseStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
  if (!storageBucketResult.isValid && storageBucketResult.error) {
    errors.push(storageBucketResult.error);
  }

  const messagingSenderIdResult = validateFirebaseMessagingSenderId(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  if (!messagingSenderIdResult.isValid && messagingSenderIdResult.error) {
    errors.push(messagingSenderIdResult.error);
  }

  const appIdResult = validateFirebaseAppId(import.meta.env.VITE_FIREBASE_APP_ID);
  if (!appIdResult.isValid && appIdResult.error) {
    errors.push(appIdResult.error);
  }

  // Optional variables - warnings only
  const appsScriptUrlResult = validateAppsScriptUrl(import.meta.env.VITE_APPS_SCRIPT_URL);
  if (!appsScriptUrlResult.isValid && appsScriptUrlResult.warning) {
    warnings.push(appsScriptUrlResult.warning);
  }

  // Optional numeric variables
  const fetchTimeoutResult = validateOptionalNumeric(
    import.meta.env.VITE_FETCH_TIMEOUT_SECONDS,
    'VITE_FETCH_TIMEOUT_SECONDS',
    30,
    5,
    300
  );
  if (!fetchTimeoutResult.isValid && fetchTimeoutResult.warning) {
    warnings.push(fetchTimeoutResult.warning);
  }

  const cacheTtlResult = validateOptionalNumeric(
    import.meta.env.VITE_CACHE_DEFAULT_TTL_MINUTES,
    'VITE_CACHE_DEFAULT_TTL_MINUTES',
    20,
    1,
    1440
  );
  if (!cacheTtlResult.isValid && cacheTtlResult.warning) {
    warnings.push(cacheTtlResult.warning);
  }

  const freshThresholdResult = validateOptionalNumeric(
    import.meta.env.VITE_CACHE_FRESH_THRESHOLD_MINUTES,
    'VITE_CACHE_FRESH_THRESHOLD_MINUTES',
    5,
    1,
    60
  );
  if (!freshThresholdResult.isValid && freshThresholdResult.warning) {
    warnings.push(freshThresholdResult.warning);
  }

  const pollIntervalResult = validateOptionalNumeric(
    import.meta.env.VITE_DELTA_SYNC_POLL_MINUTES,
    'VITE_DELTA_SYNC_POLL_MINUTES',
    15,
    1,
    1440
  );
  if (!pollIntervalResult.isValid && pollIntervalResult.warning) {
    warnings.push(pollIntervalResult.warning);
  }

  // Optional boolean variables
  const deltaSyncResult = validateOptionalBoolean(
    import.meta.env.VITE_DELTA_SYNC_ENABLED,
    'VITE_DELTA_SYNC_ENABLED',
    true
  );
  if (!deltaSyncResult.isValid && deltaSyncResult.warning) {
    warnings.push(deltaSyncResult.warning);
  }

  const cacheWarmingResult = validateOptionalBoolean(
    import.meta.env.VITE_CACHE_WARMING_ENABLED,
    'VITE_CACHE_WARMING_ENABLED',
    true
  );
  if (!cacheWarmingResult.isValid && cacheWarmingResult.warning) {
    warnings.push(cacheWarmingResult.warning);
  }

  // Log results
  if (errors.length > 0) {
    const errorMessage = `Environment variable validation failed:\n${errors.join('\n')}`;
    logger.error('Environment Variables Validation', new Error(errorMessage), {
      component: 'envValidator',
      errors,
      isProduction,
    });

    // In production, throw error to prevent app from starting with invalid config
    if (isProduction) {
      throw new Error(
        `${errorMessage}\n\n` +
        `Please configure these environment variables in:\n` +
        `- Local development: .env.local file\n` +
        `- Production: Vercel Dashboard → Settings → Environment Variables\n\n` +
        `See env.template for required variables.`
      );
    }
  }

  if (warnings.length > 0) {
    logger.warn('Environment variable warnings', {
      component: 'envValidator',
      warnings,
    });
    warnings.forEach((warning) => {
      logger.warn(warning, { component: 'envValidator' });
    });
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.info('All environment variables validated successfully', {
      component: 'envValidator',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
