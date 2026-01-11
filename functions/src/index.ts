import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Middleware för att verifiera admin-autentisering
async function verifyAdmin(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const token = await admin.auth().getUser(context.auth.uid);
  const claims = token.customClaims || {};
  
  if (claims.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'User must be admin');
  }
}

// Set user role
export const setUserRole = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, role, requestId } = data;

  // Updated to accept viewer1 and viewer2 instead of viewer
  if (!userId || !role || !['viewer1', 'viewer2', 'editor'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters');
  }

  try {
    // Set custom claim
    await admin.auth().setCustomUserClaims(userId, { role });

    // Update pending request status
    const db = admin.firestore();
    await db.collection('pendingRequests').doc(requestId || userId).update({
      status: 'approved',
      approvedRole: role,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: context.auth.uid,
    });

    return { success: true, message: 'Role set successfully' };
  } catch (error: any) {
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Deny request
export const denyRequest = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const { userId, requestId } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters');
  }

  try {
    // Update pending request status
    const db = admin.firestore();
    await db.collection('pendingRequests').doc(requestId || userId).update({
      status: 'denied',
      deniedAt: admin.firestore.FieldValue.serverTimestamp(),
      deniedBy: context.auth.uid,
    });

    return { success: true, message: 'Request denied' };
  } catch (error: any) {
    console.error('Error denying request:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Delete user account
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;

  // User can only delete their own account
  if (!userId || userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'You can only delete your own account');
  }

  try {
    const db = admin.firestore();
    
    // Delete pending request if it exists
    const requestRef = db.collection('pendingRequests').doc(userId);
    const requestDoc = await requestRef.get();
    if (requestDoc.exists) {
      await requestRef.delete();
    }

    // Delete Firebase Authentication account
    await admin.auth().deleteUser(userId);

    return { success: true, message: 'User account deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Auto-approve viewer2 for new registrations
// This function can be called without admin verification since it only sets viewer2 role
export const autoApproveViewer2 = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated (must be the user themselves or authenticated request)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'UserId is required');
  }

  // Verify the user is setting their own role (for new registrations)
  if (userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'You can only approve your own registration');
  }

  try {
    const db = admin.firestore();
    
    // Verify that there's a pending request for this user with viewer2 role
    const requestRef = db.collection('pendingRequests').doc(userId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pending request not found');
    }

    const requestData = requestDoc.data();
    if (requestData?.status !== 'pending' || requestData?.requestedRole !== 'viewer2') {
      throw new functions.https.HttpsError('invalid-argument', 'Request must be pending viewer2 registration');
    }

    // Set custom claim to viewer2
    await admin.auth().setCustomUserClaims(userId, { role: 'viewer2' });

    // Update pending request status to approved in Firestore
    await requestRef.update({
      status: 'approved',
      approvedRole: 'viewer2',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Viewer2 role set successfully' };
  } catch (error: any) {
    console.error('Error auto-approving viewer2:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});
