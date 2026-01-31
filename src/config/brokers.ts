/**
 * Default broker names for Personal Portfolio.
 * Users can select from these or enter a custom broker name (e.g. "Annan").
 */

export const DEFAULT_BROKERS = [
  'Avanza',
  'Nordnet',
  'eToro',
  'Interactive Brokers',
] as const;

/** Value used in UI to show a free-text input for custom broker name */
export const BROKER_OTHER = 'Annan';
