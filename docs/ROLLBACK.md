# Rollback-arbetsflöde

Minimal process när något går fel efter merge till main.

**Verifiering (lint/test/build/e2e):** Se [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Steg

1. **Identifiera commit**  
   Använd `git log` och välj merge-commit för den PR som introducerade problemet.

2. **Revert**
   ```bash
   git checkout main
   git pull
   git revert -m 1 <merge-commit-hash>
   ```
   (Om det var en vanlig merge; `-m 1` behåller main som parent.)

3. **Push**
   ```bash
   git push origin main
   ```
   Vercel/CI bygger automatiskt.

4. **Verifiera**
   ```bash
   npm run verify
   ```
   (Vid E2E- eller UI-ändringar: `npm run verify:full`.)
   - Manuell smoke-test av berörda flöden
   - Vid ändringar i `src/config/viewTableMap.ts`: kontrollera Conditions-modal, OnboardingHelp och metadata (viewId→tableId).

5. **Dokumentera**  
   Kommentera i original-PR eller i ett kort rollback-dokument vad som reverterades och varför. Öppna ny issue för att åtgärda orsaken och eventuellt återintroducera ändringen på ett säkrare sätt.

## Feature flags

För stora eller riskfyllda features kan en env-var (t.ex. `VITE_FEATURE_XYZ`) användas för att släppa på funktionen. Vid rollback: ta bort eller sätt flaggan till `false` i Vercel (och redeploy) istället för kod-revert.
