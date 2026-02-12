# Quick Setup: Apps Script URL

**Notera**: Detta är en snabbguide. För detaljerad dokumentation inklusive delta-sync setup, se `APPS_SCRIPT_SETUP.md`.

## Snabbinstruktion för att fixa CORS-problemet

### ✅ Steg 1: Skapa .env.local (för lokal utveckling)

Skapa en fil `.env.local` i projektets root med följande innehåll:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

**OBS**: Filen `.env.local` ignoreras av Git (det är bra för säkerhet).

### ✅ Steg 2: Konfigurera i Vercel (för produktion)

1. Gå till [Vercel Dashboard](https://vercel.com/dashboard)
2. Välj projektet "STOCK SCORE" (eller ditt projektsnamn)
3. Klicka på **Settings** i toppmenyn
4. Klicka på **Environment Variables** i sidomenyn
5. Klicka på knappen **Add New** (eller **Add**)
6. Fyll i formuläret:
   - **Key**: `VITE_APPS_SCRIPT_URL`
   - **Value**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec` (ersätt YOUR_SCRIPT_ID med ditt Script ID från Apps Script deployment)
   - **Environments**: Välj alla tre (Production, Preview, Development)
7. Klicka på **Save**

### ⚠️ Steg 3: VIKTIGT - Redeploya projektet!

Efter att ha lagt till environment variables i Vercel **måste** du redeploya:

**Alternativ A: Via Vercel Dashboard**
1. Gå till **Deployments**-fliken
2. Hitta senaste deployment (överst i listan)
3. Klicka på de tre prickarna (⋮) bredvid deploymenten
4. Välj **Redeploy**
5. Bekräfta

**Alternativ B: Via Git push**
1. Gör en liten ändring i koden (eller skapa en tom commit)
2. Pusha till GitHub
3. Vercel deployar automatiskt

### ✅ Steg 4: Verifiera

1. **Lokalt**: 
   - Starta appen: `npm run dev`
   - Öppna Developer Console (F12)
   - Du bör se: `✅ Apps Script URL configured successfully!`

2. **I produktion**:
   - Besök din Vercel-URL
   - Öppna Developer Console (F12)
   - Du bör se: `✅ Apps Script URL configured successfully!`
   - Om du ser fel, kontrollera att du har redeployat efter att ha lagt till environment variable

3. **Testa Apps Script direkt**:
   Öppna denna URL i webbläsaren:
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?sheet=DashBoard
   ```
   (Ersätt YOUR_SCRIPT_ID med ditt Script ID.)
   Du bör se JSON-data. Om du ser en inloggningssida eller felmeddelande, kontrollera att Apps Script är deployat med "Who has access" = "Anyone".

### Token och fail-closed (prod)

För fullständig token-policy: se [docs/SECURITY.md](docs/SECURITY.md). Kort: Client→Proxy använder Authorization header; Function→Apps Script använder body (Apps Script läser ej headers). Fail-closed: API_TOKEN satt => 401 utan giltig token. Dev: Lämna API_TOKEN tomt för enklare utveckling.

### Secure mode och proxy

I produktion ska **secure mode** vara aktiverat. Sätt då:

- `VITE_APPS_SCRIPT_TOKEN` – API-token (samma som i Apps Script Script properties)
- `VITE_APPS_SCRIPT_PROXY_URL` – URL till proxy som vidarebefordrar till Apps Script (proxy krävs i secure mode)

Alternativt: sätt `VITE_APPS_SCRIPT_SECURE_MODE=true` för att tvinga secure beteende utan token (proxy krävs fortfarande). I secure mode blockeras legacy GET helt; använd delta sync eller admin refresh. Se [docs/SECURITY.md](docs/SECURITY.md) sektion "Steg C" för detaljer.

## Felsökning

### Problemet kvarstår efter redeploy?

1. **Rensa cache**: 
   - Hård refresh i webbläsaren: `Ctrl+Shift+R` (Windows) eller `Cmd+Shift+R` (Mac)
   - Eller öppna i Incognito/Private mode

2. **Kontrollera environment variable**:
   - Gå tillbaka till Vercel → Settings → Environment Variables
   - Verifiera att `VITE_APPS_SCRIPT_URL` finns
   - Verifiera att värdet är rätt format: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
   - Verifiera att alla tre environments (Production, Preview, Development) är ikryssade

3. **Kontrollera Apps Script deployment**:
   - Gå till [Apps Script](https://script.google.com)
   - Välj ditt projekt
   - Gå till **Deploy** → **Manage deployments**
   - Kontrollera att "Who has access" är satt till **"Anyone"**
   - Om inte, klicka på redigeringsikonen och ändra till "Anyone", spara och deploya igen

4. **Kontrollera i browser console**:
   - Öppna Network tab i Developer Tools
   - Filtrera på "script.google.com"
   - Se om requests görs till Apps Script eller om det fortfarande använder CSV proxy

## Ytterligare hjälp

- **Detaljerad guide**: Se `APPS_SCRIPT_SETUP.md` för komplett dokumentation om Apps Script setup inklusive delta-sync
- **Alternativ snabbguide**: Se `QUICK_FIX.md` för en kortare version av denna guide
- **Problem?**: Kontrollera att Apps Script är deployat som "Web app" (inte "Library") med "Who has access" = "Anyone"
