/**
 * Pending Request Service
 * 
 * Handles creation and management of pending user registration and upgrade requests.
 * These requests are reviewed by admins who can approve or deny them.
 */

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { User } from 'firebase/auth';
import { logger } from '../utils/logger';

// Firestore collection name
const COLLECTION_NAME = 'pendingRequests';

// Request types
export type RequestType = 'initial_registration' | 'upgrade_request';

// Request status
export type RequestStatus = 'pending' | 'approved' | 'denied';

// Request roles
export type RequestedRole = 'viewer1' | 'viewer2' | 'editor';

/**
 * Pending Request interface
 * 
 * Represents a user's request for registration or role upgrade.
 */
export interface PendingRequest {
  userId: string;
  email: string;
  name?: string;
  requestedRole: RequestedRole;
  requestType: RequestType;
  status: RequestStatus;
  timestamp: Timestamp | Date | FieldValue;
  approvedRole?: RequestedRole | 'admin' | 'viewer1' | 'viewer2';
  approvedAt?: Timestamp | Date | FieldValue | undefined;
  approvedBy?: string;
  deniedAt?: Timestamp | Date | FieldValue | undefined;
  deniedBy?: string;
}

/**
 * Create a new pending request
 * 
 * Creates a new pending request for user registration or role upgrade.
 * If a pending request already exists, throws an error. If a previous
 * request was denied, updates it to create a new pending request.
 * 
 * @param user - Firebase user object
 * @param requestedRole - Role the user is requesting
 * @param requestType - Type of request (initial_registration or upgrade_request)
 * @throws {Error} If a pending request already exists or creation fails
 * 
 * @example
 * ```typescript
 * await createPendingRequest(user, 'editor', 'upgrade_request');
 * ```
 */
export async function createPendingRequest(
  user: User,
  requestedRole: RequestedRole,
  requestType: RequestType
): Promise<void> {
  try {
    const requestId = user.uid; // Use userId as document ID for easy lookup
    
    // Check if request already exists
    const existingDoc = await getDoc(doc(db, COLLECTION_NAME, requestId));
    
    if (existingDoc.exists()) {
      const existingData = existingDoc.data() as PendingRequest;
      
      // If there's already a pending request, don't create a new one
      if (existingData.status === 'pending') {
        throw new Error('A pending request already exists for this user');
      }
      
      // If previous request was denied, update it to create a new pending request
      if (existingData.status === 'denied') {
        const updatedRequest: Partial<PendingRequest> = {
          requestedRole,
          requestType,
          status: 'pending',
          timestamp: serverTimestamp(),
          deniedAt: undefined,
          deniedBy: undefined,
        };
        
        await updateDoc(doc(db, COLLECTION_NAME, requestId), updatedRequest);
        return;
      }
    }
    
    // Create new request
    const request: PendingRequest = {
      userId: user.uid,
      email: user.email || '',
      name: user.displayName || undefined,
      requestedRole,
      requestType,
      status: 'pending',
      timestamp: serverTimestamp(),
    };
    
    await setDoc(doc(db, COLLECTION_NAME, requestId), request);
  } catch (error: unknown) {
    logger.error('Error creating pending request', error, { component: 'pendingRequestService', operation: 'createPendingRequest' });
    throw error;
  }
}

/**
 * Get pending request for a user
 * 
 * Retrieves the pending request for a specific user by their user ID.
 * 
 * @param userId - Firebase user ID
 * @returns Pending request if found, null otherwise
 * 
 * @example
 * ```typescript
 * const request = await getPendingRequest(user.uid);
 * if (request && request.status === 'pending') {
 *   // Show waiting message
 * }
 * ```
 */
export async function getPendingRequest(userId: string): Promise<PendingRequest | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as PendingRequest;
    }
    
    return null;
  } catch (error: unknown) {
    logger.error('Error getting pending request', error, { component: 'pendingRequestService', operation: 'getPendingRequest' });
    return null;
  }
}

/**
 * Get all pending requests (for admin)
 * 
 * Retrieves all pending requests from Firestore, sorted by timestamp
 * (newest first). Only returns requests with status 'pending'.
 * 
 * @returns Array of pending requests, sorted by timestamp (newest first)
 * 
 * @example
 * ```typescript
 * const requests = await getAllPendingRequests();
 * requests.forEach(request => {
 *   console.log(request.email, request.requestedRole);
 * });
 * ```
 */
