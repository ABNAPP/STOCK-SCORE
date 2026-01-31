import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiKeysForDisplay } from '../config/apiKeys';
import type { ApiKeys } from '../config/apiKeys';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => Promise<void>;
}

export default function ApiKeysModal({ isOpen, onClose, onSave }: ApiKeysModalProps) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKeys>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const apiKeys = getApiKeysForDisplay();
      setKeys(apiKeys);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(keys);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-keys-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <h2 id="api-keys-title" className="text-xl font-semibold mb-4 text-black dark:text-white">
          {t('apiKeys.title', 'API-nycklar')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t(
            'apiKeys.description',
            'Endast admin kan se och ändra. Ändringar sparas och används för valutakurser.'
          )}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EODHD</label>
            <input
              type="text"
              value={keys.eodhd || ''}
              onChange={(e) => setKeys((prev) => ({ ...prev, eodhd: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MarketStack</label>
            <input
              type="text"
              value={keys.marketstack || ''}
              onChange={(e) => setKeys((prev) => ({ ...prev, marketstack: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">FINNHUB</label>
            <input
              type="text"
              value={keys.finnhub || ''}
              onChange={(e) => setKeys((prev) => ({ ...prev, finnhub: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alpha Vantage</label>
            <input
              type="text"
              value={keys.alphaVantage || ''}
              onChange={(e) => setKeys((prev) => ({ ...prev, alphaVantage: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors min-h-[44px] touch-manipulation"
          >
            {saving ? t('apiKeys.saving', 'Sparar…') : t('apiKeys.save', 'Spara')}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-black dark:text-white rounded-md transition-colors min-h-[44px] touch-manipulation disabled:opacity-50"
          >
            {t('common.close', 'Stäng')}
          </button>
        </div>
      </div>
    </div>
  );
}
