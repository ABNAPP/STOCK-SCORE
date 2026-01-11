import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getPendingRequest, deletePendingRequest } from '../services/pendingRequestService';
import { useUserRole } from '../hooks/useUserRole';
import { useToast } from '../contexts/ToastContext';

export default function WaitingApproval() {
  const { t } = useTranslation();
  const { currentUser, refreshUserRole, logout } = useAuth();
  const { hasRole } = useUserRole();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(true);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!currentUser || hasRole) {
        setChecking(false);
        return;
      }

      try {
        const request = await getPendingRequest(currentUser.uid);
        
        if (request && request.status === 'approved') {
          // Request was approved, refresh user role
          await refreshUserRole();
          showToast(t('admin.approveSuccess'), 'success');
        }
        
        setChecking(false);
      } catch (error) {
        console.error('Error checking request status:', error);
        setChecking(false);
      }
    };

    checkRequestStatus();
    
    // Poll every 30 seconds to check if request was approved
    const interval = setInterval(checkRequestStatus, 30000);
    
    return () => clearInterval(interval);
  }, [currentUser, hasRole, refreshUserRole, showToast, t]);

  const handleWithdrawRequest = async () => {
    if (!currentUser) return;

    try {
      setWithdrawing(true);
      await deletePendingRequest(currentUser.uid);
      showToast(t('waitingApproval.withdrawSuccess') || 'Begäran har dragits tillbaka', 'success');
      // Log out user after withdrawing request
      await logout();
    } catch (error: any) {
      console.error('Error withdrawing request:', error);
      const errorMessage = error.message || t('waitingApproval.withdrawError') || 'Kunde inte dra tillbaka begäran';
      showToast(errorMessage, 'error');
    } finally {
      setWithdrawing(false);
      setShowWithdrawConfirm(false);
    }
  };

  if (hasRole) {
    return null; // User has role, don't show waiting screen
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('waitingApproval.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {t('waitingApproval.message')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('waitingApproval.submessage')}
          </p>
        </div>
        
        {checking && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('common.checking') || 'Kontrollerar status...'}
          </p>
        )}

        {/* Withdraw Request Button */}
        <div className="mt-6">
          <button
            onClick={() => setShowWithdrawConfirm(true)}
            disabled={withdrawing}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('waitingApproval.withdrawRequest') || 'Dra tillbaka begäran'}
          </button>
        </div>

        {/* Withdraw Confirmation Dialog */}
        {showWithdrawConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                {t('waitingApproval.confirmWithdraw') || 'Bekräfta att dra tillbaka begäran'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {t('waitingApproval.withdrawConfirmMessage') || 'Är du säker på att du vill dra tillbaka din begäran? Du kommer att loggas ut och kan registrera dig igen senare.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowWithdrawConfirm(false)}
                  disabled={withdrawing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('common.cancel') || 'Avbryt'}
                </button>
                <button
                  onClick={handleWithdrawRequest}
                  disabled={withdrawing}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {withdrawing 
                    ? (t('waitingApproval.withdrawing') || 'Tar bort...')
                    : (t('waitingApproval.confirmWithdrawButton') || 'Ja, dra tillbaka')
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
