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

  const { userId, role, allowedViews } = data;

  // Accept 'viewer' or 'admin' as roles
  if (!userId || !role || !['viewer', 'admin'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters. Role must be "viewer" or "admin"');
  }

  try {
    // Build custom claims object
    const customClaims: { role: string; allowedViews?: string[] } = { role };
    
    // If viewer role and allowedViews provided, add them to claims
    if (role === 'viewer' && allowedViews && Array.isArray(allowedViews)) {
      customClaims.allowedViews = allowedViews;
    }

    // Set custom claim
    await admin.auth().setCustomUserClaims(userId, customClaims);

    return { success: true, message: 'Role set successfully' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError('internal', errorMessage);
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
    // Delete Firebase Authentication account
    await admin.auth().deleteUser(userId);

    return { success: true, message: 'User account deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
