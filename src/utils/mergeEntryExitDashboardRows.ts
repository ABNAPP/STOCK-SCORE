import type { BenjaminGrahamData, ScoreBoardData } from '../types/stock';
import { matchDashBoardToEntryExit } from './ism/tickerIdentity';

/** Lowercase trimmed name for tolerant row matching only (Firestore keys remain exact company names). */
export function normalizeCompanyKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Prefer ISM ticker match only when both sides have a non-empty trimmed ticker —
 * avoids treating all "empty ticker" rows as identical.
 */
function tickersMatchForMerge(scoreTicker: string, bgTicker: string): boolean {
  const s = scoreTicker.trim();
  const b = bgTicker.trim();
  if (!s || !b) return false;
  return matchDashBoardToEntryExit(scoreTicker, bgTicker);
}

/**
 * Match a DashBoard / score-board row to a Benjamin-Graham-transformed row:
 * ticker first (ISM rules), then company name.
 */
export function findBenjaminGrahamMatchForDashBoardRow(
  scoreRow: ScoreBoardData,
  benjaminRows: BenjaminGrahamData[],
): BenjaminGrahamData | undefined {
  const nameKey = normalizeCompanyKey(scoreRow.companyName);

  const tickerMatches = benjaminRows.filter((b) => tickersMatchForMerge(scoreRow.ticker, b.ticker));
  if (tickerMatches.length === 1) return tickerMatches[0];
  if (tickerMatches.length > 1) {
    const byName = tickerMatches.filter((b) => normalizeCompanyKey(b.companyName) === nameKey);
    return byName[0] ?? tickerMatches[0];
  }

  const nameMatches = benjaminRows.filter((b) => normalizeCompanyKey(b.companyName) === nameKey);
  if (nameMatches.length === 1) return nameMatches[0];
  if (nameMatches.length > 1) {
    const byTicker = nameMatches.filter((b) => tickersMatchForMerge(scoreRow.ticker, b.ticker));
    return byTicker[0] ?? nameMatches[0];
  }

  return undefined;
}

/**
 * ENTRY/EXIT row list: same company universe as Score Board / DashBoard snapshot,
 * with Benjamin Graham sheet columns merged in when a row exists there.
 */
export function mergeScoreBoardWithBenjaminGrahamForEntryExit(
  scoreBoard: ScoreBoardData[],
  benjaminGraham: BenjaminGrahamData[],
): BenjaminGrahamData[] {
  return scoreBoard.map((row) => {
    const match = findBenjaminGrahamMatchForDashBoardRow(row, benjaminGraham);
    const priceFromScore = row.price ?? null;
    return {
      companyName: row.companyName,
      ticker: row.ticker.trim(),
      price: match?.price ?? priceFromScore ?? null,
      entryF1: match?.entryF1 ?? null,
      exitF1: match?.exitF1 ?? null,
      exitF2: match?.exitF2 ?? null,
      ivFcf: match?.ivFcf ?? null,
      irr1: match?.irr1 ?? null,
    };
  });
}
