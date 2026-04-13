/** Root collection for ISM symbol registry (`symbols/{symbolId}`). */
export const ISM_SYMBOL_FIRESTORE_COLLECTION = 'symbols';

/** Max batch size for Firestore writes (under 500 limit). */
export const ISM_SYMBOL_SYNC_WRITE_CHUNK = 400;
