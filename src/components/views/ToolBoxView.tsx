import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import PmiToolView from './pmi/PmiToolView';

type ToolId = 'equicast' | 'smart-allocation' | 'pmi';

export default function ToolBoxView() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  const openPmiFromGrid = () => {
    const params = new URLSearchParams(location.search);
    params.set('tool', 'pmi');
    if (!params.get('type')) {
      params.set('type', 'manufacturing');
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    setActiveTool('pmi');
  };

  // Toolbox view mode is driven by `activeTool` only. URL is updated for deep-linking / PMI
  // internals; it must not close PMI when the query is briefly out of sync.

  useEffect(() => {
    if (activeTool !== null) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const hasPmiParams =
      params.has('tool') || params.has('type') || params.has('country');

    if (!hasPmiParams) {
      return;
    }

    params.delete('tool');
    params.delete('type');
    params.delete('country');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [activeTool, location.pathname, location.search, navigate]);

  const renderToolCardGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <button
        onClick={() => setActiveTool('equicast')}
        className="rounded-2xl border-2 border-blue-200 bg-blue-200/35 dark:bg-blue-800/35 dark:border-blue-800 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-h-[210px] flex items-center justify-center"
        aria-label={t('toolbox.equicast.openAriaLabel')}
      >
        <h2 className="text-3xl leading-tight font-semibold text-gray-900 dark:text-gray-50 text-center">
          {t('toolbox.equicast.title')}
        </h2>
      </button>
      <button
        onClick={() => setActiveTool('smart-allocation')}
        className="rounded-2xl border-2 border-emerald-200 bg-emerald-200/35 dark:bg-emerald-800/35 dark:border-emerald-800 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-h-[210px] flex items-center justify-center"
        aria-label={t('toolbox.smartAllocation.openAriaLabel')}
      >
        <h2 className="text-3xl leading-tight font-semibold text-gray-900 dark:text-gray-50 text-center">
          {t('toolbox.smartAllocation.title')}
        </h2>
      </button>
      <button
        onClick={openPmiFromGrid}
        className="rounded-2xl border-2 border-violet-200 bg-violet-200/35 dark:bg-violet-800/35 dark:border-violet-800 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-h-[210px] flex items-center justify-center"
        aria-label={t('toolbox.pmi.openAriaLabel')}
      >
        <h2 className="text-3xl leading-tight font-semibold text-gray-900 dark:text-gray-50 text-center">
          {t('toolbox.pmi.title')}
        </h2>
      </button>
    </div>
  );

  const renderEquiCastTool = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-black dark:text-white">
          {t('toolbox.equicast.title')}
        </h2>
        <button
          onClick={() => setActiveTool(null)}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t('toolbox.backToTools')}
        </button>
      </div>
      <p className="text-gray-600 dark:text-gray-300">
        {t('toolbox.equicast.placeholder')}
      </p>
    </div>
  );

  const renderSmartAllocationTool = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-black dark:text-white">
          {t('toolbox.smartAllocation.title')}
        </h2>
        <button
          onClick={() => setActiveTool(null)}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t('toolbox.backToTools')}
        </button>
      </div>
      <p className="text-gray-600 dark:text-gray-300">
        {t('toolbox.smartAllocation.placeholder')}
      </p>
    </div>
  );

  const renderPmiTool = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-black dark:text-white">
          {t('toolbox.pmi.title')}
        </h2>
        <button
          onClick={() => {
            const params = new URLSearchParams(location.search);
            params.delete('tool');
            params.delete('type');
            params.delete('country');
            navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
            setActiveTool(null);
          }}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t('toolbox.backToTools')}
        </button>
      </div>
      <PmiToolView />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {activeTool === 'equicast'
          ? renderEquiCastTool()
          : activeTool === 'smart-allocation'
            ? renderSmartAllocationTool()
            : activeTool === 'pmi'
              ? renderPmiTool()
            : renderToolCardGrid()}
      </div>
    </div>
  );
}
