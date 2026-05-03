import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cloneDefaultScoreModelDraft,
  DEFAULT_SCORE_MODEL_METRICS,
  type ScoreModelMetricDraft,
} from '../config/scoreModelViewConfig';
import {
  loadGlobalScoreModelSettings,
  saveGlobalScoreModelSettings,
  SCORE_MODEL_FIRESTORE_COLLECTION,
  SCORE_MODEL_FIRESTORE_DOC_ID,
} from '../services/scoreModelFirestoreService';
import { validateScoreModelDraft } from '../utils/scoreModelDraftValidation';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

function formatUpdatedAt(d: Date | null): string {
  if (!d) return '—';
  try {
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

/** Display summary totals prominently (whole numbers without trailing zeros when exact). */
function formatSummaryNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(4).replace(/\.?0+$/, '');
}

interface ScoreMetricsTableProps {
  rows: ScoreModelMetricDraft[];
  isEditing: boolean;
  inputCls: string;
  updateRow: (id: string, patch: Partial<ScoreModelMetricDraft>) => void;
}

function ScoreMetricsTable({ rows, isEditing, inputCls, updateRow }: ScoreMetricsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-gray-700/90 bg-white dark:bg-gray-800/90 shadow-sm">
      <div className="max-h-[min(70vh,720px)] overflow-y-auto overscroll-x-contain">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-600 bg-stone-100/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 whitespace-nowrap"
              >
                Metric
              </th>
              <th
                scope="col"
                className="py-3.5 px-3 text-left text-xs font-semibold text-emerald-800/90 dark:text-emerald-300/90 whitespace-nowrap border-l border-gray-200/80 dark:border-gray-600/80"
              >
                Full — condition
              </th>
              <th
                scope="col"
                className="py-3.5 px-3 text-left text-xs font-semibold text-emerald-800/90 dark:text-emerald-300/90 whitespace-nowrap"
              >
                Full pts
              </th>
              <th
                scope="col"
                className="py-3.5 px-3 text-left text-xs font-semibold text-amber-800/90 dark:text-amber-200/90 whitespace-nowrap border-l border-gray-200/80 dark:border-gray-600/80"
              >
                Half — condition
              </th>
              <th
                scope="col"
                className="py-3.5 px-3 text-left text-xs font-semibold text-amber-800/90 dark:text-amber-200/90 whitespace-nowrap"
              >
                Half pts
              </th>
              <th
                scope="col"
                className="py-3.5 px-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap border-l border-gray-200/80 dark:border-gray-600/80"
              >
                Zero — condition
              </th>
              <th
                scope="col"
                className="py-3.5 pr-4 pl-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap"
              >
                Zero pts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {rows.map((row) => (
              <tr key={row.id} className="align-top bg-white/80 dark:bg-gray-800/50 hover:bg-stone-50/80 dark:hover:bg-gray-800/80 transition-colors">
                <td className="py-3.5 pl-4 pr-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {row.displayName}
                </td>
                {isEditing ? (
                  <>
                    <td className="py-2.5 px-3 border-l border-gray-100 dark:border-gray-700/60">
                      <input
                        className={inputCls}
                        value={row.fullCondition}
                        onChange={(e) => updateRow(row.id, { fullCondition: e.target.value })}
                        aria-label={`${row.displayName} full condition`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        className={inputCls}
                        value={row.fullPoints}
                        onChange={(e) => updateRow(row.id, { fullPoints: e.target.value })}
                        aria-label={`${row.displayName} full points`}
                      />
                    </td>
                    <td className="py-2.5 px-3 border-l border-gray-100 dark:border-gray-700/60">
                      <input
                        className={inputCls}
                        value={row.halfCondition}
                        onChange={(e) => updateRow(row.id, { halfCondition: e.target.value })}
                        aria-label={`${row.displayName} half condition`}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        className={inputCls}
                        value={row.halfPoints}
                        onChange={(e) => updateRow(row.id, { halfPoints: e.target.value })}
                        aria-label={`${row.displayName} half points`}
                      />
                    </td>
                    <td className="py-2.5 px-3 border-l border-gray-100 dark:border-gray-700/60">
                      <input
                        className={inputCls}
                        value={row.zeroCondition}
                        onChange={(e) => updateRow(row.id, { zeroCondition: e.target.value })}
                        aria-label={`${row.displayName} zero condition`}
                      />
                    </td>
                    <td className="py-2.5 pr-4 pl-3">
                      <input
                        className={inputCls}
                        value={row.zeroPoints}
                        onChange={(e) => updateRow(row.id, { zeroPoints: e.target.value })}
                        aria-label={`${row.displayName} zero points`}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3.5 px-3 border-l border-gray-100 dark:border-gray-700/60 font-mono text-xs text-gray-800 dark:text-gray-200">
                      {row.fullCondition}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums text-gray-900 dark:text-gray-100">
                      {row.fullPoints}
                    </td>
                    <td className="py-3.5 px-3 border-l border-gray-100 dark:border-gray-700/60 font-mono text-xs text-gray-800 dark:text-gray-200">
                      {row.halfCondition.trim() ? row.halfCondition : '—'}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums text-gray-800 dark:text-gray-200">
                      {row.halfPoints}
                    </td>
                    <td className="py-3.5 px-3 border-l border-gray-100 dark:border-gray-700/60 font-mono text-xs text-gray-800 dark:text-gray-200">
                      {row.zeroCondition}
                    </td>
                    <td className="py-3.5 pr-4 pl-3 tabular-nums text-gray-800 dark:text-gray-200">
                      {row.zeroPoints}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScoreModelSettingsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { isAdmin } = useUserRole();

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState<ScoreModelMetricDraft[]>(() =>
    cloneDefaultScoreModelDraft()
  );
  const [hasFirestoreDoc, setHasFirestoreDoc] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ScoreModelMetricDraft[]>(() => cloneDefaultScoreModelDraft());
  const [editBaselineSerialized, setEditBaselineSerialized] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setLoadError(null);
      setDisplayMetrics(cloneDefaultScoreModelDraft());
      setHasFirestoreDoc(false);
      setUpdatedAt(null);
      setLoadStatus('loaded');
      return;
    }

    let cancelled = false;
    setLoadStatus('loading');
    setLoadError(null);

    (async () => {
      const result = await loadGlobalScoreModelSettings();
      if (cancelled) return;

      if (!result.ok) {
        setLoadError(result.error);
        setDisplayMetrics(cloneDefaultScoreModelDraft());
        setHasFirestoreDoc(false);
        setUpdatedAt(null);
        setLoadStatus('loaded');
        return;
      }

      if (result.data === null) {
        setDisplayMetrics(cloneDefaultScoreModelDraft());
        setHasFirestoreDoc(false);
        setUpdatedAt(null);
      } else {
        setDisplayMetrics(result.data.metrics);
        setHasFirestoreDoc(true);
        setUpdatedAt(result.data.updatedAt);
      }
      setLoadStatus('loaded');
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, authLoading]);

  const enterEditMode = useCallback(() => {
    setSaveError(null);
    setDraft(displayMetrics.map((row) => ({ ...row })));
    setEditBaselineSerialized(JSON.stringify(displayMetrics));
    setIsEditing(true);
  }, [displayMetrics]);

  const resetDraftToDefault = useCallback(() => {
    setDraft(cloneDefaultScoreModelDraft());
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditBaselineSerialized(null);
    setSaveError(null);
  }, []);

  const saveToFirestore = useCallback(async () => {
    if (!editBaselineSerialized) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveGlobalScoreModelSettings(draft);
      const result = await loadGlobalScoreModelSettings();
      if (result.ok && result.data) {
        setDisplayMetrics(result.data.metrics);
        setUpdatedAt(result.data.updatedAt);
      } else {
        setDisplayMetrics(draft.map((r) => ({ ...r })));
        setUpdatedAt(new Date());
      }
      setHasFirestoreDoc(true);
      setIsEditing(false);
      setEditBaselineSerialized(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      /* Stay in edit mode; draft unchanged in state (already applied). */
    } finally {
      setIsSaving(false);
    }
  }, [draft, editBaselineSerialized]);

  const updateRow = useCallback((id: string, patch: Partial<ScoreModelMetricDraft>) => {
    setDraft((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const displayRows = isEditing ? draft : displayMetrics;

  const validation = useMemo(() => {
    return validateScoreModelDraft(displayRows);
  }, [displayRows]);

  const fundamentalRows = useMemo(
    () => displayRows.filter((r) => r.category === 'Fundamental'),
    [displayRows]
  );
  const technicalRows = useMemo(
    () => displayRows.filter((r) => r.category === 'Technical'),
    [displayRows]
  );

  const matchesBuiltInDefault = useMemo(() => {
    return JSON.stringify(displayMetrics) === JSON.stringify(DEFAULT_SCORE_MODEL_METRICS);
  }, [displayMetrics]);

  const dirty =
    isEditing &&
    editBaselineSerialized !== null &&
    JSON.stringify(draft) !== editBaselineSerialized;

  const canSave =
    validation.ok &&
    dirty &&
    !isSaving &&
    loadStatus === 'loaded' &&
    !authLoading &&
    Boolean(currentUser) &&
    isAdmin;

  const totalMismatch = Math.abs(validation.totalWeight - 100) > 0.001;

  const inputCls =
    'w-full min-w-[5.5rem] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm ring-offset-white dark:ring-offset-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:border-blue-400';

  const firestorePath = `${SCORE_MODEL_FIRESTORE_COLLECTION}/${SCORE_MODEL_FIRESTORE_DOC_ID}`;

  return (
    <div className="h-full bg-stone-100/90 dark:bg-stone-950 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1100px] mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/management-monitoring"
            className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
          >
            ← Back to Management Monitoring
          </Link>
          {!isEditing ? (
            <button
              type="button"
              onClick={enterEditMode}
              disabled={
                !currentUser ||
                authLoading ||
                loadStatus === 'loading' ||
                loadStatus === 'idle'
              }
              className="rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit model
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetDraftToDefault}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm disabled:opacity-50"
              >
                Cancel
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void saveToFirestore()}
                  disabled={!canSave}
                  title={
                    !validation.ok
                      ? 'Fix validation issues before saving'
                      : !dirty
                        ? 'No changes to save'
                        : !currentUser
                          ? 'Sign in to save'
                          : undefined
                  }
                  className="rounded-lg bg-blue-600 dark:bg-blue-500 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving…' : 'Save to Firestore'}
                </button>
              ) : (
                <span
                  className="rounded-lg border border-dashed border-gray-400 dark:border-gray-500 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400"
                  title="Only admin can save global score model settings"
                >
                  Only admin can save global score model settings
                </span>
              )}
            </div>
          )}
        </div>

        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            Score Model Settings
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Global model for the app (stored in Firestore). Saving does not yet change stock SCORE
            calculations or the SCORE tab — wiring comes in a later step.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 font-mono">
            Firestore path: <span className="select-all">{firestorePath}</span>
          </p>

          <div
            className="mt-4 rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white/90 dark:bg-gray-900/50 px-4 py-3.5 text-sm text-gray-700 dark:text-gray-300 shadow-sm"
            role="note"
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Firestore and permissions
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm leading-relaxed">
              <li>
                Document path: <code className="font-mono text-[13px]">{firestorePath}</code>
              </li>
              <li>
                Saving requires <strong>deployed Firestore rules</strong> that allow writes (run{' '}
                <code className="font-mono text-[11px] sm:text-xs">
                  firebase deploy --only firestore:rules
                </code>{' '}
                from the project root if rules are not deployed yet).
              </li>
              <li>
                Only users with the <strong>admin</strong> role can save; viewers see the model but
                cannot persist changes.
              </li>
            </ul>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {authLoading || loadStatus === 'loading' || loadStatus === 'idle' ? (
              <p className="text-gray-600 dark:text-gray-400">Loading global score model…</p>
            ) : null}

            {loadError ? (
              <p className="rounded-xl border border-amber-200/90 dark:border-amber-900/40 bg-amber-50/95 dark:bg-amber-950/30 px-4 py-3 text-amber-950 dark:text-amber-100 shadow-sm">
                <span className="font-semibold">Could not load Firestore config</span> — showing
                built-in default. You can still review the tables below. {loadError}
              </p>
            ) : null}

            {!authLoading && !currentUser ? (
              <p className="rounded-xl border border-amber-200/90 dark:border-amber-900/40 bg-amber-50/95 dark:bg-amber-950/25 px-4 py-3 text-amber-900 dark:text-amber-100 shadow-sm">
                Sign in to load the global model from Firestore. Firestore reads require an
                authenticated session per security rules.
              </p>
            ) : null}

            {loadStatus === 'loaded' && !isEditing ? (
              <div className="rounded-xl border border-gray-200/90 dark:border-gray-600 bg-white/95 dark:bg-gray-800/90 px-4 py-3 text-gray-800 dark:text-gray-200 shadow-sm">
                {hasFirestoreDoc ? (
                  <p>
                    <span className="font-semibold">Saved global model</span> — last updated{' '}
                    {formatUpdatedAt(updatedAt)}.
                    {matchesBuiltInDefault ? (
                      <span className="text-gray-600 dark:text-gray-400">
                        {' '}
                        (same weights as built-in default.)
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold">Built-in default</span> — no{' '}
                    <code className="font-mono text-xs">{firestorePath}</code> document yet. Save to
                    create it.
                  </p>
                )}
              </div>
            ) : null}

            {isEditing ? (
              <div className="rounded-xl border border-blue-200/90 dark:border-blue-900/45 bg-blue-50/90 dark:bg-blue-950/25 px-4 py-3 text-blue-950 dark:text-blue-100 shadow-sm">
                <span className="font-semibold">Edit mode</span>
                {' — '}
                {dirty ? (
                  <span>Unsaved draft (not written to Firestore until you save).</span>
                ) : (
                  <span>No edits yet since opening edit mode.</span>
                )}
              </div>
            ) : null}

            {saveError ? (
              <p className="rounded-xl border border-red-200/90 dark:border-red-900/50 bg-red-50/95 dark:bg-red-950/30 px-4 py-3 text-red-900 dark:text-red-200 shadow-sm">
                Save failed: {saveError}
              </p>
            ) : null}
          </div>
        </header>

        <section
          className="rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white/95 dark:bg-gray-800/90 p-5 sm:p-6 mb-8 shadow-sm"
          aria-labelledby="score-model-summary-heading"
        >
          <h2
            id="score-model-summary-heading"
            className="text-base font-semibold text-gray-900 dark:text-white mb-1"
          >
            Weight summary
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Maximum points per tier come from the sum of &quot;full&quot; column weights (Fundamental +
            Technical should total 100).
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200/90 dark:border-gray-600 bg-stone-50/90 dark:bg-gray-900/40 px-5 py-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Fundamental max
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                {formatSummaryNumber(validation.fundamentalMax)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200/90 dark:border-gray-600 bg-stone-50/90 dark:bg-gray-900/40 px-5 py-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Technical max
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                {formatSummaryNumber(validation.technicalMax)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200/90 dark:border-gray-600 bg-stone-50/90 dark:bg-gray-900/40 px-5 py-5 shadow-sm ring-1 ring-inset ring-gray-200/60 dark:ring-gray-600/60">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total score
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                {formatSummaryNumber(validation.totalWeight)}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200/90 dark:border-gray-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Validation
            </p>
            {validation.ok ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200">
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>
                  Model is consistent: total equals <strong>100</strong> and all point fields are
                  valid numbers.
                </span>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-amber-200/90 bg-amber-50/85 px-4 py-3 dark:border-amber-900/45 dark:bg-amber-950/25">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  Adjust the values below until the model validates.
                </div>
                {totalMismatch ? (
                  <p className="text-sm text-amber-950/95 dark:text-amber-100/95 leading-relaxed">
                    The sum of all <strong>full points</strong> must equal{' '}
                    <strong className="tabular-nums">100</strong> (currently{' '}
                    <strong className="tabular-nums">{formatSummaryNumber(validation.totalWeight)}</strong>
                    ). Change full-point weights so Fundamental + Technical totals match.
                  </p>
                ) : null}
                <ul className="list-disc list-inside space-y-1.5 text-sm text-amber-950/95 dark:text-amber-100/90 leading-relaxed">
                  {validation.issues.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="score-model-metrics-heading" className="space-y-10">
          <div>
            <h2
              id="score-model-metrics-heading"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Scoring rules by metric
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Each row is one metric. Read left to right: when the <strong>full</strong> condition
              holds you get full points; otherwise check <strong>half</strong>, then{' '}
              <strong>zero</strong>. Condition cells use monospace for readability.
            </p>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-baseline gap-2 gap-y-1">
              <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                Fundamental
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {fundamentalRows.length} metrics · full points sum to Fundamental max
              </span>
            </div>
            <ScoreMetricsTable
              rows={fundamentalRows}
              isEditing={isEditing}
              inputCls={inputCls}
              updateRow={updateRow}
            />
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-baseline gap-2 gap-y-1">
              <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                Technical
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {technicalRows.length} metric · full points sum to Technical max
              </span>
            </div>
            <ScoreMetricsTable
              rows={technicalRows}
              isEditing={isEditing}
              inputCls={inputCls}
              updateRow={updateRow}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
