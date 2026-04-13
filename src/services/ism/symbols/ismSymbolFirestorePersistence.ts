/**
 * Official ISM `symbols/{symbolId}` persistence (Firestore).
 * Same auth model as `ismFetchEngine` — no browser localStorage for motor/registry state.
 */

import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logger } from '../../../utils/logger';
import type { ISMInstrumentIngest } from '../../../types/ismIngest';
import type { IsmSymbolFirestoreDoc } from '../../../types/ismSymbolDocument';
import { getExchangeRate } from '../../currencyService';
import { validateEntryExitValue } from '../../../utils/inputValidator';
import type { IsmFetchEngineState } from '../fetchEngine/types';
import { buildIsmSymbolFirestoreDoc, type BuildIsmSymbolDocParams } from './buildIsmSymbolFirestoreDoc';
import { usdPerUnitFromUsdBaseRates } from './usdPerUnitLocal';
import { ISM_SYMBOL_FIRESTORE_COLLECTION, ISM_SYMBOL_SYNC_WRITE_CHUNK } from './constants';

function symbolRef(symbolId: string) {
  return doc(db, ISM_SYMBOL_FIRESTORE_COLLECTION, symbolId);
}

export async function loadIsmSymbolDoc(
  user: User | null,
  symbolId: string
): Promise<Partial<IsmSymbolFirestoreDoc> | null> {
  if (!user) return null;
  try {
    const snap = await getDoc(symbolRef(symbolId));
    if (!snap.exists()) return null;
    return snap.data() as Partial<IsmSymbolFirestoreDoc>;
  } catch (e) {
    if (e instanceof Error && e.message.includes('permission')) {
      logger.warn('ISM symbol doc read denied', { component: 'ismSymbolFirestore', symbolId, error: e.message });
      return null;
    }
    logger.error(
      'ISM symbol doc load failed',
      e instanceof Error ? e : new Error(String(e)),
      { component: 'ismSymbolFirestore', symbolId }
    );
    return null;
  }
}

