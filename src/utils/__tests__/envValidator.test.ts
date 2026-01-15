import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { validateEnvironmentVariables, EnvValidationResult } from '../envValidator';

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('envValidator', () => {
  const originalEnv = import.meta.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default valid values
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567890');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-project.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789012');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123456789012:web:abcdef1234567890');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('validateEnvironmentVariables', () => {
    it('should return valid when all required variables are correct', () => {
      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing Firebase API Key', () => {
      vi.unstubEnv('VITE_FIREBASE_API_KEY');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_API_KEY is missing or undefined');
    });

    it('should detect invalid Firebase API Key format', () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'invalid-key');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('format is invalid'))).toBe(true);
    });

    it('should detect too short Firebase API Key', () => {
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'AIza123');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should detect missing Firebase Auth Domain', () => {
      vi.unstubEnv('VITE_FIREBASE_AUTH_DOMAIN');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_AUTH_DOMAIN is missing or undefined');
    });

    it('should detect invalid Firebase Auth Domain format', () => {
      vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'invalid-domain.com');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('firebaseapp.com'))).toBe(true);
    });

    it('should detect missing Firebase Project ID', () => {
      vi.unstubEnv('VITE_FIREBASE_PROJECT_ID');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_PROJECT_ID is missing or undefined');
    });

    it('should detect empty Firebase Project ID', () => {
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '   ');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be empty'))).toBe(true);
    });

    it('should detect missing Firebase Storage Bucket', () => {
      vi.unstubEnv('VITE_FIREBASE_STORAGE_BUCKET');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_STORAGE_BUCKET is missing or undefined');
    });

    it('should detect invalid Firebase Storage Bucket format', () => {
      vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'invalid-bucket.com');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('appspot.com'))).toBe(true);
    });

    it('should detect missing Firebase Messaging Sender ID', () => {
      vi.unstubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_MESSAGING_SENDER_ID is missing or undefined');
    });

    it('should detect invalid Firebase Messaging Sender ID format', () => {
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'not-a-number');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('numeric string'))).toBe(true);
    });

    it('should detect missing Firebase App ID', () => {
      vi.unstubEnv('VITE_FIREBASE_APP_ID');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VITE_FIREBASE_APP_ID is missing or undefined');
    });

    it('should detect invalid Firebase App ID format', () => {
      vi.stubEnv('VITE_FIREBASE_APP_ID', 'invalid-app-id');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('format is invalid'))).toBe(true);
    });

    it('should validate Apps Script URL format', () => {
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/SCRIPT_ID/exec');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about invalid Apps Script URL format', () => {
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/library/SCRIPT_ID');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.some(w => w.includes('library deployment'))).toBe(true);
    });

    it('should validate optional numeric variables', () => {
      vi.stubEnv('VITE_FETCH_TIMEOUT_SECONDS', '30');
      vi.stubEnv('VITE_CACHE_DEFAULT_TTL_MINUTES', '20');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about invalid optional numeric variables', () => {
      vi.stubEnv('VITE_FETCH_TIMEOUT_SECONDS', 'invalid');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('VITE_FETCH_TIMEOUT_SECONDS'))).toBe(true);
    });

    it('should warn about out of range optional numeric variables', () => {
      vi.stubEnv('VITE_FETCH_TIMEOUT_SECONDS', '1000'); // Too high

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('exceeds maximum'))).toBe(true);
    });

    it('should validate optional boolean variables', () => {
      vi.stubEnv('VITE_DELTA_SYNC_ENABLED', 'true');
      vi.stubEnv('VITE_CACHE_WARMING_ENABLED', 'false');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about invalid optional boolean variables', () => {
      vi.stubEnv('VITE_DELTA_SYNC_ENABLED', 'yes');

      const result = validateEnvironmentVariables();

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('VITE_DELTA_SYNC_ENABLED'))).toBe(true);
    });

    it('should throw error in production when required vars are missing', () => {
      vi.unstubEnv('VITE_FIREBASE_API_KEY');
      vi.stubEnv('PROD', 'true');

      // In production, should throw
      expect(() => validateEnvironmentVariables()).toThrow();
    });

    it('should not throw in development when required vars are missing', () => {
      vi.unstubEnv('VITE_FIREBASE_API_KEY');
      vi.stubEnv('PROD', 'false');

      // In development, should not throw
      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });
});
