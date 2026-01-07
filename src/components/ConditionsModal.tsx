import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TableMetadata } from '../types/columnMetadata';

interface ConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: TableMetadata | null;
  pageName: string;
}

export default function ConditionsModal({ isOpen, onClose, metadata, pageName }: ConditionsModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !metadata) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 animate-fade-in transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-scale-in transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-95 p-3 sm:p-2 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {metadata.columns.map((column, index) => (
              <div
                key={column.columnKey}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 hover:scale-[1.02] transition-all duration-300 ease-in-out animate-fade-in-up cursor-default"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 capitalize">
                  {column.columnKey.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                
                <div className="space-y-3">
                  <div className="transition-all duration-200 hover:translate-x-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 transition-colors duration-200 hover:text-blue-700 dark:hover:text-blue-300">
                        {t('conditions.dataSource')}:
                      </span>
                    </div>
                    <p className="mt-1 ml-7 text-gray-700 dark:text-gray-300">{column.dataSource}</p>
                  </div>

                  {column.formula && (
                    <div className="transition-all duration-200 hover:translate-x-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold text-green-600 dark:text-green-400 transition-colors duration-200 hover:text-green-700 dark:hover:text-green-300">
                          {t('conditions.formula')}:
                        </span>
                      </div>
                      <p className="mt-1 ml-7 text-gray-700 dark:text-gray-300 font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-sm">
                        {column.formula}
                      </p>
                    </div>
                  )}

                  {column.conditions && column.conditions.length > 0 && (
                    <div className="transition-all duration-200 hover:translate-x-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="font-semibold text-yellow-600 dark:text-yellow-400 transition-colors duration-200 hover:text-yellow-700 dark:hover:text-yellow-300">
                          {t('conditions.conditions')}:
                        </span>
                      </div>
                      <ul className="mt-1 ml-7 list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {column.conditions.map((condition, conditionIndex) => (
                          <li key={conditionIndex} className="transition-all duration-200 hover:translate-x-1">{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-3 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 hover:shadow-md active:scale-95 min-h-[44px] touch-manipulation inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>{t('conditions.close')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

