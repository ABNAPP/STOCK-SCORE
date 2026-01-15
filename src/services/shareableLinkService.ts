/**
 * Shareable Link Service
 * 
 * Provides functionality to save and load filter state as shareable links via Firestore.
 */

import { collection, doc, setDoc, getDoc, deleteDoc, Timestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FilterValues } from '../types/filters';
import { logger } from '../utils/logger';

export interface ShareableLink {
  id: string;
  filterState: FilterValues;
  viewId: string;
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  tableId: string;
  createdAt: Date;
  expiresAt?: Date;
  createdBy: string;
  name?: string;
  description?: string;
}

const COLLECTION_NAME = 'shareableLinks';
const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Generate a short unique ID for the link
 */
function generateLinkId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Save a shareable link to Firestore
 */
export async function saveShareableLink(
  filterState: FilterValues,
  viewId: string,
  tableId: string,
  userId: string,
  options?: {
    name?: string;
    description?: string;
    expiresInDays?: number;
    sortConfig?: { key: string; direction: 'asc' | 'desc' };
  }
): Promise<string> {
  try {
    const linkId = generateLinkId();
    const now = new Date();
    const expiresAt = options?.expiresInDays
      ? new Date(now.getTime() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const linkData: Omit<ShareableLink, 'id'> = {
      filterState,
      viewId,
      tableId,
      createdAt: now,
      expiresAt,
      createdBy: userId,
      name: options?.name,
      description: options?.description,
      sortConfig: options?.sortConfig,
    };

    const docRef = doc(collection(db, COLLECTION_NAME), linkId);
    await setDoc(docRef, {
      ...linkData,
      createdAt: Timestamp.fromDate(linkData.createdAt),
      expiresAt: linkData.expiresAt ? Timestamp.fromDate(linkData.expiresAt) : null,
    });

    logger.debug(`Shareable link saved: ${linkId}`, {
      component: 'shareableLinkService',
      operation: 'saveShareableLink',
      linkId,
      tableId,
    });

    return linkId;
  } catch (error) {
    logger.error('Error saving shareable link', error, {
      component: 'shareableLinkService',
      operation: 'saveShareableLink',
    });
    throw error;
  }
}

/**
 * Load a shareable link from Firestore
 */
export async function loadShareableLink(linkId: string): Promise<ShareableLink | null> {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME), linkId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      logger.warn(`Shareable link not found: ${linkId}`, {
        component: 'shareableLinkService',
        operation: 'loadShareableLink',
        linkId,
      });
      return null;
    }

    const data = docSnap.data();
    const now = new Date();

    // Check if link has expired
    if (data.expiresAt) {
      const expiresAt = (data.expiresAt as Timestamp).toDate();
      if (expiresAt < now) {
        logger.warn(`Shareable link expired: ${linkId}`, {
          component: 'shareableLinkService',
          operation: 'loadShareableLink',
          linkId,
          expiresAt,
        });
        return null;
      }
    }

    const link: ShareableLink = {
      id: linkId,
      filterState: data.filterState as FilterValues,
      viewId: data.viewId as string,
      tableId: data.tableId as string,
      createdAt: (data.createdAt as Timestamp).toDate(),
      expiresAt: data.expiresAt ? (data.expiresAt as Timestamp).toDate() : undefined,
      createdBy: data.createdBy as string,
      name: data.name as string | undefined,
      description: data.description as string | undefined,
      sortConfig: data.sortConfig as { key: string; direction: 'asc' | 'desc' } | undefined,
    };

    return link;
  } catch (error) {
    logger.error('Error loading shareable link', error, {
      component: 'shareableLinkService',
      operation: 'loadShareableLink',
      linkId,
    });
    throw error;
  }
}

/**
 * Get all shareable links created by a user
 */
export async function getUserShareableLinks(userId: string, limitCount: number = 50): Promise<ShareableLink[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const links: ShareableLink[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const now = new Date();

      // Skip expired links
      if (data.expiresAt) {
        const expiresAt = (data.expiresAt as Timestamp).toDate();
        if (expiresAt < now) {
          return;
        }
      }

      links.push({
        id: doc.id,
        filterState: data.filterState as FilterValues,
        viewId: data.viewId as string,
        tableId: data.tableId as string,
        createdAt: (data.createdAt as Timestamp).toDate(),
        expiresAt: data.expiresAt ? (data.expiresAt as Timestamp).toDate() : undefined,
        createdBy: data.createdBy as string,
        name: data.name as string | undefined,
        description: data.description as string | undefined,
        sortConfig: data.sortConfig as { key: string; direction: 'asc' | 'desc' } | undefined,
      });
    });

    return links;
  } catch (error) {
    logger.error('Error getting user shareable links', error, {
      component: 'shareableLinkService',
      operation: 'getUserShareableLinks',
      userId,
    });
    throw error;
  }
}

/**
 * Delete a shareable link
 */
export async function deleteShareableLink(linkId: string, userId: string): Promise<void> {
  try {
    // Verify ownership before deleting
    const link = await loadShareableLink(linkId);
    if (!link) {
      throw new Error('Link not found');
    }

    if (link.createdBy !== userId) {
      throw new Error('Unauthorized: You can only delete your own links');
    }

    const docRef = doc(collection(db, COLLECTION_NAME), linkId);
    await deleteDoc(docRef);

    logger.debug(`Shareable link deleted: ${linkId}`, {
      component: 'shareableLinkService',
      operation: 'deleteShareableLink',
      linkId,
      userId,
    });
  } catch (error) {
    logger.error('Error deleting shareable link', error, {
      component: 'shareableLinkService',
      operation: 'deleteShareableLink',
      linkId,
      userId,
    });
    throw error;
  }
}

/**
 * Generate a shareable URL
 */
export function generateShareableUrl(linkId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${linkId}`;
}
