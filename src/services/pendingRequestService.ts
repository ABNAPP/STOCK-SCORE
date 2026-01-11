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
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { User } from 'firebase/auth';

// Firestore collection name
const COLLECTION_NAME = 'pendingRequests';

// Request types
export type RequestType = 'initial_registration' | 'upgrade_request';

// Request status
export type RequestStatus = 'pending' | 'approved' | 'denied';

// Request roles
export type RequestedRole = 'viewer1' | 'viewer2' | 'editor';

// Pending Request interface
export interface PendingRequest {
  userId: string;
  email: string;
  name?: string;
  requestedRole: RequestedRole;
  requestType: RequestType;
  status: RequestStatus;
  timestamp: any; // Firestore Timestamp or Date
  approvedRole?: RequestedRole | 'admin' | 'viewer1' | 'viewer2';
  approvedAt?: any;
  approvedBy?: string;
  deniedAt?: any;
  deniedBy?: string;
}

/**
 * Create a new pending request
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
  } catch (error) {
    console.error('Error creating pending request:', error);
    throw error;
  }
}

/**
 * Get pending request for a user
 */
export async function getPendingRequest(userId: string): Promise<PendingRequest | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as PendingRequest;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting pending request:', error);
    return null;
  }
}

/**
 * Get all pending requests (for admin)
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
      const aTime = a.timestamp?.toMillis?.() || 0;
      const bTime = b.timestamp?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    return requests;
  } catch (error) {
    console.error('Error getting all pending requests:', error);
    return [];
  }
}

/**
 * Update request status (for admin - via Cloud Function)
 * This is typically called from a Cloud Function, not directly from client
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
  } catch (error) {
    console.error('Error updating request status:', error);
    throw error;
  }
}

/**
 * Delete a pending request (for user to withdraw their request)
 * Only allowed if the request is still pending
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
  } catch (error) {
    console.error('Error deleting pending request:', error);
    throw error;
  }
}

/**
 * Automatically approve viewer2 request for new registrations
 * This sets the viewer2 role via Cloud Function and updates the request status
 * The Cloud Function handles both setting the role and updating Firestore (with admin privileges)
 */
export async function autoApproveViewer2Request(userId: string): Promise<void> {
  try {
    // Call Cloud Function to set viewer2 role and update request status
    // The Cloud Function has admin privileges and can update Firestore
    const autoApproveViewer2 = httpsCallable(functions, 'autoApproveViewer2');
    await autoApproveViewer2({ userId });
  } catch (error) {
    console.error('Error auto-approving viewer2 request:', error);
    throw error;
  }
}
