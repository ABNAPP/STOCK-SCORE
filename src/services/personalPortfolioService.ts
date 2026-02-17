/**
 * Personal Portfolio Service
 * 
 * Provides functionality to save and load personal portfolio data in Firestore.
 * Each user has their own portfolio stored in userPortfolios/{userId}.
 * Firestore is the only data source.
 */

import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { PortfolioItem, PortfolioPosition, UserPortfolio } from '../types/portfolio';
import { EntryExitValues } from '../contexts/EntryExitContext';
import { getExchangeRate } from './currencyService';

const COLLECTION_NAME = 'userPortfolios';
const LEGACY_BROKER = '—';

/**
 * Normalize a portfolio item: if it has no positions, create one from legacy quantity/investedAmount/investmentCurrency.
 */
export function normalizePortfolioItem(item: PortfolioItem): PortfolioItem {
  if (item.positions && item.positions.length > 0) {
    return item;
  }
  return {
    ...item,
    positions: [
      {
        broker: LEGACY_BROKER,
        quantity: item.quantity,
        investedAmount: item.investedAmount ?? null,
        investmentCurrency: item.investmentCurrency ?? 'USD',
      },
    ],
  };
}

/**
 * Get user portfolio from Firestore
 */
export async function getUserPortfolio(userId: string): Promise<UserPortfolio | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const raw = (data.portfolio as PortfolioItem[]) || [];
    const portfolio = raw.map(normalizePortfolioItem);
    return {
      userId,
      portfolio,
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when getting user portfolio', {
        component: 'personalPortfolioService',
        operation: 'getUserPortfolio',
        userId,
        error: error.message,
      });
      return null;
    }
    
    logger.error('Error getting user portfolio', error, {
      component: 'personalPortfolioService',
      operation: 'getUserPortfolio',
      userId,
    });
    return null;
  }
}

/**
 * Save user portfolio to Firestore
 */
export async function saveUserPortfolio(
  userId: string,
  portfolio: PortfolioItem[]
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    
    const portfolioData: Omit<UserPortfolio, 'updatedAt'> & { updatedAt: Timestamp } = {
      userId,
      portfolio,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await setDoc(docRef, portfolioData, { merge: true });

    logger.debug(`User portfolio saved for ${userId}`, {
      component: 'personalPortfolioService',
      operation: 'saveUserPortfolio',
      userId,
      itemCount: portfolio.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when saving user portfolio', {
        component: 'personalPortfolioService',
        operation: 'saveUserPortfolio',
        userId,
        error: error.message,
      });
      return;
    }
    
    logger.error('Error saving user portfolio', error, {
      component: 'personalPortfolioService',
      operation: 'saveUserPortfolio',
      userId,
    });
    throw error;
  }
}

/**
 * Total quantity from positions.
 */
function totalQuantityFromPositions(positions: PortfolioPosition[]): number {
  return positions.reduce((sum, p) => sum + (p.quantity || 0), 0);
}

/**
 * Compute average price in USD from positions (async due to exchange rates).
 */
export async function computeAveragePriceUSD(
  positions: PortfolioPosition[]
): Promise<number | null> {
  let totalInvestedUSD = 0;
  let totalQty = 0;
  for (const p of positions) {
    const qty = p.quantity || 0;
    if (qty <= 0) continue;
    totalQty += qty;
    const amt = p.investedAmount;
    const ccy = (p.investmentCurrency || 'USD').toUpperCase();
    if (amt != null && amt > 0) {
      const rate = ccy === 'USD' ? 1 : await getExchangeRate(ccy, 'USD');
      if (rate != null) totalInvestedUSD += amt * rate;
    }
  }
  if (totalQty <= 0) return null;
  return totalInvestedUSD / totalQty;
}

/**
 * Apply aggregated quantity and averagePrice to item from its positions.
 */
async function applyAggregatesToItem(item: PortfolioItem): Promise<PortfolioItem> {
  const positions = item.positions && item.positions.length > 0 ? item.positions : [];
  const quantity = totalQuantityFromPositions(positions);
  const averagePrice = await computeAveragePriceUSD(positions);
  return {
    ...item,
    quantity,
    averagePrice,
    positions,
  };
}

/**
 * Add a portfolio item (with at least one position). Same ticker + same broker: merge into that position; else append position.
 */