export async function getAllPendingRequests(): Promise<PendingRequest[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    const requests: PendingRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      requests.push(doc.data() as PendingRequest);
    });
    
    // Sort by timestamp (newest first)
    requests.sort((a, b) => {
      const getTime = (ts: Timestamp | Date | FieldValue): number => {
        if (ts instanceof Date) {
          return ts.getTime();
        }
        if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as Timestamp).toMillis === 'function') {
          return (ts as Timestamp).toMillis();
        }
        return 0;
      };
      const aTime = a.timestamp ? getTime(a.timestamp) : 0;
      const bTime = b.timestamp ? getTime(b.timestamp) : 0;
      return bTime - aTime;
    });
    
    return requests;
  } catch (error: unknown) {
    logger.error('Error getting all pending requests', error, { component: 'pendingRequestService', operation: 'getAllPendingRequests' });
    return [];
  }
}

/**
 * Update request status (for admin - via Cloud Function)
 * 
 * Updates the status of a pending request (approve or deny).
 * This is typically called from a Cloud Function with admin privileges,
 * not directly from the client.
 * 
 * @param requestId - User ID of the request to update
 * @param status - New status ('approved' or 'denied')
 * @param approvedRole - Role to assign if approved (optional)
 * @param processedBy - User ID of the admin processing the request (optional)
 * @throws {Error} If update fails
 * 
 * @example
 * ```typescript
 * await updateRequestStatus(userId, 'approved', 'editor', adminUserId);
 * ```
 */
export async function updateRequestStatus(
  requestId: string,
  status: 'approved' | 'denied',
  approvedRole?: RequestedRole | 'admin',
  processedBy?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, requestId);
    const updateData: Partial<PendingRequest> = {
      status,
      ...(status === 'approved' 
        ? { 
            approvedRole, 
            approvedAt: serverTimestamp(),
            approvedBy: processedBy
          }
        : { 
            deniedAt: serverTimestamp(),
            deniedBy: processedBy
          }
      ),
    };
    
    await updateDoc(docRef, updateData);
  } catch (error: unknown) {
    logger.error('Error updating request status', error, { component: 'pendingRequestService', operation: 'updateRequestStatus' });
    throw error;
  }
}

/**
 * Delete a pending request (for user to withdraw their request)
 * 
 * Allows a user to withdraw their pending request. Only allowed if
 * the request is still pending and belongs to the user.
 * 
 * @param userId - User ID of the request to delete
 * @throws {Error} If request not found, not pending, or doesn't belong to user
 * 
 * @example
 * ```typescript
 * await deletePendingRequest(user.uid);
 * ```
 */
export async function deletePendingRequest(userId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Request not found');
    }
    
    const requestData = docSnap.data() as PendingRequest;
    
    // Only allow deletion if request is pending
    if (requestData.status !== 'pending') {
      throw new Error('Can only withdraw pending requests');
    }
    
    // Verify the request belongs to the user
    if (requestData.userId !== userId) {
      throw new Error('Unauthorized: Request does not belong to user');
    }
    
    await deleteDoc(docRef);
  } catch (error: unknown) {
    logger.error('Error deleting pending request', error, { component: 'pendingRequestService', operation: 'deletePendingRequest' });
    throw error;
  }
}

/**
 * Automatically approve viewer2 request for new registrations
 * 
 * Automatically approves a viewer2 role request for new user registrations.
 * This calls a Cloud Function that handles both setting the role and updating
 * Firestore with admin privileges.
 * 
 * @param userId - User ID to auto-approve
 * @throws {Error} If Cloud Function call fails
 * 
 * @example
 * ```typescript
 * await autoApproveViewer2Request(newUser.uid);
 * ```
 */
export async function autoApproveViewer2Request(userId: string): Promise<void> {
  try {
    // Call Cloud Function to set viewer2 role and update request status
    // The Cloud Function has admin privileges and can update Firestore
    const autoApproveViewer2 = httpsCallable(functions, 'autoApproveViewer2');
    await autoApproveViewer2({ userId });
  } catch (error: unknown) {
    logger.error('Error auto-approving viewer2 request', error, { component: 'pendingRequestService', operation: 'autoApproveViewer2Request' });
    throw error;
  }
}
