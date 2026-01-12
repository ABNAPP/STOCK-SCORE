# Stock Score

En React-webbapplikation som hämtar stock score-data från Google Sheets och visar en dashboard med kategoriserade aktier baserat på score-trösklar.

**Repository:** [https://github.com/ABNAPP/STOCK-SCORE](https://github.com/ABNAPP/STOCK-SCORE)

## Funktioner

- 📊 Hämtar data från Google Sheets automatiskt
- 🎯 Kategorisering av aktier baserat på score-trösklar
- 📈 Marknadsöversikt med visuell representation
- ⚙️ Anpassningsbara inställningar (trösklar, auto-uppdatering)
- 🔔 Browser notifications support
- 🎨 Modern, responsiv design med Tailwind CSS

## Installation

```bash
npm install
```

## Utveckling

```bash
npm run dev
```

## Bygga för produktion

```bash
npm run build
```

## Deployment på Vercel

1. Pusha koden till GitHub
2. Importera projektet i Vercel
3. Vercel kommer automatiskt att detektera Vite-projektet
4. Deploy!

## Konfiguration

### Datahämtning (Primär metod: Google Apps Script API med Delta Sync)

Appen använder **Google Apps Script API** som primär metod för datahämtning, vilket ger **5-10x snabbare prestanda** än CSV-proxy-metoden. CSV-proxy används endast som fallback om Apps Script API inte är konfigurerat.

Appen stödjer nu **Delta Sync** för effektivare datauppdateringar:
- Första gången: Hämtar full snapshot av all data
- Därefter: Hämtar endast ändringar (delta) var 15-30 minuter
- Uppdaterar UI inkrementellt utan full sid-reload

Delta-sync är aktiverat som standard. Se `APPS_SCRIPT_SETUP.md` för detaljerad setup-instruktioner.

#### Aktivera Apps Script API (Rekommenderat)

1. **För lokal utveckling:**
   - Skapa en `.env.local` fil i projektets rotkatalog
   - Lägg till:
     ```
     VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
     VITE_DELTA_SYNC_ENABLED=true
     VITE_DELTA_SYNC_POLL_MINUTES=15
     ```
   - Starta om utvecklingsservern: `npm run dev`

2. **För produktion (Vercel):**
   - Gå till Vercel Dashboard → Ditt Projekt → Settings → Environment Variables
   - Lägg till: `VITE_APPS_SCRIPT_URL` med din Apps Script Web App URL
   - Välj alla miljöer (Production, Preview, Development)
   - Spara och REDEPLOY projektet

#### Fallback till CSV-proxy

Om `VITE_APPS_SCRIPT_URL` inte är konfigurerad, använder appen automatiskt CSV-proxy-metoden som fallback (långsammare men fungerar utan ytterligare konfiguration).

#### Ytterligare konfiguration

För att ändra källan för data, uppdatera `SHEET_ID` och `GID` i `src/services/sheetsService.ts`.

