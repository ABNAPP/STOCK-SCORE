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

// Claim viewer role (for newly signed-up users; sets role to viewer and creates userData doc)
export const claimViewerRole = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;

  try {
    await admin.auth().setCustomUserClaims(uid, { role: 'viewer' });

    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email ?? '';

    await admin.firestore().doc(`userData/${uid}`).set(
      {
        uid,
        email,
        role: 'viewer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, message: 'Viewer role set successfully' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error claiming viewer role:', error);
    throw new functions.https.HttpsError('internal', errorMessage);
  }
});

// List users (admin only) - returns uid, email, role, allowedViews from custom claims
export const listUsers = functions.https.onCall(async (_data, context) => {
  await verifyAdmin(context);

  try {
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users.map((userRecord) => {
      const claims = userRecord.customClaims || {};
      const role = (claims.role as string) || null;
      const allowedViews = Array.isArray(claims.allowedViews) ? (claims.allowedViews as string[]) : [];
      return {
        uid: userRecord.uid,
        email: userRecord.email || '',
        role,
        allowedViews,
      };
    });
    return { users };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError('internal', errorMessage);
  }
});

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
