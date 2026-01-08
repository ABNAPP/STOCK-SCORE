# Apps Script Setup Guide

Denna guide visar hur du skapar en Google Apps Script för att ersätta CORS proxy-lösningen med en direkt JSON API.

## Steg 1: Skapa Apps Script

1. Öppna ditt Google Sheet: https://docs.google.com/spreadsheets/d/1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE
2. Gå till **Extensions** → **Apps Script**
3. Ersätt all kod med följande:

```javascript
function doGet(e) {
  const sheetName = e.parameter.sheet || 'DashBoard';
  const ss = SpreadsheetApp.openById('1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE');
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: `Sheet "${sheetName}" not found` }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const values = sheet.getDataRange().getValues();
  return ContentService
    .createTextOutput(JSON.stringify(values))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Steg 2: Deploya som Web App

1. Klicka på **Deploy** → **New deployment**
2. Välj typ: **Web app**
3. Fyll i:
   - **Description**: "Stock Score Data API"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone" (eller "Anyone with Google account" om du vill ha autentisering)
4. Klicka på **Deploy**
5. **Kopiera Web App URL** (ser ut som: `https://script.google.com/macros/s/.../exec`)

## Steg 3: Konfigurera i appen

1. Skapa en `.env.local` fil i projektets root (eller lägg till i Vercel Environment Variables):
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

2. För Vercel deployment:
   - Gå till Vercel Dashboard → Ditt Projekt → Settings → Environment Variables
   - Lägg till: `VITE_APPS_SCRIPT_URL` med din Apps Script URL
   - Välj alla miljöer (Production, Preview, Development)

## Steg 4: Testa

1. Starta appen: `npm run dev`
2. Öppna Developer Tools → Network tab
3. Du bör se requests till din Apps Script URL istället för CORS proxy
4. Om Apps Script URL inte är konfigurerad, faller appen tillbaka till CSV via CORS proxy

## Fördelar

- ✅ Snabbare (direkt JSON, ingen CSV parsing)
- ✅ Mer pålitligt (Google's infrastruktur)
- ✅ Mindre dataöverföring (JSON är kompaktare)
- ✅ Bättre kontroll över dataformatering
- ✅ Automatisk fallback till CSV om Apps Script inte är tillgängligt

## Felsökning

- Om du får CORS-fel: Kontrollera att "Who has access" är satt till "Anyone"
- Om data inte kommer: Kontrollera att sheet-namnet matchar exakt ("DashBoard" eller "SMA")
- Om URL inte fungerar: Se till att du har kopierat hela URL:en inklusive `/exec`
