import { useTranslation } from 'react-i18next';

export default function ISMPostureView() {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
              {t('navigation.ismPosturePositioning')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              ISM Posture & Positioning
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">Innehåll kommer snart.</p>
        </div>
      </div>
    </div>
  );
}
