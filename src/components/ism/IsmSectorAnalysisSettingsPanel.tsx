import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ISM_LOCAL_BREADTH_RANGE,
  ISM_LOCAL_RS_MA_RANGE,
  ISM_LOCAL_SECTOR_SMA_RANGE,
  ISM_LOCAL_SLOPE_RANGE,
  clampLocalParams,
  type IsmLocalParamSettings,
} from './ismSectorLocalAnalysisDefaults';
import { useIsmSectorDetailLocal } from './IsmSectorDetailLocalContext';
import Button from '../ui/Button';

function numOrDefault(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export default function IsmSectorAnalysisSettingsPanel() {
  const { t } = useTranslation();
  const { committedLocalParams, applyDraftParams, resetParamsToDefaultsInPanel } = useIsmSectorDetailLocal();
  const [draft, setDraft] = useState<IsmLocalParamSettings>(committedLocalParams);

  useEffect(() => {
    setDraft(committedLocalParams);
  }, [committedLocalParams]);

  return (
    <section
      className="mb-4 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-gray-800 p-3"
      aria-label={t('ism.detail.localSettingsAria')}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        {t('ism.detail.localSettingsTitle')}
      </h2>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{t('ism.detail.localSettingsHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('ism.detail.localSlopeLookback')}
          </span>
          <input
            type="number"
            min={ISM_LOCAL_SLOPE_RANGE.min}
            max={ISM_LOCAL_SLOPE_RANGE.max}
            className="rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            value={draft.slopeLookback}
            onChange={(e) => setDraft((d) => ({ ...d, slopeLookback: numOrDefault(e.target.value, d.slopeLookback) }))}
          />
          <span className="text-[10px] text-gray-400">
            {ISM_LOCAL_SLOPE_RANGE.min}–{ISM_LOCAL_SLOPE_RANGE.max}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('ism.detail.localSectorSma')}
          </span>
          <input
            type="number"
            min={ISM_LOCAL_SECTOR_SMA_RANGE.min}
            max={ISM_LOCAL_SECTOR_SMA_RANGE.max}
            className="rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            value={draft.sectorSmaLength}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sectorSmaLength: numOrDefault(e.target.value, d.sectorSmaLength) }))
            }
          />
          <span className="text-[10px] text-gray-400">
            {ISM_LOCAL_SECTOR_SMA_RANGE.min}–{ISM_LOCAL_SECTOR_SMA_RANGE.max}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('ism.detail.localRsMa')}
          </span>
          <input
            type="number"
            min={ISM_LOCAL_RS_MA_RANGE.min}
            max={ISM_LOCAL_RS_MA_RANGE.max}
            className="rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            value={draft.rsMaLength}
            onChange={(e) => setDraft((d) => ({ ...d, rsMaLength: numOrDefault(e.target.value, d.rsMaLength) }))}
          />
          <span className="text-[10px] text-gray-400">
            {ISM_LOCAL_RS_MA_RANGE.min}–{ISM_LOCAL_RS_MA_RANGE.max}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('ism.detail.localBreadthThreshold')}
          </span>
          <input
            type="number"
            min={ISM_LOCAL_BREADTH_RANGE.min}
            max={ISM_LOCAL_BREADTH_RANGE.max}
            className="rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            value={draft.breadthThreshold}
            onChange={(e) =>
              setDraft((d) => ({ ...d, breadthThreshold: numOrDefault(e.target.value, d.breadthThreshold) }))
            }
          />
          <span className="text-[10px] text-gray-400">
            {ISM_LOCAL_BREADTH_RANGE.min}–{ISM_LOCAL_BREADTH_RANGE.max}
          </span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button type="button" size="sm" variant="primary" onClick={() => applyDraftParams(clampLocalParams(draft))}>
          {t('ism.detail.localApply')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => resetParamsToDefaultsInPanel()}>
          {t('ism.detail.localResetParams')}
        </Button>
      </div>
    </section>
  );
}
