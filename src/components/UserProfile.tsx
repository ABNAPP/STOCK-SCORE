import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { getPendingRequest, createPendingRequest } from '../services/pendingRequestService';
import { RequestedRole } from '../services/pendingRequestService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

interface UserProfileProps {
  onClose?: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser, refreshUserRole, logout } = useAuth();
  const { userRole, isEditor, isAdmin } = useUserRole();
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showDeregisterConfirm, setShowDeregisterConfirm] = useState(false);
  const [deregistering, setDeregistering] = useState(false);

  // Check for pending request
  useEffect(() => {
    if (!currentUser) return;

    const checkPendingRequest = async () => {
      try {
        setLoading(true);
        const request = await getPendingRequest(currentUser.uid);
        setHasPendingRequest(request?.status === 'pending' || false);
      } catch (error) {
        console.error('Error checking pending request:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPendingRequest();
  }, [currentUser]);

  const handleRequestUpgrade = useCallback(async () => {
    if (!currentUser || isEditor || isAdmin || requesting) return;

    try {
      setRequesting(true);
      await createPendingRequest(currentUser, 'editor', 'upgrade_request');
      setHasPendingRequest(true);
      showToast(t('profile.upgradeRequestSuccess'), 'success');
    } catch (error: any) {
      console.error('Error requesting upgrade:', error);
      const errorMessage = error.message || t('profile.upgradeRequestError');
      showToast(errorMessage, 'error');
    } finally {
      setRequesting(false);
    }
  }, [currentUser, isEditor, isAdmin, requesting, showToast, t]);

  const handleDeregister = useCallback(async () => {
    if (!currentUser || deregistering) return;

    try {
      setDeregistering(true);
      // Call Cloud Function to delete user account
      const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
      await deleteUserAccount({ userId: currentUser.uid });
      
      showToast(t('profile.deregisterSuccess') || 'Ditt konto har tagits bort', 'success');
      // Log out user after account deletion
      await logout();
    } catch (error: any) {
      console.error('Error deregistering:', error);
      const errorMessage = error.message || error.code || t('profile.deregisterError') || 'Kunde inte ta bort kontot';
      showToast(errorMessage, 'error');
    } finally {
      setDeregistering(false);
      setShowDeregisterConfirm(false);
    }
  }, [currentUser, deregistering, showToast, t, logout]);

  const getRoleLabel = (): string => {
    if (isAdmin) return t('roles.admin');
    if (isEditor) return t('roles.editor');
    if (userRole === 'viewer1') return t('roles.viewer1');
    if (userRole === 'viewer2') return t('roles.viewer2');
    return t('roles.noRole');
  };

  const canRequestUpgrade = !isEditor && !isAdmin && !hasPendingRequest && (userRole === 'viewer1' || userRole === 'viewer2');

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('profile.title')}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.close') || 'Stäng'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('common.loading') || 'Laddar...'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Role */}
          <div className="border-b border-gray-300 dark:border-gray-600 pb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('profile.currentRole')}
            </label>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md font-medium">
                {getRoleLabel()}
              </span>
            </div>
          </div>

          {/* User Email */}
          {currentUser?.email && (
            <div className="border-b border-gray-300 dark:border-gray-600 pb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.email')}
              </label>
              <p className="text-gray-900 dark:text-gray-100">{currentUser.email}</p>
            </div>
          )}

          {/* Upgrade Request Section */}
          {hasPendingRequest && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t('profile.upgradeRequested')}
              </p>
            </div>
          )}

          {canRequestUpgrade && (
            <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
              <button
                onClick={handleRequestUpgrade}
                disabled={requesting}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {requesting ? t('profile.requesting') : t('profile.requestUpgrade')}
              </button>
            </div>
          )}

          {!canRequestUpgrade && !hasPendingRequest && (isEditor || isAdmin) && (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              {t('profile.noUpgradeAvailable')}
            </div>
          )}

          {/* Deregister Section */}
          <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                {t('profile.deregisterTitle') || 'Avregistrera konto'}
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                {t('profile.deregisterWarning') || 'Om du avregistrerar ditt konto kommer det att tas bort permanent. Denna åtgärd kan inte ångras.'}
              </p>
              <button
                onClick={() => setShowDeregisterConfirm(true)}
                disabled={deregistering}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('profile.deregister') || 'Avregistrera mig'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deregister Confirmation Dialog */}
      {showDeregisterConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('profile.confirmDeregister') || 'Bekräfta avregistrering'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t('profile.confirmDeregisterMessage') || 'Är du säker på att du vill avregistrera ditt konto? Ditt konto och all data kommer att tas bort permanent. Denna åtgärd kan inte ångras.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeregisterConfirm(false)}
                disabled={deregistering}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.cancel') || 'Avbryt'}
              </button>
              <button
                onClick={handleDeregister}
                disabled={deregistering}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deregistering 
                  ? (t('profile.deregistering') || 'Tar bort...')
                  : (t('profile.confirmDeregisterButton') || 'Ja, avregistrera')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
