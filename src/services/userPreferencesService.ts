/**
 * User Preferences Service
 * 
 * Provides functionality to save and load user preferences in Firestore.
 */

import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

export interface NotificationPreferences {
  enabled: boolean;
  desktopNotifications: boolean;
  dataUpdates: boolean;
  errors: boolean;
  success: boolean;
  info: boolean;
  warning: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart?: string; // HH:mm format
  doNotDisturbEnd?: string; // HH:mm format
}

export interface UserPreferences {
  userId: string;
  notifications: NotificationPreferences;
  updatedAt: Date;
}

const COLLECTION_NAME = 'userPreferences';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  desktopNotifications: false,
  dataUpdates: true,
  errors: true,
  success: false,
  info: false,
  warning: true,
  soundEnabled: false,
  doNotDisturb: false,
};

/**
 * Get user preferences from Firestore
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      userId,
      notifications: (data.notifications as NotificationPreferences) || DEFAULT_NOTIFICATION_PREFERENCES,
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    };
  } catch (error) {
    // Handle permissions errors gracefully - return null instead of throwing
    // This allows the app to continue working with default preferences
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when getting user preferences, using defaults', {
        component: 'userPreferencesService',
        operation: 'getUserPreferences',
        userId,
        error: error.message,
      });
      return null; // Return null to use default preferences
    }
    
    logger.error('Error getting user preferences', error, {
      component: 'userPreferencesService',
      operation: 'getUserPreferences',
      userId,
    });
    // For non-permission errors, still return null to prevent app crash
    return null;
  }
}

/**
 * Save user preferences to Firestore
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    
    // Get existing preferences or use defaults
    const existing = await getUserPreferences(userId);
    const currentPreferences: UserPreferences = existing || {
      userId,
      notifications: DEFAULT_NOTIFICATION_PREFERENCES,
      updatedAt: new Date(),
    };

    // Merge with new preferences
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...preferences,
      updatedAt: new Date(),
    };

    await setDoc(docRef, {
      ...updatedPreferences,
      updatedAt: Timestamp.fromDate(updatedPreferences.updatedAt),
    }, { merge: true });

    logger.debug(`User preferences saved for ${userId}`, {
      component: 'userPreferencesService',
      operation: 'saveUserPreferences',
      userId,
    });
  } catch (error) {
    // Handle permissions errors gracefully
    if (error instanceof Error && error.message.includes('permission')) {
      logger.warn('Permission denied when saving user preferences', {
        component: 'userPreferencesService',
        operation: 'saveUserPreferences',
        userId,
        error: error.message,
      });
      // Don't throw - silently fail to prevent app crash
      return;
    }
    
    logger.error('Error saving user preferences', error, {
      component: 'userPreferencesService',
      operation: 'saveUserPreferences',
      userId,
    });
    // Don't throw to prevent app crash - preferences are not critical
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const existing = await getUserPreferences(userId);
    const currentNotifications = existing?.notifications || DEFAULT_NOTIFICATION_PREFERENCES;

    const updatedNotifications: NotificationPreferences = {
      ...currentNotifications,
      ...preferences,
    };

    await saveUserPreferences(userId, {
      notifications: updatedNotifications,
    });
  } catch (error) {
    logger.error('Error updating notification preferences', error, {
      component: 'userPreferencesService',
      operation: 'updateNotificationPreferences',
      userId,
    });
    throw error;
  }
}
