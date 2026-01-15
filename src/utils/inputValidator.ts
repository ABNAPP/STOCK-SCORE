/**
 * Input Validator
 * 
 * Centralized input validation utilities for filters, search queries,
 * and EntryExit values. Provides sanitization and validation functions.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

/**
 * Validates text input with configurable constraints
 * 
 * @param value - Text value to validate
 * @param options - Validation options
 * @param options.maxLength - Maximum allowed length (default: 200)
 * @param options.minLength - Minimum required length (default: 0)
 * @param options.required - Whether field is required (default: false)
 * @param options.allowEmpty - Whether empty string is allowed (default: true)
 * @returns Validation result with isValid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateTextInput('hello', { maxLength: 10, required: true });
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateTextInput(
  value: string,
  options: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
    allowEmpty?: boolean;
  } = {}
): ValidationResult {
  const { maxLength = 200, minLength = 0, required = false, allowEmpty = true } = options;

  // Handle empty values
  if (!value || value.trim().length === 0) {
    if (required) {
      return { isValid: false, error: 'This field is required' };
    }
    if (!allowEmpty) {
      return { isValid: false, error: 'This field cannot be empty' };
    }
    return { isValid: true };
  }

  // Check length
  if (value.length > maxLength) {
    return { isValid: false, error: `Text must be no more than ${maxLength} characters` };
  }

  if (value.length < minLength) {
    return { isValid: false, error: `Text must be at least ${minLength} characters` };
  }

  return { isValid: true };
}

/**
 * Validates number input with range and format constraints
 * 
 * @param value - Number value to validate (can be number, string, null, or undefined)
 * @param options - Validation options
 * @param options.min - Minimum allowed value
 * @param options.max - Maximum allowed value
 * @param options.required - Whether field is required (default: false)
 * @param options.allowDecimal - Whether decimal values are allowed (default: true)
 * @param options.maxDecimals - Maximum decimal places (default: 2)
 * @returns Validation result with isValid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateNumberInput(42.5, { min: 0, max: 100, maxDecimals: 2 });
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateNumberInput(
  value: number | string | null | undefined,
  options: {
    min?: number;
    max?: number;
    required?: boolean;
    allowDecimal?: boolean;
    maxDecimals?: number;
  } = {}
): ValidationResult {
  const { min, max, required = false, allowDecimal = true, maxDecimals = 2 } = options;

  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { isValid: false, error: 'This field is required' };
    }
    return { isValid: true };
  }

  // Convert to number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Check if valid number
  if (isNaN(numValue)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  // Check if integer when decimals not allowed
  if (!allowDecimal && !Number.isInteger(numValue)) {
    return { isValid: false, error: 'Must be a whole number' };
  }

  // Check decimal places
  if (allowDecimal && maxDecimals !== undefined) {
    const decimalPlaces = (numValue.toString().split('.')[1] || '').length;
    if (decimalPlaces > maxDecimals) {
      return { isValid: false, error: `Maximum ${maxDecimals} decimal place${maxDecimals !== 1 ? 's' : ''} allowed` };
    }
  }

  // Check range
  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `Value must be no more than ${max}` };
  }

  return { isValid: true };
}

/**
 * Validates number range (min and max values)
 * 
 * Ensures both min and max are valid numbers and that min <= max.
 * 
 * @param range - Range object with optional min and max properties
 * @param options - Validation options
 * @param options.min - Global minimum allowed value
 * @param options.max - Global maximum allowed value
 * @param options.required - Whether range is required (default: false)
 * @returns Validation result with isValid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateNumberRange(
 *   { min: 10, max: 100 },
 *   { min: 0, max: 1000 }
 * );
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateNumberRange(
  range: NumberRange | null | undefined,
  options: {
    min?: number;
    max?: number;
    required?: boolean;
  } = {}
): ValidationResult {
  const { min: globalMin, max: globalMax, required = false } = options;

  // Handle null/undefined
  if (!range || (range.min === undefined && range.max === undefined)) {
    if (required) {
      return { isValid: false, error: 'Range is required' };
    }
    return { isValid: true };
  }

  // Validate min if provided
  if (range.min !== undefined) {
    const minResult = validateNumberInput(range.min, { min: globalMin, max: globalMax });
    if (!minResult.isValid) {
      return { isValid: false, error: `Minimum value: ${minResult.error}` };
    }
  }

  // Validate max if provided
  if (range.max !== undefined) {
    const maxResult = validateNumberInput(range.max, { min: globalMin, max: globalMax });
    if (!maxResult.isValid) {
      return { isValid: false, error: `Maximum value: ${maxResult.error}` };
    }
  }

  // Validate that min <= max
  if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
    return { isValid: false, error: 'Minimum value must be less than or equal to maximum value' };
  }

  return { isValid: true };
}

/**
 * Validates select input against allowed options
 */
