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

// Delete user account and associated Firestore data (userData, userPreferences, userPortfolios)
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;

  if (!userId || userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'You can only delete your own account');
  }

  const db = admin.firestore();

  const paths = [
    { key: 'userData', ref: db.doc(`userData/${userId}`) },
    { key: 'userPreferences', ref: db.doc(`userPreferences/${userId}`) },
    { key: 'userPortfolios', ref: db.doc(`userPortfolios/${userId}`) },
  ] as const;

  const deleteResults = await Promise.allSettled(paths.map((p) => p.ref.delete()));

  const deletedDocs: { userData: boolean; userPreferences: boolean; userPortfolios: boolean } = {
    userData: false,
    userPreferences: false,
    userPortfolios: false,
  };

  deleteResults.forEach((result, i) => {
    const key = paths[i].key;
    if (result.status === 'fulfilled') {
      deletedDocs[key] = true;
    } else {
      console.error(`deleteUserAccount: failed deleting ${paths[i].ref.path}`, result.reason);
    }
  });

  try {
    await admin.auth().deleteUser(userId);
  } catch (authError: unknown) {
    const msg = authError instanceof Error ? authError.message : String(authError);
    console.error('deleteUserAccount: failed to delete Auth user', authError);
    throw new functions.https.HttpsError('internal', msg);
  }

  const allDocsOk = deletedDocs.userData && deletedDocs.userPreferences && deletedDocs.userPortfolios;
  return {
    success: true,
    message: allDocsOk ? 'User account deleted successfully' : 'User account deleted; some data cleanup may have failed',
    deletedAuth: true,
    deletedDocs,
  };
});
