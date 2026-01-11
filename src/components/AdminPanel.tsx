import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { getAllPendingRequests, PendingRequest, RequestType } from '../services/pendingRequestService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';

// Note: This component requires Cloud Functions to actually set custom claims
// The approve/deny functions will call HTTP endpoints that set the claims

interface AdminPanelProps {
  onClose?: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const { isAdmin } = useUserRole();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  // Load pending requests
  useEffect(() => {
    if (!isAdmin) return;

    const loadRequests = async () => {
      try {
        setLoading(true);
        const requests = await getAllPendingRequests();
        setPendingRequests(requests);
      } catch (error) {
        console.error('Error loading pending requests:', error);
        showToast(t('admin.approveError'), 'error');
      } finally {
        setLoading(false);
      }
    };

    loadRequests();

    // Set up real-time listener for pending requests
    const q = query(
      collection(db, 'pendingRequests'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: PendingRequest[] = [];
      snapshot.forEach((doc) => {
        requests.push(doc.data() as PendingRequest);
      });
      // Sort by timestamp (newest first)
      requests.sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setPendingRequests(requests);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to pending requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin, showToast, t]);

  const handleApprove = useCallback(async (request: PendingRequest, role: 'viewer1' | 'viewer2' | 'editor') => {
    if (!currentUser || !isAdmin) return;

    const requestId = request.userId;
    setProcessing((prev) => new Set(prev).add(requestId));

    try {
      // Call Cloud Function using httpsCallable
      const setUserRole = httpsCallable(functions, 'setUserRole');
      const result = await setUserRole({
        userId: request.userId,
        role: role,
        requestId: requestId,
      });

      showToast(t('admin.approveSuccess'), 'success');
      
      // Refresh user role if it's the current user
      if (request.userId === currentUser.uid) {
        // Note: The user will need to refresh their token to see the new role
        // This is handled automatically by AuthContext when token refreshes
      }
    } catch (error: any) {
      console.error('Error approving request:', error);
      const errorMessage = error.message || error.code || t('admin.approveError');
      showToast(errorMessage, 'error');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, [currentUser, isAdmin, showToast, t, functions]);

  const handleDeny = useCallback(async (request: PendingRequest) => {
    if (!currentUser || !isAdmin) return;

    const requestId = request.userId;
    setProcessing((prev) => new Set(prev).add(requestId));

    try {
      // Call Cloud Function using httpsCallable
      const denyRequest = httpsCallable(functions, 'denyRequest');
      await denyRequest({
        userId: request.userId,
        requestId: requestId,
      });

      showToast(t('admin.denySuccess'), 'success');
    } catch (error: any) {
      console.error('Error denying request:', error);
      const errorMessage = error.message || error.code || t('admin.denyError');
      showToast(errorMessage, 'error');
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, [currentUser, isAdmin, showToast, t, functions]);

  if (!isAdmin) {
    return null;
  }

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '-';
    }
  };

  const getRequestTypeLabel = (type: RequestType): string => {
    return type === 'initial_registration' 
      ? t('admin.requestTypeInitial')
      : t('admin.requestTypeUpgrade');
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('admin.panel')}
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
      ) : pendingRequests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">{t('admin.noPendingRequests')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => {
            const isProcessing = processing.has(request.userId);
            
            return (
              <div
                key={request.userId}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {t('admin.userEmail')}: {request.email}
                        </p>
                        {request.name && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {request.name}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {getRequestTypeLabel(request.requestType)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{t('admin.requestedRole')}:</span>{' '}
                      {request.requestedRole === 'viewer1' 
                        ? t('roles.viewer1')
                        : request.requestedRole === 'viewer2'
                        ? t('roles.viewer2')
                        : request.requestedRole === 'editor'
                        ? t('roles.editor')
                        : request.requestedRole}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {t('admin.timestamp')}: {formatDate(request.timestamp)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleApprove(request, 'viewer1')}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? t('admin.approving') : t('admin.approveAsViewer1')}
                  </button>
                  <button
                    onClick={() => handleApprove(request, 'viewer2')}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? t('admin.approving') : t('admin.approveAsViewer2')}
                  </button>
                  <button
                    onClick={() => handleApprove(request, 'editor')}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? t('admin.approving') : t('admin.approveAsEditor')}
                  </button>
                  <button
                    onClick={() => handleDeny(request)}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? t('admin.denying') : t('admin.deny')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
