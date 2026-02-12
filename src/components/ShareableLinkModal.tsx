import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  saveShareableLink,
  generateShareableUrl,
  getUserShareableLinks,
  deleteShareableLink,
  ShareableLink,
} from '../services/shareableLinkService';
import { FilterValues } from '../types/filters';
import type { ColumnFilters } from '../hooks/useColumnFilters';
import Button from './ui/Button';

interface ShareableLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterValues;
  viewId: string;
  tableId: string;
  sortConfig?: { key: string; direction: 'asc' | 'desc' };
  columnFilters?: ColumnFilters;
  searchValue?: string;
}

export default function ShareableLinkModal({
  isOpen,
  onClose,
  filterState,
  viewId,
  tableId,
  sortConfig,
  columnFilters,
  searchValue,
}: ShareableLinkModalProps) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { createNotification } = useNotifications();
  const [linkName, setLinkName] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [savedLinkId, setSavedLinkId] = useState<string | null>(null);
  const [userLinks, setUserLinks] = useState<ShareableLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Load user's existing links
  useEffect(() => {
    if (isOpen && currentUser) {
      loadUserLinks();
    }
  }, [isOpen, currentUser]);

  const loadUserLinks = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoadingLinks(true);
      const links = await getUserShareableLinks(currentUser.uid, 10);
      setUserLinks(links);
    } catch (error) {
      createNotification(
        'error',
        'Error Loading Links',
        'Failed to load your shareable links',
        { showDesktop: false }
      );
    } finally {
      setLoadingLinks(false);
    }
  }, [currentUser, createNotification]);

  const handleSaveLink = useCallback(async () => {
    if (!currentUser || saving) return;

    try {
      setSaving(true);
      const linkId = await saveShareableLink(filterState, viewId, tableId, currentUser.uid, {
        name: linkName.trim() || undefined,
        description: linkDescription.trim() || undefined,
        expiresInDays,
        sortConfig,
        columnFilters,
        searchValue: searchValue || undefined,
      });

      setSavedLinkId(linkId);
      createNotification(
        'success',
        'Link Created',
        'Shareable link created successfully',
        { showDesktop: false }
      );

      // Reload user links
      await loadUserLinks();
    } catch (error) {
      createNotification(
        'error',
        'Error Creating Link',
        error instanceof Error ? error.message : 'Failed to create shareable link',
        { showDesktop: true }
      );
    } finally {
      setSaving(false);
    }
  }, [currentUser, filterState, viewId, tableId, linkName, linkDescription, expiresInDays, sortConfig, columnFilters, searchValue, saving, createNotification, loadUserLinks]);

  const handleCopyLink = useCallback((linkId: string) => {
    const url = generateShareableUrl(linkId);
    navigator.clipboard.writeText(url).then(() => {
      createNotification('success', 'Link Copied', 'Shareable link copied to clipboard', {
        showDesktop: false,
      });
    });
  }, [createNotification]);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    if (!currentUser) return;

    if (!window.confirm(t('shareableLinks.confirmDelete', 'Are you sure you want to delete this link?'))) {
      return;
    }

    try {
      await deleteShareableLink(linkId, currentUser.uid);
      createNotification('success', 'Link Deleted', 'Shareable link deleted successfully', {
        showDesktop: false,
      });
      await loadUserLinks();
    } catch (error) {
      createNotification(
        'error',
        'Error Deleting Link',
        error instanceof Error ? error.message : 'Failed to delete shareable link',
        { showDesktop: true }
      );
    }
  }, [currentUser, createNotification, loadUserLinks, t]);

  if (!isOpen) return null;

  const shareableUrl = savedLinkId ? generateShareableUrl(savedLinkId) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 animate-fade-in transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 animate-scale-in transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-white">
              {t('shareableLinks.title', 'Create Shareable Link')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              aria-label={t('common.close', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!savedLinkId ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('shareableLinks.linkName', 'Link Name (optional)')}
                </label>
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder={t('shareableLinks.linkNamePlaceholder', 'e.g., High Score Stocks')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('shareableLinks.description', 'Description (optional)')}
                </label>
                <textarea
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder={t('shareableLinks.descriptionPlaceholder', 'Add a description...')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('shareableLinks.expiresIn', 'Expires In (days)')}
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onClose}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button variant="primary" onClick={handleSaveLink} disabled={saving}>
                  {saving ? t('shareableLinks.saving', 'Saving...') : t('shareableLinks.create', 'Create Link')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  {t('shareableLinks.linkCreated', 'Link created successfully!')}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareableUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-green-300 dark:border-green-700 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white text-sm"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCopyLink(savedLinkId)}
                  >
                    {t('shareableLinks.copy', 'Copy')}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onClose}>
                  {t('common.close', 'Close')}
                </Button>
              </div>
            </div>
          )}

          {/* User's existing links */}
          {currentUser && (
            <div className="mt-8 border-t border-gray-300 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
                {t('shareableLinks.myLinks', 'My Shareable Links')}
              </h3>
              {loadingLinks ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
              ) : userLinks.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('shareableLinks.noLinks', 'No shareable links yet')}
                </p>
              ) : (
                <div className="space-y-2">
                  {userLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {link.name || t('shareableLinks.unnamed', 'Unnamed Link')}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {link.createdAt.toLocaleDateString()} • {link.tableId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(link.id)}
                        >
                          {t('shareableLinks.copy', 'Copy')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          {t('shareableLinks.delete', 'Delete')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
