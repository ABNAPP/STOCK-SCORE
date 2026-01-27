import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getUserPortfolio, saveUserPortfolio, addPortfolioItem, removePortfolioItem } from '../../services/personalPortfolioService';
import { PortfolioItem } from '../../types/portfolio';
import { TableSkeleton } from '../SkeletonLoader';
import ProgressIndicator from '../ProgressIndicator';

export default function PersonalPortfolioView() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    loadPortfolio();
  }, [currentUser]);

  const loadPortfolio = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);
      const userPortfolio = await getUserPortfolio(currentUser.uid);
      setPortfolio(userPortfolio?.portfolio || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load portfolio';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!currentUser || !newTicker.trim()) return;

    try {
      const item: PortfolioItem = {
        ticker: newTicker.trim().toUpperCase(),
        companyName: newCompanyName.trim() || undefined,
      };
      
      await addPortfolioItem(currentUser.uid, item);
      await loadPortfolio();
      setNewTicker('');
      setNewCompanyName('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add item';
      setError(errorMessage);
    }
  };

  const handleRemoveItem = async (ticker: string) => {
    if (!currentUser) return;

    try {
      await removePortfolioItem(currentUser.uid, ticker);
      await loadPortfolio();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove item';
      setError(errorMessage);
    }
  };

  if (!currentUser) {
    return (
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">
          {t('common.pleaseLogin', 'Please log in to view your personal portfolio')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
              {t('navigation.personalPortfolio', 'Personal Portfolio')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              {t('portfolio.description', 'Hantera din personliga aktieportfölj')}
            </p>
          </div>
        </div>

        {loading && (
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator isLoading={true} label={t('common.loading', 'Loading...')} />
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Add new item form */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
            {t('portfolio.addItem', 'Lägg till aktie')}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('portfolio.ticker', 'Ticker')} *
              </label>
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="AAPL"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('portfolio.companyName', 'Företagsnamn')}
              </label>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder={t('portfolio.companyNamePlaceholder', 'Apple Inc.')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddItem}
                disabled={!newTicker.trim() || loading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors min-h-[44px] touch-manipulation"
              >
                {t('portfolio.add', 'Lägg till')}
              </button>
            </div>
          </div>
        </div>

        {/* Portfolio table */}
        {loading ? (
          <div className="flex-1 min-h-0">
            <TableSkeleton rows={10} columns={3} />
          </div>
        ) : portfolio.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                {t('portfolio.empty', 'Din portfölj är tom')}
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">
                {t('portfolio.emptyDescription', 'Lägg till aktier ovan för att börja bygga din portfölj')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('portfolio.ticker', 'Ticker')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('portfolio.companyName', 'Företagsnamn')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('portfolio.actions', 'Åtgärder')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {portfolio.map((item, index) => (
                    <tr key={`${item.ticker}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black dark:text-white">
                        {item.ticker}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {item.companyName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveItem(item.ticker)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors min-h-[44px] min-w-[44px] touch-manipulation px-3 py-1 rounded"
                          aria-label={t('portfolio.remove', 'Ta bort')}
                        >
                          {t('portfolio.remove', 'Ta bort')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
