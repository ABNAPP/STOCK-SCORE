import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';

const EXTRA_TABLE_VIEW_IDS = [
  'score-board',
  'entry-exit-benjamin-graham',
  'fundamental-pe-industry',
  'threshold-industry',
] as const;

export interface AdminUser {
  uid: string;
  email: string;
  role: string | null;
  allowedViews: string[];
}

export default function AdminView() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [selectedViews, setSelectedViews] = useState<Record<string, string[]>>({});

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const listUsers = httpsCallable<unknown, { users: AdminUser[] }>(functions, 'listUsers');
      const result = await listUsers({});
      const data = result.data;
      if (data?.users) {
        setUsers(data.users);
        const initial: Record<string, string[]> = {};
        data.users.forEach((u) => {
          initial[u.uid] = Array.isArray(u.allowedViews) ? [...u.allowedViews] : [];
        });
        setSelectedViews(initial);
      }
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : t('admin.error') || 'Failed to load users';
      logger.error('Error loading users', error, { component: 'AdminView', operation: 'loadUsers' });
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleView = (uid: string, viewId: string) => {
    setSelectedViews((prev) => {
      const current = prev[uid] ?? [];
      const next = current.includes(viewId)
        ? current.filter((id) => id !== viewId)
        : [...current, viewId];
      return { ...prev, [uid]: next };
    });
  };

  const handleSave = async (uid: string) => {
    if (uid === currentUser?.uid) return;
    try {
      setSavingUid(uid);
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({ userId: uid, role: 'viewer', allowedViews: selectedViews[uid] ?? [] });
      showToast(t('admin.saved'), 'success');
      await loadUsers();
    } catch (error) {
      logger.error('Error saving user role', error, { component: 'AdminView', operation: 'handleSave', uid });
      showToast(t('admin.error'), 'error');
    } finally {
      setSavingUid(null);
    }
  };

  const getViewLabel = (viewId: string) => {
    const key = viewId === 'score-board' ? 'scoreBoard' : viewId === 'entry-exit-benjamin-graham' ? 'benjaminGraham' : viewId === 'fundamental-pe-industry' ? 'peIndustry' : viewId === 'threshold-industry' ? 'thresholdIndustry' : viewId;
    return t(`navigation.${key}`, viewId);
  };

  if (loading) {
    return (
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-8 px-4 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">{t('admin.loading')}</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">
          {t('admin.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('admin.description')}
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                    {t('admin.email')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                    {t('admin.role')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                    {t('admin.extraTables')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                    {t('admin.save')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => {
                  const isSelf = user.uid === currentUser?.uid;
                  const isViewer = user.role === 'viewer' || user.role === null;
                  const canEdit = isViewer && !isSelf;
                  const views = selectedViews[user.uid] ?? [];
                  return (
                    <tr key={user.uid} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {user.email || user.uid}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {user.role === 'admin' ? t('roles.admin') : t('roles.viewer')}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="flex flex-wrap gap-3">
                            {EXTRA_TABLE_VIEW_IDS.map((viewId) => (
                              <label
                                key={viewId}
                                className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={views.includes(viewId)}
                                  onChange={() => handleToggleView(user.uid, viewId)}
                                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                {getViewLabel(viewId)}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {isSelf ? '—' : user.role === 'admin' ? '—' : views.length ? views.map(getViewLabel).join(', ') : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleSave(user.uid)}
                            disabled={savingUid === user.uid}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingUid === user.uid ? '…' : t('admin.save')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
