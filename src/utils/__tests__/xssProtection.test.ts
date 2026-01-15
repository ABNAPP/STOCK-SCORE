import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  isHtmlSafe,
  sanitizeHtml,
} from '../xssProtection';

describe('xssProtection', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should escape ampersand', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape less than', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('</div>')).toBe('&lt;&#x2F;div&gt;');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(escapeHtml("'test'")).toBe('&#x27;test&#x27;');
    });

    it('should escape forward slash', () => {
      expect(escapeHtml('</script>')).toBe('&lt;&#x2F;script&gt;');
    });

    it('should handle null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle normal text without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeHtmlAttribute', () => {
    it('should escape HTML attribute special characters', () => {
      expect(escapeHtmlAttribute('test"value')).toBe('test&quot;value');
    });

    it('should escape quotes for attributes', () => {
      expect(escapeHtmlAttribute('test\'value')).toBe('test&#x27;value');
    });

    it('should escape ampersand', () => {
      expect(escapeHtmlAttribute('A & B')).toBe('A &amp; B');
    });

    it('should handle null/undefined', () => {
      expect(escapeHtmlAttribute(null)).toBe('');
      expect(escapeHtmlAttribute(undefined)).toBe('');
    });
  });

  describe('escapeJavaScript', () => {
    it('should escape JavaScript special characters', () => {
      expect(escapeJavaScript('test\'value')).toBe("test\\'value");
    });

    it('should escape backslash', () => {
      expect(escapeJavaScript('test\\value')).toBe('test\\\\value');
    });

    it('should escape newlines', () => {
      expect(escapeJavaScript('test\nvalue')).toBe('test\\nvalue');
    });

    it('should escape tabs', () => {
      expect(escapeJavaScript('test\tvalue')).toBe('test\\tvalue');
    });

    it('should handle null/undefined', () => {
      expect(escapeJavaScript(null)).toBe('');
      expect(escapeJavaScript(undefined)).toBe('');
    });
  });

  describe('isHtmlSafe', () => {
    it('should return true for safe HTML', () => {
      expect(isHtmlSafe('<div>Safe content</div>')).toBe(true);
    });

    it('should return false for script tags', () => {
      expect(isHtmlSafe('<script>alert("xss")</script>')).toBe(false);
    });

    it('should return false for javascript: protocol', () => {
      expect(isHtmlSafe('javascript:alert("xss")')).toBe(false);
    });

    it('should return false for event handlers', () => {
      expect(isHtmlSafe('<div onclick="alert(\'xss\')">')).toBe(false);
    });

    it('should return false for iframe tags', () => {
      expect(isHtmlSafe('<iframe src="evil.com"></iframe>')).toBe(false);
    });

    it('should return false for object tags', () => {
      expect(isHtmlSafe('<object data="evil.swf"></object>')).toBe(false);
    });

    it('should return false for embed tags', () => {
      expect(isHtmlSafe('<embed src="evil.swf"></embed>')).toBe(false);
    });

    it('should return true for null/undefined', () => {
      expect(isHtmlSafe(null)).toBe(true);
      expect(isHtmlSafe(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isHtmlSafe('')).toBe(true);
    });
  });

  describe('sanitizeHtml', () => {
    it('should sanitize HTML by escaping', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });
  });
});
