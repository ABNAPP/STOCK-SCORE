# Hemligheter och nycklar

Inga riktiga API-nycklar eller hemligheter får finnas i repo. Använd endast placeholders i `env.template` och docs.

## Så sätter du nycklar lokalt

1. Kopiera `env.template` till `.env.local`:
   ```bash
   cp env.template .env.local
   ```

2. Öppna `.env.local` och ersätt placeholders med dina faktiska värden:
   - `YOUR_SCRIPT_ID` → ditt Apps Script Script ID från deployment (t.ex. från URL:en `https://script.google.com/macros/s/SCRIPT_ID/exec`)
   - `your-eodhd-api-key` etc. → dina API-nycklar för valfria tjänster

3. Filen `.env.local` ignoreras av Git (säkerhet).

4. För produktion (Vercel): sätt environment variables i Vercel Dashboard → Settings → Environment Variables. Redeploya efter ändringar.

Se även `env.template` för full lista av variabler och `APPS_SCRIPT_SETUP.md` för Apps Script-konfiguration.

## Secret scan (verifiera att inget läcker)

Kör följande innan push för att kontrollera att inga riktiga nycklar finns i repo:

```bash
rg -n "AIza[A-Za-z0-9_-]{35}" --glob '!node_modules' --glob '!dist' --glob '!.git'
rg -n "AKfycby[A-Za-z0-9_-]{40,}" --glob '!node_modules' --glob '!dist' --glob '!.git'
rg -n "6926d27c|2eff0b3a|d4hblhhr01qgvvc6ur0|6X4S8B5KZZVKKFP4" --glob '!node_modules' --glob '!dist' --glob '!.git' --glob '!docs/SECRETS.md'
```

- Första raden: söker Firebase API-nycklar (AIza...)
- Andra raden: söker Apps Script Script ID (AKfycby...)
- Tredje raden: söker kända läckta valutakurs-API-nycklar

**Förväntat resultat:** Inga träffar. Om det finns träffar → ta bort nycklarna och ersätt med placeholders.

## Rollback vid secrets-ändring

Om denna secrets-cleanup måste rullas tillbaka (t.ex. om placeholders orsakar konfigurationsproblem):

1. Identifiera merge-commit: `git log --oneline main`
2. Revert: `git revert -m 1 <merge-commit-hash>`
3. Push: `git push origin main`
4. **OBS:** Efter revert kommer riktiga nycklar tillbaka i historiken. Rotera alla exponerade nycklar omedelbart.
