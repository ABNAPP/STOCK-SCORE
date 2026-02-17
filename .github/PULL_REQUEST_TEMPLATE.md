## Beskrivning
<!-- Vad gör denna PR? -->

## Typ av ändring
- [ ] Bugfix
- [ ] Ny funktion
- [ ] Refaktor (ingen beteendeförändring)
- [ ] Dokumentation / konfiguration

## Berörda områden
<!-- t.ex. Apps Script, Cloud Functions, provider-ordning, caching, tableId-mappning -->

## Tester
<!-- Vilka kommandon körde du? npm run build:check, test, test:e2e, storybook? -->

---

## PR Checklist

### Scope
- [ ] PR gör **en sak** (en feature, en fix eller en refactor – inte blandat)
- [ ] Ändringen är begränsad; stora ändringar är uppdelade i flera PR:ar
- [ ] Ingen orelaterad formatering eller lint-fix i samma PR (gör det i separat PR)

### Tester (kör lokalt innan push)
- [ ] **Typecheck:** `npm run build:check` (tsc + vite build)
- [ ] **Lint:** `npm run lint`
- [ ] **Unit:** `npm run test -- --run` (eller `npm run test:unit`)
- [ ] **Integration:** `npm run test:integration` (om du ändrat providers, dataflöden eller integrationstester)
- [ ] **E2E (vid UI/flow-ändringar):** `npm run test:e2e` (Playwright)
- [ ] **Storybook (vid UI-komponenter):** `npm run storybook` – kontrollera att berörda stories fortfarande fungerar

### Backwards compatibility
- [ ] **Apps Script:** Ändrar du request/response eller parametrar mot Apps Script (e.g. `apps-script/`, `src/services/sheets/`)? Om ja – är det planerat och dokumenterat? Befintliga deploymenter ska inte brytas.
- [ ] **Cloud Functions:** Ändrar du `functions/src/` API eller Firestore-struktur? Om ja – samma krav; inget API-brott mot befintliga klienter om det inte är tydligt planerat.

### Riskpunkter (projektsspecifikt)
- [ ] **Provider-ordning:** Om du ändrar `src/main.tsx` eller test-providers: ordningen ska vara ThemeProvider → ToastProvider → AuthProvider → NotificationProvider → (Rest). Test-wrapper (e.g. `src/test/helpers/renderHelpers.tsx`) ska matcha.
- [ ] **RefreshContext:** Komponenter som använder `useRefresh` kräver RefreshProvider (och korrekt ordning). Ändringar kring refresh/auto-refresh ska verifieras.
- [ ] **Caching / delta-sync:** Ändringar i `src/services/cacheService.ts`, `deltaSyncService.ts`, `firestoreCacheService.ts` eller cache-nycklar kan påverka offline/data-konsistens. Verifiera att befintliga cachar inte blir ogiltiga utan migrering om det behövs.
- [ ] **tableId / viewId-mappning:** Ändringar i `src/config/viewTableMap.ts` eller användning av `getTableId`/viewId påverkar Conditions-modal och metadata. Kontrollera att rätt vy mappar till rätt tabell.

### Release / rollback
- [ ] Jag vet hur jag **reverterar** denna PR vid behov: `git revert <merge-commit-hash>` (revert av merge-commit), sedan push. Ingen force-push på main.
- [ ] Efter revert: verifiera med `npm run build:check && npm run test -- --run` (och vid behov e2e) att allt är grönt.
- [ ] Om ändringen är bakom en **feature flag** eller env-var: dokumentera hur man stänger av den vid rollback.

### Definition of Done
- [ ] **Dokumentation:** README, SETUP_APPS_SCRIPT.md, CLOUD_FUNCTIONS_SETUP.md, APPS_SCRIPT_SETUP.md eller TESTING_GUIDE.md uppdaterade om setup/konfiguration/test påverkas.
- [ ] **Storybook:** Om en UI-komponent ändras – relevant story uppdaterad eller tillagd och kontrollerad.
- [ ] **Inga flaky tests:** Om nya eller ändrade tester flakar – de ska fixas i denna PR (eller tas bort/ändras så att de inte blockar CI).