export async function saveIsmSymbolDoc(user: User | null, symbolId: string, body: Record<string, unknown>): Promise<void> {
  if (!user) return;
  try {
    const ref = symbolRef(symbolId);
    const prev = await getDoc(ref);
    const createdAt = prev.exists() && prev.data()?.created_at != null ? prev.data()?.created_at : serverTimestamp();
    await setDoc(
      ref,
      {
        ...body,
        created_at: createdAt,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('permission')) {
      logger.warn('ISM symbol doc write denied', { component: 'ismSymbolFirestore', symbolId, error: e.message });
      return;
    }
    logger.error(
      'ISM symbol doc save failed',
      e instanceof Error ? e : new Error(String(e)),
      { component: 'ismSymbolFirestore', symbolId }
    );
  }
}

export type SyncIsmSymbolsFromIngestContext = Pick<
  BuildIsmSymbolDocParams,
  | 'fetchEngineState'
  | 'latestPriceDateIso'
  | 'top30IncludedSymbolIds'
  | 'priceSeriesAnomaly'
  | 'instrumentMappingConflict'
  | 'usdBaseRates'
> & {
  getHasEntryExitRow: (ticker: string, companyName: string) => boolean;
  latestPriceDateBySymbolId?: Record<string, string | null>;
  priceSeriesAnomalyBySymbolId?: Record<string, boolean>;
  instrumentMappingConflictBySymbolId?: Record<string, boolean>;
};

/**
 * Upserts symbol docs from ingest + ENTRY/EXIT row presence + optional official fetch engine state.
 */
export async function syncIsmSymbolsFromIngest(
  user: User | null,
  rows: ISMInstrumentIngest[],
  ctx: SyncIsmSymbolsFromIngestContext
): Promise<void> {
  if (!user || rows.length === 0) return;

  const { fetchEngineState, getHasEntryExitRow } = ctx;

  const uniqueCurrencies = new Set<string>();
  for (const r of rows) {
    const t = r.currency.trim();
    if (!t || !validateEntryExitValue('currency', t).isValid) continue;
    uniqueCurrencies.add(t.toUpperCase());
  }

  const usdPerUnitByCurrency = new Map<string, number | null>();
  if (ctx.usdBaseRates) {
    for (const c of uniqueCurrencies) {
      usdPerUnitByCurrency.set(c, c === 'USD' ? 1 : usdPerUnitFromUsdBaseRates(c, ctx.usdBaseRates));
    }
  } else {
    for (const c of uniqueCurrencies) {
      if (c === 'USD') {
        usdPerUnitByCurrency.set(c, 1);
      } else {
        try {
          const rate = await getExchangeRate(c, 'USD');
          usdPerUnitByCurrency.set(c, rate);
        } catch {
          usdPerUnitByCurrency.set(c, null);
        }
      }
    }
  }

  for (let i = 0; i < rows.length; i += ISM_SYMBOL_SYNC_WRITE_CHUNK) {
    const slice = rows.slice(i, i + ISM_SYMBOL_SYNC_WRITE_CHUNK);
    const prevSnaps = await Promise.all(slice.map((r) => getDoc(symbolRef(r.symbolId))));
    const createdAtById = new Map<string, unknown>();
    slice.forEach((r, idx) => {
      const data = prevSnaps[idx]?.data();
      createdAtById.set(r.symbolId, data?.created_at != null ? data.created_at : serverTimestamp());
    });

    const batch = writeBatch(db);
    for (let j = 0; j < slice.length; j++) {
      const ingest = slice[j]!;
      const fetchState = fetchEngineState?.perSymbol[ingest.symbolId] ?? null;
      const latestPriceDateIso =
        ctx.latestPriceDateBySymbolId?.[ingest.symbolId] ?? ctx.latestPriceDateIso ?? null;
      const curUpper = ingest.currency.trim().toUpperCase();
      const usdPer =
        ingest.currency.trim() && validateEntryExitValue('currency', ingest.currency.trim()).isValid
          ? usdPerUnitByCurrency.get(curUpper) ?? null
          : null;
      const body = buildIsmSymbolFirestoreDoc({
        ingest,
        hasEntryExitRow: getHasEntryExitRow(ingest.tickerRaw, ingest.companyName),
        usdPerUnitLocalCurrency: usdPer,
        fetchState,
        fetchEngineState,
        latestPriceDateIso,
        top30IncludedSymbolIds: ctx.top30IncludedSymbolIds,
        priceSeriesAnomaly: ctx.priceSeriesAnomalyBySymbolId?.[ingest.symbolId] ?? ctx.priceSeriesAnomaly,
        instrumentMappingConflict:
          ctx.instrumentMappingConflictBySymbolId?.[ingest.symbolId] ?? ctx.instrumentMappingConflict,
      });
      batch.set(
        symbolRef(ingest.symbolId),
        {
          ...body,
          created_at: createdAtById.get(ingest.symbolId),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (e) {
      if (e instanceof Error && e.message.includes('permission')) {
        logger.warn('ISM symbol batch write denied', { component: 'ismSymbolFirestore', error: e.message });
        return;
      }
      logger.error(
        'ISM symbol batch commit failed',
        e instanceof Error ? e : new Error(String(e)),
        { component: 'ismSymbolFirestore' }
      );
      return;
    }
  }
}

export async function deleteIsmSymbolDoc(user: User | null, symbolId: string): Promise<void> {
  if (!user) return;
  try {
    await deleteDoc(symbolRef(symbolId));
  } catch (e) {
    logger.error(
      'ISM symbol doc delete failed',
      e instanceof Error ? e : new Error(String(e)),
      { component: 'ismSymbolFirestore', symbolId }
    );
  }
}

/** List symbol ids currently stored (capped scan — use sparingly). */
export async function listIsmSymbolDocIds(user: User | null, maxDocs: number): Promise<string[]> {
  if (!user) return [];
  try {
    const q = query(collection(db, ISM_SYMBOL_FIRESTORE_COLLECTION), limit(maxDocs));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}
