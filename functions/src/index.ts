import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Whitelist of viewIds for allowedViews claim validation
const ALLOWED_VIEW_IDS = ['score', 'score-board', 'entry-exit-benjamin-graham', 'fundamental-pe-industry', 'threshold-industry'] as const;

/** Convert allowedViews claim (array or map) to array for UI */
function allowedViewsToArray(claims: Record<string, unknown>): string[] {
  const av = claims.allowedViews;
  if (Array.isArray(av)) {
    return av.filter((v): v is string => typeof v === 'string');
  }
  if (av && typeof av === 'object' && !Array.isArray(av)) {
    return Object.keys(av).filter((k) => (av as Record<string, unknown>)[k] === true);
  }
  return [];
}

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
    // Default allowedViews for new viewers: score only
    await admin.auth().setCustomUserClaims(uid, { role: 'viewer', allowedViews: { score: true } });

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
      const claims = (userRecord.customClaims || {}) as Record<string, unknown>;
      const role = (claims.role as string) || null;
      const allowedViews = allowedViewsToArray(claims);
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

  const adminUid = context.auth!.uid;
  const { userId, role, allowedViews } = data;

  // Accept 'viewer' or 'admin' as roles
  if (!userId || !role || !['viewer', 'admin'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters. Role must be "viewer" or "admin"');
  }

  try {
    // Build custom claims: role + allowedViews as MAP for Firestore rules
    const customClaims: { role: string; allowedViews?: Record<string, boolean> } = { role };

    if (role === 'viewer' && allowedViews && Array.isArray(allowedViews)) {
      // Validate each viewId against whitelist
      const allowedViewsMap: Record<string, boolean> = {};
      for (const viewId of allowedViews) {
        if (typeof viewId === 'string' && (ALLOWED_VIEW_IDS as readonly string[]).includes(viewId)) {
          allowedViewsMap[viewId] = true;
        }
      }
      customClaims.allowedViews = allowedViewsMap;
    } else if (role === 'admin') {
      // Admin does not need allowedViews
      customClaims.allowedViews = undefined;
    }

    await admin.auth().setCustomUserClaims(userId, customClaims);

    // Audit log
    const allowedViewsArray = role === 'viewer' && customClaims.allowedViews
      ? Object.keys(customClaims.allowedViews).filter((k) => customClaims.allowedViews![k] === true)
      : [];
    await admin.firestore().collection('adminActions').add({
      action: 'setUserRole',
      adminUid,
      targetUid: userId,
      newRole: role,
      allowedViewsArray,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Role set successfully' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError('internal', errorMessage);
  }
});

// Admin refresh cache - fetches from Apps Script, writes to viewData
export const adminRefreshCache = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const adminUid = context.auth!.uid;
  const { viewIds, force, dryRun } = data || {};

  const appsScriptUrl =
    (process.env.APPS_SCRIPT_URL as string) ||
    (functions.config().apps_script?.url as string) ||
    '';
  const appsScriptToken =
    (process.env.APPS_SCRIPT_TOKEN as string) ||
    (functions.config().apps_script?.token as string) ||
    '';

  if (!appsScriptUrl) {
    throw new functions.https.HttpsError('failed-precondition', 'APPS_SCRIPT_URL not configured');
  }

  const { runAdminRefresh } = await import('./adminRefreshHelpers');
  const migrationMode = (
    (process.env.VIEWDATA_MIGRATION_MODE as string) ||
    (functions.config().viewdata?.migration_mode as string) ||
    'dual-read'
  ) as 'dual-write' | 'dual-read' | 'cutover';

  const viewIdsArray = Array.isArray(viewIds) ? viewIds : [];
  const isDryRun = dryRun === true;

  try {
    const { refreshed, errors } = await runAdminRefresh(
      appsScriptUrl,
      appsScriptToken || undefined,
      viewIdsArray,
      adminUid,
      migrationMode,
      isDryRun
    );

    const resultsSummary = { refreshed: refreshed.length, errors: errors.length };

    await admin.firestore().collection('adminActions').add({
      action: 'adminRefreshCache',
      adminUid,
      viewIds: viewIdsArray.length > 0 ? viewIdsArray : ['all'],
      resultsSummary,
      refreshed: refreshed.map((r) => ({ viewId: r.viewId, rows: r.rows, durationMs: r.durationMs })),
      errors,
      dryRun: isDryRun,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      refreshed,
      errors,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('adminRefreshCache error:', error);
    throw new functions.https.HttpsError('internal', errorMessage);
  }
});

/**
 * Apps Script Proxy - allows client to send token in Authorization header only.
 * Proxy validates token and forwards to Apps Script with token in body (Apps Script cannot read headers).
 */
export const appsScriptProxy = functions.https.onRequest(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.set(corsHeaders);
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const appsScriptUrl =
    (process.env.APPS_SCRIPT_URL as string) ||
    (functions.config().apps_script?.url as string) ||
    '';
  const validToken =
    (process.env.APPS_SCRIPT_TOKEN as string) ||
    (functions.config().apps_script?.token as string) ||
    '';

  if (!appsScriptUrl || !validToken) {
    res.set(corsHeaders);
    res.status(500).json({ ok: false, error: 'Proxy not configured' });
    return;
  }

  const authHeader = req.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== validToken) {
    res.set(corsHeaders);
    res.status(401).json({ ok: false, error: 'Unauthorized: Invalid or missing API token' });
    return;
  }

  let body: { action?: string; sheet?: string; since?: number } = {};
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      const raw = (req as { rawBody?: Buffer })?.rawBody;
      body = raw ? JSON.parse(raw.toString()) : {};
    }
  } catch {
    res.set(corsHeaders);
    res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    return;
  }

  const action = body.action || 'snapshot';
  const sheet = body.sheet || 'DashBoard';
  const since = body.since ?? 0;

  try {
    const appsScriptBody = JSON.stringify({ action, sheet, since, token });
    const proxyRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: appsScriptBody,
    });
    const json = await proxyRes.json();
    res.set(corsHeaders);
    res.status(proxyRes.status).json(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('appsScriptProxy error:', msg);
    res.set(corsHeaders);
    res.status(500).json({ ok: false, error: `Proxy error: ${msg}` });
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
