# Apps Script Setup Guide

Denna guide visar hur du skapar en Google Apps Script för att ersätta CORS proxy-lösningen med en direkt JSON API. Denna guide inkluderar även delta-sync funktionalitet för effektivare datauppdateringar.

## Delta Sync Support

Appen stödjer nu delta-sync för effektivare datauppdateringar:
- Första gången: Hämtar full snapshot av all data
- Därefter: Hämtar endast ändringar (delta) var 15-30 minuter
- Uppdaterar UI inkrementellt utan full sid-reload

Delta-sync är aktiverat som standard. För att inaktivera, sätt `VITE_DELTA_SYNC_ENABLED=false` i environment variables.

## Steg 1: Skapa Apps Script

1. Öppna ditt Google Sheet: https://docs.google.com/spreadsheets/d/1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE
2. Gå till **Extensions** → **Apps Script**
3. **För delta-sync support**: Kopiera koden från `apps-script/Code.gs` i detta projekt
4. **Alternativt (endast grundläggande API)**: Ersätt all kod med följande:

```javascript
function doGet(e) {
  try {
    const sheetName = e.parameter.sheet || 'DashBoard';
    const ss = SpreadsheetApp.openById('1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE');
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      const errorData = { error: `Sheet "${sheetName}" not found` };
      return ContentService
        .createTextOutput(JSON.stringify(errorData))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const values = sheet.getDataRange().getValues();
    const output = ContentService
      .createTextOutput(JSON.stringify(values))
      .setMimeType(ContentService.MimeType.JSON);
    
    return output;
  } catch (error) {
    const errorData = { 
      error: 'Server error', 
      message: error.toString() 
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorData))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Steg 2: Konfigurera API Token (Valfritt, rekommenderat för delta-sync)

För delta-sync API-token autentisering (valfritt men rekommenderat):

1. I Apps Script, gå till **Project Settings** (kugghjulsikonen)
2. Klicka på **Script properties**
3. Lägg till en ny property:
   - **Property**: `API_TOKEN`
   - **Value**: Välj en säker token (t.ex. generera med `openssl rand -hex 32`)
4. Klicka **Save**
5. **Viktigt**: Kopiera denna token - du behöver den för frontend-konfiguration

**Notera**: Om ingen token sätts, tillåts alla requests (för enklare setup, men mindre säkert).

## Steg 3: Installera onEdit Trigger (Endast för delta-sync)

Om du använder delta-sync-koden:

1. I Apps Script, välj funktionen `installTriggers` i dropdown-menyn
2. Klicka på **Run** (kör)
3. **Notera**: `onEdit` är en "simple trigger" som installeras automatiskt av Google Sheets - ingen manuell installation behövs
4. Varje gång data ändras i DashBoard eller SMA-ark, loggas ändringen automatiskt i ChangeLog-arket

**ChangeLog-ark**: Skapas automatiskt av Apps Script-koden. Detta ark trackar alla ändringar i övervakade sheets.

## Steg 4: Deploya som Web App

1. Klicka på **Deploy** → **New deployment**
2. Välj typ: **Web app** (INTE "Library"!)
3. Fyll i:
   - **Description**: "Stock Score Data API"
   - **Execute as**: "Me"
   - **Who has access**: **"Anyone"** (viktigt för CORS!)
4. Klicka på **Deploy**
5. **VIKTIGT**: Godkänn behörighetsgivningen när Google ber om det
6. **Kopiera Web App URL** (måste sluta med `/exec`, t.ex: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`)
   - ⚠️ **INTE** `/library/...` - det är för libraries, inte Web Apps
   - ✅ Måste vara `/s/.../exec` format

## Steg 5: Konfigurera i appen

### För lokal utveckling:

Skapa en `.env.local` fil i projektets root:
```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec
VITE_DELTA_SYNC_ENABLED=true
VITE_DELTA_SYNC_POLL_MINUTES=15
VITE_APPS_SCRIPT_TOKEN=your-token-here
```

**Delta-sync inställningar** (valfria):
- `VITE_DELTA_SYNC_ENABLED`: Aktivera/inaktivera delta-sync (default: `true`)
- `VITE_DELTA_SYNC_POLL_MINUTES`: Poll-intervall i minuter (default: `15`)
- `VITE_APPS_SCRIPT_TOKEN`: API-token för autentisering (valfritt)