export function validateSelectInput(
  value: string | number | null | undefined,
  allowedOptions: Array<string | number>,
  options: {
    required?: boolean;
  } = {}
): ValidationResult {
  const { required = false } = options;

  // Handle empty values
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { isValid: false, error: 'Please select a value' };
    }
    return { isValid: true };
  }

  // Check if value is in allowed options
  if (!allowedOptions.includes(value)) {
    return { isValid: false, error: 'Invalid selection' };
  }

  return { isValid: true };
}

/**
 * Sanitizes search query by removing dangerous characters and limiting length
 * 
 * Prevents XSS and regex injection attacks by:
 * - Removing HTML tags (<, >)
 * - Escaping HTML entities (&, ", ')
 * - Escaping regex special characters
 * - Limiting query length
 * 
 * @param query - Search query string to sanitize
 * @param maxLength - Maximum allowed length (default: 200)
 * @returns Sanitized query string safe for use in regex and HTML
 * 
 * @example
 * ```typescript
 * const userInput = '<script>alert("xss")</script>';
 * const safe = sanitizeSearchQuery(userInput);
 * // Returns: sanitized string safe for regex/HTML
 * ```
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 200): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = query.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Escape special regex characters to prevent regex injection
  // But keep basic search functionality (letters, numbers, spaces, common punctuation)
  // Remove or escape potentially dangerous characters
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/&/g, '&amp;') // Escape & to prevent HTML entities
    .replace(/"/g, '&quot;') // Escape quotes
    .replace(/'/g, '&#x27;') // Escape single quotes
    // Keep regex special chars but escape them for safe regex use
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special characters

  return sanitized;
}

/**
 * Validates EntryExit value for entry/exit price fields
 * 
 * Validates different field types:
 * - entry1, entry2, exit1, exit2: Numeric values (0-1,000,000, max 2 decimals)
 * - currency: Must be one of allowed currency codes (USD, EUR, SEK, etc.)
 * - dateOfUpdate: Must be valid date string in YYYY-MM-DD format
 * 
 * @param field - Field name to validate
 * @param value - Value to validate (number, string, null, or undefined)
 * @returns Validation result with isValid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateEntryExitValue('entry1', 175.50);
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * 
 * const dateResult = validateEntryExitValue('dateOfUpdate', '2024-01-15');
 * ```
 */
export function validateEntryExitValue(
  field: 'entry1' | 'entry2' | 'exit1' | 'exit2' | 'currency' | 'dateOfUpdate',
  value: number | string | null | undefined
): ValidationResult {
  // Handle null/undefined for optional fields
  if (value === null || value === undefined) {
    if (field === 'dateOfUpdate') {
      return { isValid: true }; // dateOfUpdate can be null
    }
    if (field === 'currency') {
      return { isValid: true }; // Will default to USD
    }
    return { isValid: true }; // Entry/exit can be 0 (empty)
  }

  // Validate numeric fields (entry1, entry2, exit1, exit2)
  if (field === 'entry1' || field === 'entry2' || field === 'exit1' || field === 'exit2') {
    return validateNumberInput(value, {
      min: 0,
      max: 1000000, // Maximum reasonable price
      allowDecimal: true,
      maxDecimals: 2,
      required: false,
    });
  }

  // Validate currency
  if (field === 'currency') {
    const allowedCurrencies = ['USD', 'EUR', 'SEK', 'DKK', 'NOK', 'GBP', 'AUD', 'CAD', 'NZD'];
    return validateSelectInput(value, allowedCurrencies, { required: false });
  }

  // Validate dateOfUpdate
  if (field === 'dateOfUpdate') {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Date must be a string' };
    }

    // Validate date format: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return { isValid: false, error: 'Date must be in format YYYY-MM-DD' };
    }

    // Validate that it's a valid date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, error: 'Invalid date' };
    }

    // Check that the date string matches the parsed date (prevents invalid dates like 2024-13-45)
    const [year, month, day] = value.split('-').map(Number);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return { isValid: false, error: 'Invalid date' };
    }

    return { isValid: true };
  }

  return { isValid: true };
}

/**
 * Validates filter name for saved filters
 * 
 * Ensures filter names are safe and within length limits.
 * Prevents dangerous characters that could cause XSS or other issues.
 * 
 * @param name - Filter name to validate
 * @returns Validation result with isValid flag and optional error message
 * 
 * @example
 * ```typescript
 * const result = validateFilterName('My Custom Filter');
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateFilterName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Filter name cannot be empty' };
  }

  if (name.length > 50) {
    return { isValid: false, error: 'Filter name must be no more than 50 characters' };
  }

  // Prevent dangerous characters in filter names
  if (/[<>"']/.test(name)) {
    return { isValid: false, error: 'Filter name contains invalid characters' };
  }

  return { isValid: true };
}
