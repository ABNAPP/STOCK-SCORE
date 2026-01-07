# Stock Score

En React-webbapplikation som hämtar stock score-data från Google Sheets och visar en dashboard med kategoriserade aktier baserat på score-trösklar.

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

Appen hämtar data från Google Sheets via CSV export. För att ändra källan, uppdatera `SHEET_ID` och `GID` i `src/services/sheetsService.ts`.

