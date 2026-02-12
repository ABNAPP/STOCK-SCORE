# Cloud Functions Setup för Rollbaserad Åtkomstkontroll

Denna dokumentation beskriver hur du konfigurerar Firebase Cloud Functions för att hantera rollbaserad åtkomstkontroll i appen.

## Översikt

Cloud Functions används för att sätta custom claims på Firebase Authentication-användare. Detta kan inte göras direkt från klienten av säkerhetsskäl - det måste göras från en server med Admin SDK.

## Funktioner som behövs

### 1. setUserRole

Sätter en custom claim (`role`) på en användare och uppdaterar status i `pendingRequests`.

**HTTP Endpoint:** `POST /setUserRole`

**Request Body:**
```json
{
  "userId": "user-id-here",
  "role": "viewer" | "editor",
  "requestId": "request-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role set successfully"
}
```

### 2. denyRequest

Markerar en begäran som nekad i `pendingRequests`.

**HTTP Endpoint:** `POST /denyRequest`

**Request Body:**
```json
{
  "userId": "user-id-here",
  "requestId": "request-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request denied"
}
```

## Implementation Guide

### Steg 1: Installera Firebase CLI

```bash
npm install -g firebase-tools
```

### Steg 2: Initiera Functions

```bash
firebase init functions
```

Välj TypeScript när du blir tillfrågad.

### Steg 3: Skapa Functions-kod

Skapa `functions/src/index.ts`:

```typescript
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

  if (!userId || !role || !['viewer', 'editor'].includes(role)) {
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
```

### Steg 4: Installera Dependencies

```bash
cd functions
npm install firebase-functions firebase-admin
npm install --save-dev @types/node typescript
```

### Steg 5: Deploy Functions

```bash
firebase deploy --only functions
```

### Steg 6: Konfigurera Environment Variables

Efter deploy, konfigurera Cloud Functions för adminRefreshCache:

```bash
firebase functions:config:set apps_script.url="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
firebase functions:config:set apps_script.token="YOUR_APPS_SCRIPT_TOKEN"
```

Eller använd environment variables vid deploy (Firebase stödjer `process.env` för vissa nycklar). Se Firebase-dokumentation för `.env` eller Secret Manager.

**adminRefreshCache** kräver:
- `APPS_SCRIPT_URL` eller `apps_script.url` – Apps Script Web App URL
- `APPS_SCRIPT_TOKEN` eller `apps_script.token` – Token för Apps Script (samma som `VITE_APPS_SCRIPT_TOKEN`)

## Alternativ: HTTP Functions (för AdminPanel)

Om du vill använda HTTP endpoints istället för Callable Functions, kan du använda `functions.https.onRequest`:

```typescript
import * as express from 'express';
import * as cors from 'cors';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware för att verifiera admin-autentisering via Authorization header
async function verifyAdminToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const user = await admin.auth().getUser(decodedToken.uid);
    const claims = user.customClaims || {};
    
    if (claims.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.post('/setUserRole', verifyAdminToken, async (req, res) => {
  const { userId, role } = req.body;
  // ... implementation
});

app.post('/denyRequest', verifyAdminToken, async (req, res) => {
  const { userId } = req.body;
  // ... implementation
});

export const api = functions.https.onRequest(app);
```

## Sätt Admin-roll på första användaren

För att sätta admin-roll på första användaren (dig själv), kör detta i Firebase Console eller via en tillfällig Cloud Function:

```typescript
// Tillfällig function för att sätta admin
export const setInitialAdmin = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  
  // VARNING: Ta bort denna function efter första admin är satt!
  await admin.auth().setCustomUserClaims(userId, { role: 'admin' });
  
  return { success: true };
});
```

ELLER via Firebase Console:
1. Gå till Authentication → Users
2. Hitta din användare
3. Klicka på "..." → "Edit User"
4. I "Custom claims", lägg till: `{"role": "admin"}`

ELLER via Firebase CLI:
```bash
firebase auth:export users.json
# Editera users.json för att lägga till custom claims
firebase auth:import users.json
```

## Säkerhet

- ✅ Alla functions verifierar att användaren är admin
- ✅ Custom claims kan bara sättas från server-side kod
- ✅ Security Rules skyddar Firestore-data
- ✅ Frontend kontrollerar roller för UI, men säkerheten ligger i Security Rules

## Testing

Efter deploy, testa functions via Firebase Console eller via HTTP client som Postman med din ID token i Authorization header.