export async function addPortfolioItem(
  userId: string,
  item: PortfolioItem
): Promise<void> {
  const currentPortfolio = await getUserPortfolio(userId);
  const portfolio = currentPortfolio?.portfolio || [];
  const newPositions = item.positions && item.positions.length > 0
    ? [...item.positions]
    : [{
        broker: LEGACY_BROKER,
        quantity: item.quantity,
        investedAmount: item.investedAmount ?? null,
        investmentCurrency: item.investmentCurrency ?? 'USD',
      }];

  const existingIndex = portfolio.findIndex(
    (p) => p.ticker.toLowerCase() === item.ticker.toLowerCase()
  );

  let nextItem: PortfolioItem;
  if (existingIndex >= 0) {
    const existing = portfolio[existingIndex];
    const positions = [...(existing.positions || [])];
    for (const newPos of newPositions) {
      const sameBroker = positions.find(
        (p) => p.broker.trim().toLowerCase() === newPos.broker.trim().toLowerCase()
      );
      const sameCurrency =
        (sameBroker?.investmentCurrency || 'USD').toUpperCase() ===
        (newPos.investmentCurrency || 'USD').toUpperCase();
      if (sameBroker && sameCurrency) {
        sameBroker.quantity += newPos.quantity;
        sameBroker.investedAmount =
          (sameBroker.investedAmount ?? 0) + (newPos.investedAmount ?? 0);
      } else {
        positions.push({ ...newPos });
      }
    }
    nextItem = await applyAggregatesToItem({
      ...existing,
      positions,
    });
    portfolio[existingIndex] = nextItem;
  } else {
    nextItem = await applyAggregatesToItem({
      ...item,
      positions: newPositions,
    });
    portfolio.push(nextItem);
  }

  await saveUserPortfolio(userId, portfolio);
}

/**
 * Remove a portfolio item by ticker
 */
export async function removePortfolioItem(
  userId: string,
  ticker: string
): Promise<void> {
  const currentPortfolio = await getUserPortfolio(userId);
  if (!currentPortfolio) {
    return;
  }
  
  const portfolio = currentPortfolio.portfolio.filter(
    p => p.ticker.toLowerCase() !== ticker.toLowerCase()
  );
  
  await saveUserPortfolio(userId, portfolio);
}

/**
 * Update a portfolio item. If updates include positions, quantity and averagePrice are recomputed.
 */
export async function updatePortfolioItem(
  userId: string,
  ticker: string,
  updates: Partial<PortfolioItem>
): Promise<void> {
  const currentPortfolio = await getUserPortfolio(userId);
  if (!currentPortfolio) {
    return;
  }

  const portfolio = await Promise.all(
    currentPortfolio.portfolio.map(async (p) => {
      if (p.ticker.toLowerCase() !== ticker.toLowerCase()) {
        return p;
      }
      const merged = { ...p, ...updates };
      if (merged.positions && merged.positions.length > 0) {
        return applyAggregatesToItem(merged);
      }
      return merged;
    })
  );

  await saveUserPortfolio(userId, portfolio);
}

/**
 * Get currency for a stock from EntryExitValues
 * 
 * Returns the currency for a stock from EntryExitValues map,
 * or defaults to 'USD' if not found.
 * 
 * @param ticker - Stock ticker symbol
 * @param companyName - Company name
 * @param entryExitValues - Map of EntryExitValues keyed by companyName
 * @returns Currency string (default: 'USD')
 * 
 * @example
 * ```typescript
 * const currency = getCurrencyForStock('AAPL', 'Apple Inc.', entryExitValues);
 * // Returns 'USD' or the currency from EntryExitValues
 * ```
 */
/** Nasdaq Nordic ticker suffixes that typically trade in SEK */
const SEK_TICKER_SUFFIXES = ['-B', '-A'];

function inferCurrencyFromTicker(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (SEK_TICKER_SUFFIXES.some((s) => upper.endsWith(s))) {
    return 'SEK';
  }
  return 'USD';
}

export function getCurrencyForStock(
  ticker: string,
  companyName: string,
  entryExitValues: Map<string, EntryExitValues>
): string {
  const entryExitValue = entryExitValues.get(companyName);
  const currency = entryExitValue?.currency;
  if (currency && currency.trim() !== '') {
    return currency;
  }
  return inferCurrencyFromTicker(ticker);
}
