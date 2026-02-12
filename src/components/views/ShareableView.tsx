import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadShareableLink, ShareableLink } from '../../services/shareableLinkService';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '../../hooks/useUserRole';
import type { ViewId } from '../../types/navigation';
import LoadingFallback from '../LoadingFallback';

interface ShareableViewProps {
  onLoadLink: (link: ShareableLink) => void;
}

export default function ShareableView({ onLoadLink }: ShareableViewProps) {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { createNotification } = useNotifications();
  const { t } = useTranslation();
  const { canView } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLink = async () => {
      if (!linkId) {
        setError(t('shareableLinks.invalidLink', 'Invalid link'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const link = await loadShareableLink(linkId);

        if (!link) {
          setError(t('shareableLinks.linkNotFound', 'Link not found or expired'));
          setLoading(false);
          return;
        }

        if (!canView(link.viewId as ViewId)) {
          setError(t('common.unauthorizedView', 'Du saknar behörighet till denna vy'));
          setLoading(false);
          navigate('/', { replace: true });
          return;
        }

        // Load the link data
        onLoadLink(link);

        // Navigate to the view
        navigate(`/${link.viewId}`, { replace: true });

        createNotification(
          'success',
          'Link Loaded',
          t('shareableLinks.linkLoaded', 'Shareable link loaded successfully'),
          { showDesktop: false }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t('shareableLinks.loadError', 'Failed to load link');
        setError(errorMessage);
        createNotification(
          'error',
          'Error Loading Link',
          errorMessage,
          { showDesktop: true }
        );
      } finally {
        setLoading(false);
      }
    };

    loadLink();
  }, [linkId, navigate, onLoadLink, createNotification, t, canView]);

  if (loading) {
    return <LoadingFallback />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
            {t('shareableLinks.error', 'Error')}
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('shareableLinks.goHome', 'Go to Home')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
