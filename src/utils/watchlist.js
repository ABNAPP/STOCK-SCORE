const WATCHLIST_KEY = 'scoreAppWatchlist'

/**
 * Hämtar watchlist från localStorage
 */
export function getWatchlist() {
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

/**
 * Sparar watchlist till localStorage
 */
export function saveWatchlist(ids) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids))
  } catch (error) {
    console.error('Failed to save watchlist:', error)
  }
}

/**
 * Toggle item i watchlist
 */
export function toggleWatchlist(id, currentList) {
  const index = currentList.indexOf(id)
  const newList = [...currentList]
  
  if (index >= 0) {
    newList.splice(index, 1)
  } else {
    newList.push(id)
  }
  
  saveWatchlist(newList)
  return newList
}

/**
 * Kontrollerar om item finns i watchlist
 */
export function isInWatchlist(id, watchlist) {
  return watchlist.includes(id)
}

