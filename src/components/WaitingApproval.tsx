import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getPendingRequest } from '../services/pendingRequestService';
import { useUserRole } from '../hooks/useUserRole';
import { useToast } from '../contexts/ToastContext';

export default function WaitingApproval() {
  const { t } = useTranslation();
  const { currentUser, refreshUserRole } = useAuth();
  const { hasRole } = useUserRole();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(true);

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
      </div>
    </div>
  );
}
