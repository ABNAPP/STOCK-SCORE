/**
 * Global Score Model Settings — Firestore persistence (admin UI).
 *
 * Path: collection `appConfig`, document id `scoreModel`
 * Full path string: appConfig/scoreModel
 */
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  DEFAULT_SCORE_MODEL_METRICS,
  type ScoreModelMetricDraft,
} from '../config/scoreModelViewConfig';

export const SCORE_MODEL_FIRESTORE_COLLECTION = 'appConfig';
export const SCORE_MODEL_FIRESTORE_DOC_ID = 'scoreModel';

export const SCORE_MODEL_CONFIG_VERSION = 1;

/** Payload accepted by `saveGlobalScoreModelSettings` (draft rows from Settings UI). */
export type GlobalScoreModelSettingsConfig = ScoreModelMetricDraft[];

/** Stored metric shape (numbers for points; string conditions). */
export interface ScoreModelMetricFirestore {
  id: string;
  category: 'Fundamental' | 'Technical';
  label: string;
  fullCondition: string;
  fullPoints: number;
  halfCondition: string;
  halfPoints: number;
  zeroCondition: string;
  zeroPoints: number;
  active: boolean;
}

export interface ScoreModelConfigFirestorePayload {
  version: number;
  metrics: ScoreModelMetricFirestore[];
}

function draftRowToFirestore(row: ScoreModelMetricDraft): ScoreModelMetricFirestore {
  const parseNum = (raw: string, field: string): number => {
    const n = Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid number for "${row.displayName}" (${field}).`);
    }
    return n;
  };

  return {
    id: row.id,
    category: row.category,
    label: row.displayName,
    fullCondition: row.fullCondition,
    fullPoints: parseNum(row.fullPoints, 'fullPoints'),
    halfCondition: row.halfCondition,
    halfPoints: parseNum(row.halfPoints, 'halfPoints'),
    zeroCondition: row.zeroCondition,
    zeroPoints: parseNum(row.zeroPoints, 'zeroPoints'),
    active: true,
  };
}

function formatPointForDraft(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(6).replace(/\.?0+$/, '');
  return s;
}

function firestoreRowToDraft(
  row: ScoreModelMetricFirestore,
  fallback: ScoreModelMetricDraft
): ScoreModelMetricDraft {
  return {
    id: typeof row.id === 'string' && row.id ? row.id : fallback.id,
    category:
      row.category === 'Fundamental' || row.category === 'Technical'
        ? row.category
        : fallback.category,
    displayName: typeof row.label === 'string' && row.label.trim() ? row.label : fallback.displayName,
    fullCondition:
      typeof row.fullCondition === 'string' ? row.fullCondition : fallback.fullCondition,
    fullPoints: formatPointForDraft(typeof row.fullPoints === 'number' ? row.fullPoints : NaN),
    halfCondition:
      typeof row.halfCondition === 'string' ? row.halfCondition : fallback.halfCondition,
    halfPoints: formatPointForDraft(typeof row.halfPoints === 'number' ? row.halfPoints : NaN),
    zeroCondition:
      typeof row.zeroCondition === 'string' ? row.zeroCondition : fallback.zeroCondition,
    zeroPoints: formatPointForDraft(typeof row.zeroPoints === 'number' ? row.zeroPoints : NaN),
  };
}

function isMetricFirestoreRow(value: unknown): value is ScoreModelMetricFirestore {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    (o.category === 'Fundamental' || o.category === 'Technical') &&
    typeof o.label === 'string' &&
    typeof o.fullCondition === 'string' &&
    typeof o.fullPoints === 'number' &&
    Number.isFinite(o.fullPoints) &&
    typeof o.halfCondition === 'string' &&
    typeof o.halfPoints === 'number' &&
    Number.isFinite(o.halfPoints) &&
    typeof o.zeroCondition === 'string' &&
    typeof o.zeroPoints === 'number' &&
    Number.isFinite(o.zeroPoints)
  );
}

function mergeMetricsFromFirestore(parsed: ScoreModelMetricFirestore[]): ScoreModelMetricDraft[] {
  const byId = new Map(parsed.filter(isMetricFirestoreRow).map((m) => [m.id, m]));

  return DEFAULT_SCORE_MODEL_METRICS.map((def) => {
    const row = byId.get(def.id);
    if (!row) {
      return { ...def };
    }
    return firestoreRowToDraft(row, def);
  });
}

function timestampToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}

export interface LoadedGlobalScoreModelSettings {
  metrics: ScoreModelMetricDraft[];
  updatedAt: Date | null;
}

/**
 * Load global score model from Firestore (`appConfig/scoreModel`).
 * Call only after Auth is ready and user is signed in if rules require authentication.
 */
export async function loadGlobalScoreModelSettings(): Promise<
  | { ok: true; data: LoadedGlobalScoreModelSettings | null }
  | { ok: false; error: string }
> {
  try {
    const ref = doc(db, SCORE_MODEL_FIRESTORE_COLLECTION, SCORE_MODEL_FIRESTORE_DOC_ID);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return { ok: true, data: null };
    }

    const raw = snapshot.data();
    const version = typeof raw.version === 'number' ? raw.version : 0;
    if (version !== SCORE_MODEL_CONFIG_VERSION) {
      return {
        ok: false,
        error: `Unsupported score model version (${version}). Expected ${SCORE_MODEL_CONFIG_VERSION}.`,
      };
    }

    const metricsRaw = raw.metrics;
    if (!Array.isArray(metricsRaw)) {
      return { ok: false, error: 'Invalid score model document: metrics must be an array.' };
    }

    const parsed: ScoreModelMetricFirestore[] = [];
    for (const item of metricsRaw) {
      if (!isMetricFirestoreRow(item)) {
        return { ok: false, error: 'Invalid score model document: invalid metric row.' };
      }
      parsed.push({
        ...item,
        active: typeof item.active === 'boolean' ? item.active : true,
      });
    }

    const merged = mergeMetricsFromFirestore(parsed);
    const updatedAt = timestampToDate(raw.updatedAt);

    return { ok: true, data: { metrics: merged, updatedAt } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Persist global score model to Firestore (`appConfig/scoreModel`).
 * Requires Firestore rules allowing admin write.
 */
export async function saveGlobalScoreModelSettings(
  config: GlobalScoreModelSettingsConfig
): Promise<void> {
  const metrics = config.map(draftRowToFirestore);
  const ref = doc(db, SCORE_MODEL_FIRESTORE_COLLECTION, SCORE_MODEL_FIRESTORE_DOC_ID);
  await setDoc(ref, {
    version: SCORE_MODEL_CONFIG_VERSION,
    updatedAt: serverTimestamp(),
    metrics,
  });
}
