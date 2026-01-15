/**
 * Notification Service
 * 
 * Provides desktop notifications and in-app notification management.
 * Supports browser Notification API for desktop notifications.
 */

import { logger } from '../utils/logger';

export type NotificationType = 'data-update' | 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  persistent?: boolean;
  actions?: NotificationAction[];
  data?: Record<string, unknown>;
}

export interface NotificationAction {
  action: string;
  title: string;
}

export interface NotificationPermission {
  state: 'default' | 'granted' | 'denied';
}

class NotificationService {
  private static instance: NotificationService;
  private permissionState: NotificationPermission['state'] = 'default';
  private notificationQueue: Notification[] = [];
  private maxQueueSize = 50;

  private constructor() {
    this.checkPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check current notification permission state
   */
  private checkPermission(): void {
    if (!('Notification' in window)) {
      logger.warn('Browser does not support notifications', { component: 'NotificationService' });
      this.permissionState = 'denied';
      return;
    }

    this.permissionState = Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('Browser does not support notifications', { component: 'NotificationService' });
      return false;
    }

    if (this.permissionState === 'granted') {
      return true;
    }

    if (this.permissionState === 'denied') {
      logger.warn('Notification permission denied', { component: 'NotificationService' });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionState = permission;
      return permission === 'granted';
    } catch (error) {
      logger.error('Error requesting notification permission', error, { component: 'NotificationService' });
      return false;
    }
  }

  /**
   * Get current permission state
   */
  getPermissionState(): NotificationPermission['state'] {
    return this.permissionState;
  }

  /**
   * Create a desktop notification
   */
  private createDesktopNotification(notification: Notification): void {
    if (this.permissionState !== 'granted') {
      logger.debug('Notification permission not granted, skipping desktop notification', {
        component: 'NotificationService',
        notificationId: notification.id,
      });
      return;
    }

    try {
      const options: NotificationOptions = {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.persistent || false,
        timestamp: notification.timestamp,
        data: notification.data,
      };

      const desktopNotification = new Notification(notification.title, options);

      // Handle notification click
      desktopNotification.onclick = () => {
        window.focus();
        desktopNotification.close();
      };

      // Auto-close after 5 seconds (unless persistent)
      if (!notification.persistent) {
        setTimeout(() => {
          desktopNotification.close();
        }, 5000);
      }
    } catch (error) {
      logger.error('Error creating desktop notification', error, {
        component: 'NotificationService',
        notificationId: notification.id,
      });
    }
  }

  /**
   * Create a notification
   */
  createNotification(
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      persistent?: boolean;
      actions?: NotificationAction[];
      data?: Record<string, unknown>;
      showDesktop?: boolean;
    }
  ): Notification {
    const notification: Notification = {
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      persistent: options?.persistent || false,
      actions: options?.actions,
      data: options?.data,
    };

    // Add to queue
    this.addToQueue(notification);

    // Show desktop notification if enabled and permission granted
    if (options?.showDesktop !== false && this.permissionState === 'granted') {
      this.createDesktopNotification(notification);
    }

    return notification;
  }

  /**
   * Add notification to queue
   */
  private addToQueue(notification: Notification): void {
    this.notificationQueue.unshift(notification); // Add to beginning

    // Limit queue size
    if (this.notificationQueue.length > this.maxQueueSize) {
      this.notificationQueue = this.notificationQueue.slice(0, this.maxQueueSize);
    }
  }

  /**
   * Get all notifications
   */
  getNotifications(): Notification[] {
    return [...this.notificationQueue];
  }

  /**
   * Get unread notifications
   */
  getUnreadNotifications(): Notification[] {
    return this.notificationQueue.filter((n) => !n.read);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notificationQueue.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notificationQueue.forEach((n) => {
      n.read = true;
    });
  }

  /**
   * Remove notification
   */
  removeNotification(notificationId: string): void {
    this.notificationQueue = this.notificationQueue.filter((n) => n.id !== notificationId);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notificationQueue = [];
  }

  /**
   * Clear old notifications (older than specified days)
   */
  clearOldNotifications(days: number = 7): void {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    this.notificationQueue = this.notificationQueue.filter((n) => n.timestamp > cutoffTime);
  }

  /**
   * Get notification count
   */
  getNotificationCount(): number {
    return this.notificationQueue.length;
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    return this.notificationQueue.filter((n) => !n.read).length;
  }
}

export const notificationService = NotificationService.getInstance();