### För Vercel deployment (VIKTIGT!):

1. Gå till [Vercel Dashboard](https://vercel.com/dashboard)
2. Välj ditt projekt "STOCK SCORE"
3. Gå till **Settings** → **Environment Variables**
4. Klicka på **Add New**
5. Fyll i:
   - **Key**: `VITE_APPS_SCRIPT_URL`
   - **Value**: `https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec`
   - **Environment**: Välj alla (Production, Preview, Development)
6. (Valfritt) Lägg till delta-sync inställningar:
   - **Key**: `VITE_DELTA_SYNC_ENABLED`, **Value**: `true`
   - **Key**: `VITE_DELTA_SYNC_POLL_MINUTES`, **Value**: `15`
   - **Key**: `VITE_APPS_SCRIPT_TOKEN`, **Value**: `your-token-here` (samma token som i Apps Script)
6. Klicka **Save**
7. **VIKTIGT**: Du måste **redeploya** projektet efter att ha lagt till environment variables!
   - Gå till **Deployments** → Välj senaste deployment → **Redeploy**
   - Eller pusha en ny commit till GitHub (detta triggar automatisk redeploy)

## Steg 6: Testa

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

### CORS-fel (Access-Control-Allow-Origin)
Om du ser CORS-fel i konsolen:
1. **Kontrollera deployment**: Gå till **Deploy** → **Manage deployments**
2. **Redigera deployment**: Klicka på pennikonen (edit) bredvid din deployment
3. **Kontrollera "Who has access"**: Måste vara **"Anyone"** (inte "Anyone with Google account")
4. **Spara och deploya igen**: Även om inställningarna är rätt, kan det behöva omdeployas
5. **Testa URL direkt**: Öppna Apps Script URL i webbläsaren, du bör se JSON-data direkt
6. **Kontrollera URL-format**: 
   - ✅ Rätt: `https://script.google.com/macros/s/SCRIPT_ID/exec`
   - ❌ Fel: `https://script.google.com/macros/library/LIBRARY_ID/...`

### Data kommer inte
- Kontrollera att sheet-namnet matchar exakt ("DashBoard" eller "SMA" - case-sensitive!)
- Testa Apps Script URL direkt i webbläsaren med parameter: `?sheet=DashBoard`
- Kontrollera att sheet-ID är korrekt i Apps Script-koden

### URL fungerar inte
- Se till att du har kopierat hela URL:en inklusive `/exec`
- Kontrollera att du har deployat som "Web app", inte "Library"
- Testa URL:en i en ny inkognitofönster för att undvika cache-problem

### Ytterligare tips
- Om du ändrar Apps Script-koden, måste du deploya en **ny version** eller **uppdatera** den befintliga
- Google kan kräva att du godkänner behörigheter första gången du deployar
- Vercel environment variables måste vara satta för Production, Preview, och Development miljöer
- **VIKTIGT**: Efter att ha lagt till environment variables i Vercel, måste du **redeploya** projektet för att ändringarna ska gälla!

### Verifiera konfigurationen

För att kontrollera om Apps Script URL är korrekt konfigurerad:

1. **Lokalt**: Öppna Developer Console i webbläsaren. Du bör se:
   - ✅ `Apps Script URL configured successfully!` om URL är satt
   - ❌ `Apps Script URL NOT configured in Vercel!` om URL saknas

2. **I produktion (Vercel)**: Öppna Developer Console på din Vercel-deployade sida
   - Kontrollera samma meddelanden som ovan

3. **Testa Apps Script direkt**: Öppna denna URL i webbläsaren:
   ```
   https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec?sheet=DashBoard
   ```
   Du bör se JSON-data direkt. Om du ser en inloggningssida eller fel, kontrollera deployment-inställningarna.

4. **Testa delta-sync endpoints** (om delta-sync är aktiverat):
   - Snapshot: `?action=snapshot&sheet=DashBoard&token=your-token`
   - Changes: `?action=changes&sheet=DashBoard&since=0&token=your-token`
