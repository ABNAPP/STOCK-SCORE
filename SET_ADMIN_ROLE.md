# Guide: Sätt Admin-roll på första användaren

Denna guide visar hur du sätter admin-rollen på din användare (babayan.ali@gmail.com) så att du kan börja använda admin-funktionerna.

## Förutsättningar

- ✅ Firebase CLI installerat (`npm install -g firebase-tools`)
- ✅ Du har ditt användar-UID: `ih1PUMO6WhXxm13ZGLKlfC9gZ1h2`

## Steg 1: Logga in i Firebase (valfritt)

Om du inte redan är inloggad i Firebase CLI:

```bash
firebase login
```

Detta öppnar en webbläsare där du loggar in med ditt Google-konto (samma konto som du använder för Firebase Console).

**OBS:** Detta är valfritt för denna guide - du behöver inte vara inloggad i CLI eftersom vi använder Service Account key istället.

## Steg 2: Hämta Service Account Key

1. Gå till Firebase Console: https://console.firebase.google.com
2. Välj ditt projekt (stock-score-df698)
3. Gå till Project Settings (kugghjulsikonen) → Service Accounts-fliken
4. Klicka på "Generate new private key"
5. Klicka på "Generate key" i dialogrutan
6. En JSON-fil laddas ner (t.ex. `stock-score-df698-firebase-adminsdk-xxxxx.json`)
7. **VIKTIGT:** Döp om denna fil till `serviceAccountKey.json`
8. Flytta `serviceAccountKey.json` till mappen `temp-set-admin` i projektets root

## Steg 3: Installera paket

Öppna terminal/kommandotolken i projektets root och kör:

```bash
cd temp-set-admin
npm install
```

Detta installerar Firebase Admin SDK som behövs för att sätta custom claims.

## Steg 4: Kör scriptet

När paketen är installerade, kör:

```bash
node setAdminRole.js
```

ELLER:

```bash
npm start
```

Om allt går bra ska du se:
```
✅ Admin-roll satt framgångsrikt!
User ID: ih1PUMO6WhXxm13ZGLKlfC9gZ1h2
Email: babayan.ali@gmail.com

📝 Nästa steg:
1. Logga ut från appen
2. Logga in igen
3. Du ska nu se admin-panel knappen i headern
```

## Steg 5: Logga ut och in igen i appen

1. Logga ut från appen (klicka på logout-knappen i headern)
2. Logga in igen med din email: babayan.ali@gmail.com
3. Admin-rollen ska nu vara aktiv
4. Du ska se "Admin-panel" knappen i headern (lila knapp)

## Steg 6: Städa upp (viktigt för säkerhet!)

När du är klar och har bekräftat att admin-rollen fungerar, ta bort den tillfälliga mappen:

**På Windows (PowerShell):**
```bash
cd ..
Remove-Item -Recurse -Force temp-set-admin
```

**På Windows (Command Prompt):**
```bash
cd ..
rmdir /s /q temp-set-admin
```

**På Mac/Linux:**
```bash
cd ..
rm -rf temp-set-admin
```

**OBS:** Service Account Key är känslig - se till att den inte commitas till git! (Den är redan i `.gitignore`)

## Felsökning

### Fel: "Cannot find module './serviceAccountKey.json'"
- Kontrollera att `serviceAccountKey.json` finns i `temp-set-admin`-mappen
- Kontrollera att filen heter exakt `serviceAccountKey.json` (case-sensitive)

### Fel: "Permission denied" eller "403 Forbidden"
- Kontrollera att Service Account Key är korrekt
- Kontrollera att du hämtade nyckeln från rätt Firebase-projekt

### Fel: "User not found"
- Kontrollera att User ID (`ih1PUMO6WhXxm13ZGLKlfC9gZ1h2`) är korrekt
- Du hittar User ID i Firebase Console → Authentication → Users → Klicka på din användare → Kopiera User UID

### Rollen visas fortfarande inte efter inloggning:
1. Logga ut och in igen (token behöver refresha)
2. Vänta några sekunder
3. Kontrollera i Firebase Console → Authentication → Users → Din användare → Custom claims ska visa `{"role": "admin"}`

### Efter att rollen är satt:
- Du ska INTE längre se "Waiting for Approval"-meddelandet
- Du ska se "Admin-panel" knappen i headern (lila knapp, endast för admin)
- Du ska kunna öppna Admin-panel och godkänna/neka registreringar
