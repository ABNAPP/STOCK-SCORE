/**
 * Personal Portfolio Service
 * 
 * Provides functionality to save and load personal portfolio data in Firestore.
 * Each user has their own portfolio stored in userPortfolios/{userId}.
 * Falls back to localStorage if Firestore is unavailable.
 */

import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { PortfolioItem, UserPortfolio } from '../types/portfolio';
import { EntryExitValues } from '../contexts/EntryExitContext';

const COLLECTION_NAME = 'userPortfolios';
const STORAGE_KEY = 'personalPortfolio';

/**
 * Get user portfolio from Firestore
 */
export async function getUserPortfolio(userId: string): Promise<UserPortfolio | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Try to load from localStorage as fallback
      return getPortfolioFromLocalStorage(userId);
    }

    const data = docSnap.data();
    return {
      userId,
      portfolio: (data.portfolio as PortfolioItem[]) || [],
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    };
  } catch (error) {
    // Handle permissions errors gracefully - fallback to localStorage
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when getting user portfolio, using localStorage', {
        component: 'personalPortfolioService',
        operation: 'getUserPortfolio',
        userId,
        error: error.message,
      });
      return getPortfolioFromLocalStorage(userId);
    }
    
    logger.error('Error getting user portfolio', error, {
      component: 'personalPortfolioService',
      operation: 'getUserPortfolio',
      userId,
    });
    // Fallback to localStorage
    return getPortfolioFromLocalStorage(userId);
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

    // Also save to localStorage as backup
    savePortfolioToLocalStorage(userId, portfolio);

    logger.debug(`User portfolio saved for ${userId}`, {
      component: 'personalPortfolioService',
      operation: 'saveUserPortfolio',
      userId,
      itemCount: portfolio.length,
    });
  } catch (error) {
    // Handle permissions errors gracefully
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when saving user portfolio, using localStorage', {
        component: 'personalPortfolioService',
        operation: 'saveUserPortfolio',
        userId,
        error: error.message,
      });
      // Save to localStorage as fallback
      savePortfolioToLocalStorage(userId, portfolio);
      return;
    }
    
    logger.error('Error saving user portfolio', error, {
      component: 'personalPortfolioService',
      operation: 'saveUserPortfolio',
      userId,
    });
    // Save to localStorage as fallback
    savePortfolioToLocalStorage(userId, portfolio);
  }
}

/**
 * Add a portfolio item
 */
export async function addPortfolioItem(
  userId: string,
  item: PortfolioItem
): Promise<void> {
  const currentPortfolio = await getUserPortfolio(userId);
  const portfolio = currentPortfolio?.portfolio || [];
  
  // Check if item already exists (by ticker)
  const existingIndex = portfolio.findIndex(
    p => p.ticker.toLowerCase() === item.ticker.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    // Update existing item
    portfolio[existingIndex] = item;
  } else {
    // Add new item
    portfolio.push(item);
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
 * Update a portfolio item
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
  
  const portfolio = currentPortfolio.portfolio.map(p => {
    if (p.ticker.toLowerCase() === ticker.toLowerCase()) {
      return { ...p, ...updates };
    }
    return p;
  });
  
  await saveUserPortfolio(userId, portfolio);
}

/**
 * Get portfolio from localStorage (fallback)
 */
function getPortfolioFromLocalStorage(userId: string): UserPortfolio | null {
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    
    const data = JSON.parse(stored);
    return {
      userId,
      portfolio: data.portfolio || [],
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    };
  } catch (error) {
    logger.warn('Error reading portfolio from localStorage', {
      component: 'personalPortfolioService',
      operation: 'getPortfolioFromLocalStorage',
      userId,
      error,
    });
    return null;
  }
}

/**
 * Save portfolio to localStorage (fallback)
 */
function savePortfolioToLocalStorage(userId: string, portfolio: PortfolioItem[]): void {
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    const data = {
      userId,
      portfolio,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logger.warn('Error saving portfolio to localStorage', {
      component: 'personalPortfolioService',
      operation: 'savePortfolioToLocalStorage',
      userId,
      error,
    });
  }
}

/**
 * Get currency for a stock from EntryExitValues
 * 
 * Returns the currency for a stock from EntryExitValues map,
 * or defaults to 'USD' if not found.
 * 
 * @param ticker - Stock ticker symbol
 * @param companyName - Company name
 * @param entryExitValues - Map of EntryExitValues keyed by `${ticker}-${companyName}`
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
  const key = `${ticker}-${companyName}`;
  const entryExitValue = entryExitValues.get(key);
  const currency = entryExitValue?.currency;
  if (currency && currency.trim() !== '') {
    return currency;
  }
  return inferCurrencyFromTicker(ticker);
}
