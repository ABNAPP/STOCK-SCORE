import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { notificationService, Notification, NotificationType } from '../services/notificationService';
import { getUserPreferences, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '../services/userPreferencesService';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  permissionState: 'default' | 'granted' | 'denied';
  requestPermission: () => Promise<boolean>;
  createNotification: (
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      persistent?: boolean;
      showDesktop?: boolean;
      data?: Record<string, unknown>;
    }
  ) => Notification;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>(
    notificationService.getPermissionState()
  );
  const [userPreferences, setUserPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const refresh = useCallback(() => {
    setNotifications(notificationService.getNotifications());
    setPermissionState(notificationService.getPermissionState());
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await notificationService.requestPermission();
    setPermissionState(notificationService.getPermissionState());
    return granted;
  }, []);

  const createNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      options?: {
        persistent?: boolean;
        showDesktop?: boolean;
        data?: Record<string, unknown>;
      }
    ): Notification => {
      // Check if notifications are enabled
      if (!userPreferences.enabled) {
        logger.debug('Notifications disabled by user preferences', {
          component: 'NotificationContext',
          type,
        });
        // Still create the notification but don't show it
        const notification = notificationService.createNotification(type, title, message, {
          ...options,
          showDesktop: false,
        });
        refresh();
        return notification;
      }

      // Check if this notification type is enabled
      let typeEnabled = true;
      switch (type) {
        case 'data-update':
          typeEnabled = userPreferences.dataUpdates;
          break;
        case 'error':
          typeEnabled = userPreferences.errors;
          break;
        case 'success':
          typeEnabled = userPreferences.success;
          break;
        case 'info':
          typeEnabled = userPreferences.info;
          break;
        case 'warning':
          typeEnabled = userPreferences.warning;
          break;
      }

      if (!typeEnabled) {
        logger.debug(`Notification type ${type} disabled by user preferences`, {
          component: 'NotificationContext',
        });
        // Still create the notification but don't show it
        const notification = notificationService.createNotification(type, title, message, {
          ...options,
          showDesktop: false,
        });
        refresh();
        return notification;
      }

      // Check desktop notification preference
      const showDesktop = options?.showDesktop !== false && userPreferences.desktopNotifications;

      const notification = notificationService.createNotification(type, title, message, {
        ...options,
        showDesktop,
      });
      refresh();
      return notification;
    },
    [refresh, userPreferences]
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      notificationService.markAsRead(notificationId);
      refresh();
    },
    [refresh]
  );

  const markAllAsRead = useCallback(() => {
    notificationService.markAllAsRead();
    refresh();
  }, [refresh]);

  const removeNotification = useCallback(
    (notificationId: string) => {
      notificationService.removeNotification(notificationId);
      refresh();
    },
    [refresh]
  );

  const clearAll = useCallback(() => {
    notificationService.clearAll();
    refresh();
  }, [refresh]);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!currentUser) {
        setUserPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        return;
      }

      try {
        const prefs = await getUserPreferences(currentUser.uid);
        if (prefs) {
          setUserPreferences(prefs.notifications);
        }
      } catch (error) {
        logger.error('Error loading notification preferences', error, {
          component: 'NotificationContext',
        });
      }
    };

    loadPreferences();
  }, [currentUser]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh notifications periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 1000); // Refresh every second

    return () => clearInterval(interval);
  }, [refresh]);

  // Clean up old notifications on mount
  useEffect(() => {
    notificationService.clearOldNotifications(7); // Keep last 7 days
    refresh();
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    permissionState,
    requestPermission,
    createNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    refresh,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
