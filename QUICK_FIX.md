# 🚀 Snabb Fix: Apps Script URL

## Problemet
Konsolen visar: `Apps Script URL not configured, falling back to CSV`

## Lösning (välj rätt beroende på var appen körs)

### ✅ Om appen körs LOKALT (localhost:5173)

**Steg 1**: Skapa en fil som heter `.env.local` i projektets root (samma mapp som `package.json`)

**Steg 2**: Lägg till denna rad i filen:
```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec
```

**Steg 3**: Spara filen och starta om utvecklingsservern:
```bash
# Stoppa servern (Ctrl+C) och starta igen:
npm run dev
```

**Verifiera**: Öppna Developer Console (F12). Du bör se:
```
✅ Apps Script URL configured successfully!
```

---

### ✅ Om appen körs på VERCEL (produktion)

**Steg 1**: Gå till [Vercel Dashboard](https://vercel.com/dashboard)

**Steg 2**: Välj projektet "STOCK SCORE" (eller ditt projektsnamn)

**Steg 3**: 
- Klicka på **Settings** (överst i menyn)
- Klicka på **Environment Variables** (i sidomenyn)

**Steg 4**: Klicka på knappen **Add New** (eller **Add**)

**Steg 5**: Fyll i formuläret:
- **Key**: `VITE_APPS_SCRIPT_URL`
- **Value**: `https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development (kryssa i alla tre)

**Steg 6**: Klicka på **Save**

**Steg 7**: ⚠️ **VIKTIGT - Redeploya projektet!**
- Gå till **Deployments**-fliken
- Hitta senaste deployment (överst i listan)
- Klicka på de tre prickarna (⋮) bredvid deploymenten
- Välj **Redeploy**
- Bekräfta

**Alternativt**: Pusha en tom commit till GitHub för att trigga automatisk redeploy:
```bash
git commit --allow-empty -m "Trigger redeploy for environment variables"
git push
```

**Verifiera**: Efter redeploy, öppna din Vercel-URL och Developer Console (F12). Du bör se:
```
✅ Apps Script URL configured successfully!
```

---

## Verifiera att Apps Script fungerar

Testa Apps Script direkt i webbläsaren:
```
https://script.google.com/macros/s/AKfycby519iyhursADbzQUTTODBsL90qs1zXdUxSqGe4ifI1ZX8DOzN707ZtQld0_v65EtHKRw/exec?sheet=DashBoard
```

**Förväntat resultat**: Du bör se JSON-data direkt.

**Om du ser inloggningssida eller fel**:
- Gå till [Apps Script](https://script.google.com)
- Välj ditt projekt
- Gå till **Deploy** → **Manage deployments**
- Kontrollera att "Who has access" är satt till **"Anyone"**
- Om inte, redigera deployment och ändra till "Anyone", spara och deploya igen

---

## Felsökning

### Problemet kvarstår efter redeploy?

1. **Hård refresh i webbläsaren**: 
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
   - Eller öppna i Incognito/Private mode

2. **Dubbelkolla environment variable**:
   - Gå tillbaka till Vercel → Settings → Environment Variables
   - Verifiera att `VITE_APPS_SCRIPT_URL` finns
   - Verifiera att värdet är EXAKT samma som ovan (kopiera-klistra in)
   - Verifiera att alla tre environments (Production, Preview, Development) är ikryssade

3. **Kontrollera i Network tab**:
   - Öppna Developer Tools → Network tab
   - Filtrera på "script.google.com"
   - Se om requests görs till Apps Script (✅) eller CSV proxy (❌)

---

## Template fil

En fil som heter `env.template` finns i projektets root som du kan kopiera till `.env.local` för lokal utveckling.
