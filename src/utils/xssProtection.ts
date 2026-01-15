/**
 * XSS Protection Utilities
 * 
 * Provides functions to escape HTML and prevent XSS attacks.
 * Note: React automatically escapes content by default, but these utilities
 * are useful for manual string manipulation or when working with dangerouslySetInnerHTML.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * 
 * @param text - The text to escape
 * @returns Escaped text safe for HTML rendering
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);
  
  return str
    .replace(/&/g, '&amp;')   // Must be first to avoid double-escaping
    .replace(/</g, '&lt;')    // Less than
    .replace(/>/g, '&gt;')    // Greater than
    .replace(/"/g, '&quot;')   // Double quote
    .replace(/'/g, '&#x27;')  // Single quote (apostrophe)
    .replace(/\//g, '&#x2F;'); // Forward slash (prevents closing tags)
}

/**
 * Escapes HTML attributes to prevent XSS in attribute values
 * 
 * @param text - The text to escape for use in HTML attributes
 * @returns Escaped text safe for HTML attribute values
 */
export function escapeHtmlAttribute(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitizes a string for use in JavaScript/JSON contexts
 * Escapes special characters that could break out of string literals
 * 
 * @param text - The text to sanitize
 * @returns Sanitized text safe for JavaScript string literals
 */
export function escapeJavaScript(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);
  
  return str
    .replace(/\\/g, '\\\\')   // Backslash
    .replace(/'/g, "\\'")     // Single quote
    .replace(/"/g, '\\"')     // Double quote
    .replace(/\n/g, '\\n')    // Newline
    .replace(/\r/g, '\\r')   // Carriage return
    .replace(/\t/g, '\\t')   // Tab
    .replace(/\f/g, '\\f')   // Form feed
    .replace(/\v/g, '\\v');  // Vertical tab
}

/**
 * Validates that a string doesn't contain dangerous HTML patterns
 * Useful for additional validation before using dangerouslySetInnerHTML
 * 
 * @param html - The HTML string to validate
 * @returns true if the HTML appears safe, false otherwise
 */
export function isHtmlSafe(html: string | null | undefined): boolean {
  if (!html || typeof html !== 'string') {
    return true;
  }

  // Check for script tags
  if (/<script[\s>]/i.test(html)) {
    return false;
  }

  // Check for javascript: protocol
  if (/javascript:/i.test(html)) {
    return false;
  }

  // Check for on* event handlers
  if (/\son\w+\s*=/i.test(html)) {
    return false;
  }

  // Check for iframe tags
  if (/<iframe[\s>]/i.test(html)) {
    return false;
  }

  // Check for object/embed tags
  if (/<(object|embed)[\s>]/i.test(html)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes HTML by removing dangerous elements and attributes
 * This is a basic sanitizer - for production use, consider a library like DOMPurify
 * 
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML (basic implementation)
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // For now, just escape everything - in production, use a proper HTML sanitizer library
  // This prevents XSS but removes formatting
  return escapeHtml(html);
}
