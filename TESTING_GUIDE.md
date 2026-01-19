# Testguide för Web Workers och Service Worker

## Web Workers - Testning

### Test 1: Verifiera att UI inte blockeras under transformation

**Steg:**
1. Öppna applikationen i webbläsaren
2. Öppna Developer Tools (F12) → Console
3. Ladda data (t.ex. Score Board eller Benjamin Graham)
4. Under transformation, försök interagera med UI:
   - Scrolla på sidan
   - Klicka på länkar/knappar
   - Öppna dropdown-menyer
   - **Förväntat resultat:** UI ska vara responsiv och inte frysa

**Verifiering:**
- UI ska förbli responsiv även med stora datasets (1000+ rader)
- Progress indicators ska fungera korrekt
- Inga långa freezes eller lags

### Test 2: Verifiera Worker fallback

**Steg:**
1. Öppna Developer Tools → Application → Service Workers
2. Stäng av Web Workers (eller använd en webbläsare som inte stöder Workers)
3. Ladda data
4. **Förväntat resultat:** Appen ska fortfarande fungera, men använda main thread

**Verifiering:**
- I Console ska du se loggar om att Worker inte används
- Data ska fortfarande laddas korrekt (fastare men kan blockera UI)

### Test 3: Testa med stora datasets

**Steg:**
1. Ladda data med många rader (1000+)
2. Öppna Performance tab i Developer Tools
3. Starta recording
4. Ladda data
5. Stoppa recording
6. **Förväntat resultat:** Transformation ska ske i Worker-thread, inte Main thread

**Verifiering:**
- I Performance tab: Se att Worker-thread gör jobbet
- Main thread ska vara ledig för UI-uppdateringar

### Test 4: Verifiera progress callbacks

**Steg:**
1. Ladda data med progress callback (t.ex. Score Board)
2. Observera progress indicators
3. **Förväntat resultat:** Progress ska uppdateras korrekt

**Verifiering:**
- Progress bars/indicators ska uppdateras under transformation
- Meddelanden ska visas korrekt

## Service Worker - Testning

### Test 1: Verifiera Service Worker registrering

**Steg:**
1. Öppna Developer Tools → Application → Service Workers
2. Ladda om sidan
3. **Förväntat resultat:** Service Worker ska vara registrerad (endast i produktion)

**Verifiering:**
- Status ska vara "activated and is running"
- Version ska visas korrekt

### Test 2: Testa bakgrundssynk när fliken blir inaktiv

**Steg:**
1. Öppna Developer Tools → Network tab
2. Ladda data en gång
3. Växla till en annan flik (eller minimera fönstret)
4. Vänta 5-10 sekunder
5. Växla tillbaka
6. **Förväntat resultat:** Service Worker ska ha synkat data i bakgrunden

**Verifiering:**
- I Network tab: Se att API-anrop görs i bakgrunden
- I Console: Se loggar om bakgrundssynk
- Data ska vara uppdaterad när du kommer tillbaka

### Test 3: Testa koordinering med delta sync

**Steg:**
1. Öppna appen i två flikar
2. I första fliken: Vänta tills delta sync körs
3. I andra fliken: Ladda data samtidigt
4. **Förväntat resultat:** Ingen dubbel synk ska ske

**Verifiering:**
- I Network tab: Se att API-anrop inte dupliceras
- I Console: Se koordinerings-loggar

### Test 4: Testa cache-first strategi

**Steg:**
1. Ladda data en gång
2. Öppna Developer Tools → Application → Cache Storage
3. Kontrollera att data är cachad
4. Ladda om sidan
5. **Förväntat resultat:** Cachad data ska användas först

**Verifiering:**
- I Network tab: Se att requests går till cache först
- Svarstider ska vara snabbare för cachad data

### Test 5: Testa offline-scenarier

**Steg:**
1. Öppna Developer Tools → Network tab
2. Aktivera "Offline" mode
3. Försök ladda data
4. **Förväntat resultat:** Cachad data ska visas om tillgänglig

**Verifiering:**
- Appen ska visa cachad data om offline
- Offline indicator ska visas

## Debugging Tips

### Web Workers

**Felsökning:**
- Öppna Developer Tools → Sources → Worker threads
- Sätt breakpoints i worker-filen
- Kontrollera Console för Worker-fel

**Vanliga problem:**
- Worker laddas inte: Kontrollera att filen finns och URL är korrekt
- Transformation misslyckas: Kontrollera att data är JSON-serialiserbar
- Progress callbacks fungerar inte: Kontrollera message format

### Service Worker

**Felsökning:**
- Öppna Developer Tools → Application → Service Workers
- Klicka på "Update" för att ladda om Service Worker
- Använd "Unregister" för att rensa Service Worker
- Kontrollera Console för Service Worker-loggar

**Vanliga problem:**
- Service Worker registreras inte: Kontrollera att filen finns i `public/`
- Bakgrundssynk fungerar inte: Kontrollera att page visibility API fungerar
- Dubbel synk: Kontrollera koordineringslogik i sessionStorage

## Expected Console Logs

### Web Workers
```
[Worker Service] Loading worker...
[Worker Service] Worker loaded successfully
[Worker Service] Transforming data in worker: benjamin-graham
```

### Service Worker
```
[Service Worker] Installing... v1
[Service Worker] Activating... v1
[Service Worker] Background sync requested for: DashBoard
[Service Worker] Background sync completed for: DashBoard
```

### Background Sync Service
```
[Background Sync Service] Page hidden, triggering background sync
[Background Sync Service] Starting background sync for sheet: DashBoard
[Background Sync Service] Background sync completed for sheet: DashBoard
```

## Manuell Testchecklista

- [ ] UI blockeras inte under transformation med stora datasets
- [ ] Progress callbacks fungerar korrekt
- [ ] Worker fallback fungerar när Workers inte stöds
- [ ] Service Worker registreras korrekt (produktion)
- [ ] Bakgrundssynk triggas när flik blir inaktiv
- [ ] Ingen dubbel synk mellan huvudapp och Service Worker
- [ ] Cache-first strategi fungerar för API-requests
- [ ] Offline-scenarier hanteras korrekt
- [ ] Befintliga funktioner (delta sync, cache) fungerar fortfarande
