/** Calendar days per bootstrap history chunk (one provider call). */
export const ISM_HISTORY_CHUNK_DAYS = 90;

/** Rolling history target (5 years). */
export const ISM_HISTORY_TARGET_DAYS = 5 * 365;

/** Max failed attempts per symbol before bootstrap is marked blocked. */
export const ISM_MAX_HISTORY_FAILURES_BEFORE_BLOCK = 5;

/** Top N symbols by market cap (USD from sheet) get highest bootstrap priority. */
export const ISM_BOOTSTRAP_TOP_MARKET_CAP_COUNT = 30;

/** Default max provider calls per local calendar day (bootstrap + daily combined counter). */
export const ISM_DEFAULT_DAILY_CALL_BUDGET = 60;

/**
 * Max bootstrap history provider calls (chunks) per `tickIsmBootstrap` (then yield).
 * Same symbol may consume multiple slots when still backfilling.
 */
export const ISM_BOOTSTRAP_MAX_SYMBOLS_PER_INVOCATION = 2;

/** Max latest-close fetches per `tickIsmDaily` before yielding (FX is separate). */
export const ISM_DAILY_MAX_PRICE_FETCHES_PER_INVOCATION = 8;

/** FX refresh skip window: if younger than this, daily tick skips FX (ms). */
export const ISM_FX_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

/** Firestore collection for shared org-wide ISM fetch motor state (official persistence). */
export const ISM_FETCH_ENGINE_FIRESTORE_COLLECTION = 'ismFetchEngine';

/** Singleton document id within {@link ISM_FETCH_ENGINE_FIRESTORE_COLLECTION}. */
export const ISM_FETCH_ENGINE_FIRESTORE_DOC_ID = 'shared';
