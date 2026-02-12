import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewId } from '../types/navigation';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewId?: ViewId | null;
}

const HELP_VIEW_IDS: ViewId[] = [
  'score',
  'score-board',
  'entry-exit-benjamin-graham',
  'fundamental-pe-industry',
  'threshold-industry',
  'personal-portfolio',
];

export default function HelpModal({ isOpen, onClose, viewId }: HelpModalProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      closeButtonRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const thisViewKey = viewId && HELP_VIEW_IDS.includes(viewId)
    ? `helpThisView.${viewId}`
    : 'helpThisView.default';
  const thisViewText = t(thisViewKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 animate-fade-in transition-opacity duration-normal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-scale-in transition-all duration-normal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 id="help-modal-title" className="text-2xl font-bold text-black dark:text-white">
            {t('help.title')}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-95 p-3 sm:p-2 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
            aria-label={t('aria.closeModal')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {viewId && (
            <section>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                {t('help.thisView')}
              </h3>
              <p className="text-gray-700 dark:text-gray-300">{thisViewText}</p>
            </section>
          )}

          <section>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {t('help.sections.conditions.title')}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t('help.sections.conditions.content')}
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {t('help.sections.filters.title')}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t('help.sections.filters.content')}
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {t('help.sections.score.title')}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t('help.sections.score.content')}
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {t('help.sections.shareExport.title')}
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {t('help.sections.shareExport.content')}
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-3 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 hover:shadow-md active:scale-95 min-h-[44px] touch-manipulation inline-flex items-center gap-2"
          >
            <span>{t('help.close')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
