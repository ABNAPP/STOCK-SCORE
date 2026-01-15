/**
 * Data Change Detector
 * 
 * Utility functions to detect changes in data arrays and generate change summaries.
 */

export interface DataChangeSummary {
  added: number;
  removed: number;
  updated: number;
  total: number;
  hasSignificantChanges: boolean;
}

/**
 * Compare two data arrays and detect changes
 * 
 * @param oldData Previous data array
 * @param newData New data array
 * @param getKey Function to extract unique key from data item
 * @param threshold Minimum percentage change to consider significant (default: 5%)
 * @returns Summary of changes
 */
export function detectDataChanges<T>(
  oldData: T[],
  newData: T[],
  getKey: (item: T) => string,
  threshold: number = 0.05
): DataChangeSummary {
  if (!oldData || oldData.length === 0) {
    return {
      added: newData.length,
      removed: 0,
      updated: 0,
      total: newData.length,
      hasSignificantChanges: newData.length > 0,
    };
  }

  if (!newData || newData.length === 0) {
    return {
      added: 0,
      removed: oldData.length,
      updated: 0,
      total: 0,
      hasSignificantChanges: oldData.length > 0,
    };
  }

  // Create maps for efficient lookup
  const oldMap = new Map<string, T>();
  const newMap = new Map<string, T>();

  oldData.forEach((item) => {
    const key = getKey(item);
    oldMap.set(key, item);
  });

  newData.forEach((item) => {
    const key = getKey(item);
    newMap.set(key, item);
  });

  // Detect changes
  let added = 0;
  let removed = 0;
  let updated = 0;

  // Find added items
  newMap.forEach((item, key) => {
    if (!oldMap.has(key)) {
      added++;
    }
  });

  // Find removed items
  oldMap.forEach((item, key) => {
    if (!newMap.has(key)) {
      removed++;
    }
  });

  // Find updated items (same key but different content)
  newMap.forEach((newItem, key) => {
    const oldItem = oldMap.get(key);
    if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      updated++;
    }
  });

  const total = newData.length;
  const totalChanges = added + removed + updated;
  const changePercentage = total > 0 ? totalChanges / total : 0;
  const hasSignificantChanges = changePercentage >= threshold || totalChanges > 10;

  return {
    added,
    removed,
    updated,
    total,
    hasSignificantChanges,
  };
}

/**
 * Generate a human-readable change summary
 */
export function formatChangeSummary(summary: DataChangeSummary): string {
  const parts: string[] = [];

  if (summary.added > 0) {
    parts.push(`${summary.added} ${summary.added === 1 ? 'item added' : 'items added'}`);
  }
  if (summary.removed > 0) {
    parts.push(`${summary.removed} ${summary.removed === 1 ? 'item removed' : 'items removed'}`);
  }
  if (summary.updated > 0) {
    parts.push(`${summary.updated} ${summary.updated === 1 ? 'item updated' : 'items updated'}`);
  }

  if (parts.length === 0) {
    return 'No changes detected';
  }

  return parts.join(', ');
}
