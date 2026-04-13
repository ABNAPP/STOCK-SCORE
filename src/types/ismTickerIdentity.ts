/**
 * ISM internal ticker identity: raw sheet value, normalized form, and stable symbolId.
 * Parsing is ISM-scoped; does not change how tickers are entered in Google Sheets.
 */

/**
 * Result of parsing a ticker string from DashBoard / ENTRY-EXIT or other feeds.
 *
 * - `tickerRaw` is the exact input string (no trimming applied to this field).
 * - Parsing rules use `trim()` only on a working copy internally.
 */
export interface ParsedTickerParts {
  /** Exact value from the source (unchanged). */
  tickerRaw: string;
  /** Canonical internal form: `{exchangeSlug}:{symbolSlug}` (both lowercased slugs). */
  tickerNormalized: string;
  /** Stable id: `{exchange}_{symbol}` or `unknown_{symbol}` when exchange is unknown. */
  symbolId: string;
  /** Lowercase exchange slug, or the literal `'unknown'`. */
  exchange: string;
  /** Trimmed symbol segment (right side of first `:`), or full trimmed string when no colon. */
  tickerSymbol: string;
  /** True when the string is ambiguous, empty, or fails v1 exchange validation. */
  needsReview: boolean;
}
