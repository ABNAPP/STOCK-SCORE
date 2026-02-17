/**
 * migrateFromLocalStorage - NO-OP
 *
 * Previously migrated from localStorage cache to Firestore.
 * Firestore is now the only data source; no localStorage is used.
 * Kept for migration module compatibility.
 */

export function migrateFromLocalStorage(): void {
  // No-op: Firestore is the only data source
}
