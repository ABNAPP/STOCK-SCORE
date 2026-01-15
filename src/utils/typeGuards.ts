/**
 * Type Guards Utility
 * 
 * Provides reusable type guard functions for runtime type checking
 * throughout the application.
 */

/**
 * Type guard to check if a value is a non-null object
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = { key: 'value' };
 * if (isObject(value)) {
 *   // TypeScript now knows value is Record<string, unknown>
 *   console.log(value.key); // OK
 * }
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is an array
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = [1, 2, 3];
 * if (isArray(value)) {
 *   // TypeScript now knows value is unknown[]
 *   value.forEach(item => console.log(item)); // OK
 * }
 * ```
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a string
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = 'hello';
 * if (isString(value)) {
 *   // TypeScript now knows value is string
 *   console.log(value.toUpperCase()); // OK
 * }
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a valid number (excludes NaN and Infinity)
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = 42;
 * if (isNumber(value)) {
 *   // TypeScript now knows value is number (and not NaN/Infinity)
 *   console.log(value * 2); // OK
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard to check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard to check if a value is a valid number (including 0)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard to check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if an object has a specific key
 */
export function hasKey<T extends string>(
  obj: unknown,
  key: T
): obj is Record<T, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard to check if an object has all specified keys
 */
export function hasKeys<T extends string>(
  obj: unknown,
  keys: T[]
): obj is Record<T, unknown> {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}

/**
 * DataRow interface - represents a row from Google Sheets
 */
export interface DataRow {
  [key: string]: string | number | undefined;
}

/**
 * Type guard to check if a value is a DataRow (object with string keys)
 * 
 * DataRow represents a row from Google Sheets where values can be strings,
 * numbers, or undefined. Used throughout the data transformation pipeline.
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = { ticker: 'AAPL', price: 175.50 };
 * if (isDataRow(value)) {
 *   // TypeScript now knows value is DataRow
 *   console.log(value.ticker); // OK
 * }
 * ```
 */
export function isDataRow(value: unknown): value is DataRow {
  if (!isObject(value)) return false;
  
  // Check that all values are string, number, or undefined
  for (const key in value) {
    const val = value[key];
    if (val !== undefined && typeof val !== 'string' && typeof val !== 'number') {
      return false;
    }
  }
  
  return true;
}

/**
 * Type guard to check if a value is an array of DataRow
 * 
 * Narrowing example:
 * ```typescript
 * const value: unknown = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }];
 * if (isDataRowArray(value)) {
 *   // TypeScript now knows value is DataRow[]
 *   value.forEach(row => console.log(row.ticker)); // OK
 * }
 * ```
 */
export function isDataRowArray(value: unknown): value is DataRow[] {
  if (!isArray(value)) return false;
  return value.every(item => isDataRow(item));
}

/**
 * Type guard to check if a value is a 2D array (array of arrays)
 */
export function is2DArray(value: unknown): value is unknown[][] {
  if (!isArray(value)) return false;
  return value.every(item => Array.isArray(item));
}

/**
 * Type guard to check if a value is a valid timestamp (number or Date)
 */
export function isValidTimestamp(value: unknown): value is number | Date {
  if (value instanceof Date) return true;
  if (typeof value === 'number') {
    return value > 0 && isFinite(value);
  }
  return false;
}

/**
 * Type guard to check if a value is a valid URL string
 */
export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value is a valid email string
 */
export function isValidEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard to check if a value is a valid JSON string
 */
export function isValidJsonString(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value is a valid Map
 */
export function isMap<K, V>(value: unknown): value is Map<K, V> {
  return value instanceof Map;
}

/**
 * Type guard to check if a value is a valid Set
 */
export function isSet<T>(value: unknown): value is Set<T> {
  return value instanceof Set;
}

/**
 * Type guard to check if a value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Type guard to check if a value is a Promise
 */
export function isPromise<T>(value: unknown): value is Promise<T> {
  return value instanceof Promise || (isObject(value) && 'then' in value && isFunction((value as { then: unknown }).then));
}

/**
 * Type guard to check if a value is a valid Date object
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard to check if a value is a valid positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/**
 * Type guard to check if a value is a valid non-negative integer
 */
export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/**
 * Type guard to check if a value is within a numeric range
 */
export function isInRange(value: unknown, min: number, max: number): value is number {
  return isNumber(value) && value >= min && value <= max;
}

/**
 * Type guard to check if a value is a non-null BenjaminGrahamData-like object
 */
export function isBenjaminGrahamData(value: unknown): value is { companyName: string; ticker: string; price: number | null; benjaminGraham: number | null } {
  return (
    isObject(value) &&
    isString(value.companyName) &&
    isString(value.ticker) &&
    (isNumber(value.price) || value.price === null) &&
    (isNumber(value.benjaminGraham) || value.benjaminGraham === null)
  );
}

/**
 * Type guard to check if a value is a valid currency string
 */
export function isCurrencyString(value: unknown): value is string {
  return isString(value) && value.length > 0 && value.length <= 10;
}

/**
 * Type guard to check if a value is a CacheEntry
 */
export function isCacheEntry<T>(value: unknown): value is { data: T; timestamp: number; ttl: number } {
  return (
    isObject(value) &&
    'data' in value &&
    isNumber(value.timestamp) &&
    isNumber(value.ttl)
  );
}

/**
 * Type guard to check if a value is a DeltaCacheEntry
 */
export function isDeltaCacheEntry<T>(value: unknown): value is { data: T; version: number; timestamp?: number; ttl?: number } {
  return (
    isObject(value) &&
    'data' in value &&
    isNumber(value.version) &&
    (value.timestamp === undefined || isNumber(value.timestamp)) &&
    (value.ttl === undefined || isNumber(value.ttl))
  );
}
