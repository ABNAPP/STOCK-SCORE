/**
 * Security-related error types for Steg C prod-lock.
 * SecurityError indicates an operation was blocked due to secure mode policy.
 */

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}
