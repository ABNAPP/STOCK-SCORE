import { TableMetadata } from '../types/columnMetadata';

export const tableMetadata: TableMetadata[] = [
  {
    tableId: 'benjamin-graham',
    columns: [
      {
        columnKey: 'companyName',
        dataSource: 'Dashboard sheet, kolumn "Company Name"',
        conditions: [
          'Filtrera bort rader där Company Name är N/A eller tomt',
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)'
        ]
      },
      {
        columnKey: 'ticker',
        dataSource: 'Dashboard sheet, kolumn "Ticker"',
        conditions: [
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)',
          'Filtrera bort rader där Company Name är N/A'
        ]
      },
      {
        columnKey: 'currency',
        dataSource: 'Manuell inmatning via dropdown',
        conditions: [
          'Användaren väljer valuta från dropdown-lista',
          'Standardvärde är USD',
          'Tillgängliga valutor: USD, EUR, SEK, DKK, NOK, GBP, AUD, CAD, NZD'
        ]
      },
      {
        columnKey: 'entry1',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR1: (Exit1 - Entry1) / Entry1 * 100'
        ]
      },
      {
        columnKey: 'entry2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR2: (Exit2 - Entry2) / Entry2 * 100'
        ]
      },
      {
        columnKey: 'exit1',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR1: (Exit1 - Entry1) / Entry1 * 100'
        ]
      },
      {
        columnKey: 'exit2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR2: (Exit2 - Entry2) / Entry2 * 100'
        ]
      },
      {
        columnKey: 'dateOfUpdate',
        dataSource: 'Automatiskt beräknat',
        conditions: [
          'Uppdateras automatiskt när ENTRY1, ENTRY2, EXIT1 eller EXIT2 ändras',
          'Raderas om alla manuella fält (ENTRY1, ENTRY2, EXIT1, EXIT2) är tomma',
          'Visas i rött om datumet är äldre än idag och det finns värden i fälten',
          'Format: YYYY-MM-DD (endast datum, ingen tid)'
        ]
      },
      {
        columnKey: 'price',
        dataSource: 'Dashboard sheet, kolumn "Price"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'benjaminGraham',
        dataSource: 'Dashboard sheet, kolumn "Benjamin Graham"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Röd färg om värdet är negativt (< 0)',
          'Grön färg om Price är inom +5% av Benjamin Graham-värdet (price <= benjaminGraham * 1.05)',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'ivFcf',
        dataSource: 'Dashboard sheet, kolumn "IV (FCF)"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'irr1',
        dataSource: 'Beräknat från Entry/Exit-värden',
        formula: 'RR1 = (Exit - Entry1) / Entry1 * 100, där Exit = Exit1 om ifyllt annars Exit2',
        conditions: [
          'Beräknas från Entry1 och Exit1, eller Entry1 och Exit2 om Exit1 är tomt',
          'Visa N/A om Entry1 och både Exit1/Exit2 saknas eller är 0',
          'Formateras som procent med %-tecken och noll decimaler',
          'Grön färg om RR1 >= 60% OCH Price <= Entry1 * 1.05',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'rr2',
        dataSource: 'Beräknat från Entry/Exit-värden',
        formula: 'RR2 = (Exit - Entry2) / Entry2 * 100, där Exit = Exit2 om ifyllt annars Exit1',
        conditions: [
          'Beräknas från Entry2 och Exit2, eller Entry2 och Exit1 om Exit2 är tomt',
          'Visa N/A om Entry2 och både Exit1/Exit2 saknas eller är 0',
          'Formateras som procent med %-tecken och noll decimaler',
          'Grön färg om RR2 >= 60% OCH Price <= Entry2 * 1.05',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      }
    ]
  },
  {
    tableId: 'pe-industry',
    columns: [
      {
        columnKey: 'industry',
        dataSource: 'Dashboard sheet, kolumn "INDUSTRY"',
        conditions: [
          'Filtrera bort rader där Industry är N/A eller tomt',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Gruppera rader per Industry'
        ]
      },
      {
        columnKey: 'pe',
        dataSource: 'Dashboard sheet, kolumn "P/E"',
        formula: 'Median(P/E per industry)',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E-värden per industry',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där Industry, Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'pe1',
        dataSource: 'Dashboard sheet, kolumn "P/E1"',
        formula: 'Median(P/E1 per industry)',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E1-värden per industry',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där Industry, Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'pe2',
        dataSource: 'Dashboard sheet, kolumn "P/E2"',
        formula: 'Median(P/E2 per industry)',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E2-värden per industry',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där Industry, Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'companyCount',
        dataSource: 'Beräknat från Dashboard sheet',
        formula: 'Count(företag per industry)',
        conditions: [
          'Räkna antal företag per industry',
          'Endast räkna företag där Industry, Company Name och Ticker är giltiga (inte N/A)'
        ]
      }
    ]
  },
  {
    tableId: 'score',
    columns: [
      {
        columnKey: 'antal',
        dataSource: 'Beräknat (radnummer i tabellen)',
        conditions: [
          'Automatiskt genererat radnummer',
          'Visas endast för identifiering av position i listan'
        ]
      },
      {
        columnKey: 'companyName',
        dataSource: 'Dashboard sheet, kolumn "Company Name"',
        conditions: [
          'Filtrera bort rader där Company Name är N/A eller tomt',
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)'
        ]
      },
      {
        columnKey: 'ticker',
        dataSource: 'Dashboard sheet, kolumn "Ticker"',
        conditions: [
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)',
          'Filtrera bort rader där Company Name är N/A'
        ]
      },
      {
        columnKey: 'currency',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Standardvärde är USD om currency saknas',
          'Tillgängliga valutor: USD, EUR, SEK, DKK, NOK, GBP, AUD, CAD, NZD',
          'Currency kan endast redigeras i Entry/Exit-tabellen'
        ]
      },
      {
        columnKey: 'price',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Price kan endast redigeras i Entry/Exit-tabellen'
        ]
      },
      {
        columnKey: 'entry1',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'Entry1 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR1: (Exit1 - Entry1) / Entry1 * 100',
          'Grön färg om Price ≤ Entry1 × 1,05 (inkl. alla pris under entry)'
        ]
      },
      {
        columnKey: 'entry2',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'Entry2 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR2: (Exit2 - Entry2) / Entry2 * 100',
          'Grön färg om Price ≤ Entry2 × 1,05 (inkl. alla pris under entry)'
        ]
      },
      {
        columnKey: 'exit1',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'Exit1 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR1: (Exit1 - Entry1) / Entry1 * 100',
          'Röd färg om Price ≥ Exit1 × 0,95 (inkl. alla pris över exit)'
        ]
      },
      {
        columnKey: 'exit2',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'Exit2 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR2: (Exit2 - Entry2) / Entry2 * 100',
          'Röd färg om Price ≥ Exit2 × 0,95 (inkl. alla pris över exit)'
        ]
      },
      {
        columnKey: 'score',
        dataSource: 'Beräknat från Score Board data med viktat poängsystem. SMA-data från tabellen SMA.',
        formula: 'Summa av (vikt × färgfaktor) för alla metrics, där färgfaktor = 1.0 (grön), 0.7 (blå), 0.0 (röd/tom/N/A). Total max 100p.',
        conditions: [
          'Poängsystem från 0-100 (total max 100p)',
          'Beräknas baserat på färgkodning i SCORE BOARD',
          'Fundamental metrics (55p totalt):',
          '  - VALUE CREATION (7.5), Munger Quality Score (7), IRR (4.5), Ro40 F1/F2 (4.5 vardera)',
          '  - LEVERAGE F2, Cash/SDebt, Current Ratio, P/E1 INDUSTRY, P/E2 INDUSTRY, (TB/S)/Price (4.5 vardera)',
          'Technical metrics (45p totalt):',
          '  - TheoEntry (40), SMA(9) (0.5), SMA(21) (2.5), SMA(55) (1), SMA(200) (1)',
          'Färgmarkering:',
          '  - GRÖN om score >= 70',
          '  - BLÅ om score >= 45',
          '  - GRÅ om score < 45',
          'Hovra över score-värde för detaljerad breakdown'
        ]
      }
    ]
  },
  {
    tableId: 'score-board',
    columns: [
      {
        columnKey: 'companyName',
        dataSource: 'Dashboard sheet, kolumn "Company Name"',
        conditions: [
          'Filtrera bort rader där Company Name är N/A eller tomt',
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)'
        ]
      },
      {
        columnKey: 'ticker',
        dataSource: 'Dashboard sheet, kolumn "Ticker"',
        conditions: [
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)',
          'Filtrera bort rader där Company Name är N/A'
        ]
      },
      {
        columnKey: 'irr',
        dataSource: 'Dashboard sheet, kolumn "IRR"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0%"',
          'Formateras som procent med %-tecken och noll decimaler',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - GRÖN om IRR >= IRR threshold (från Industry Threshold baserat på industry)',
          '  - RÖD om IRR < IRR threshold (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'mungerQualityScore',
        dataSource: 'Dashboard sheet, kolumn "Munger Quality Score"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Röd färg om värdet är mindre än 40',
          'Blå färg om värdet är mellan 40 och 60',
          'Grön färg om värdet är över 60',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'valueCreation',
        dataSource: 'Dashboard sheet, kolumn "VALUE CREATION"',
        formula: 'Value Creation är genomsnitt för senaste 5 årets ROC - WACC',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.00%"',
          'Formateras som procent med %-tecken och två decimaler',
          'Röd färg om värdet är mindre än 0',
          'Grön färg om värdet är >= 0',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'tbSPrice',
        dataSource: 'Dashboard sheet, kolumn "(TB/S)/Price"',
        formula: 'Hämtas direkt från kolumnen (TB/S)/Price',
        conditions: [
          'Hämtas direkt från kolumnen "(TB/S)/Price" i Dashboard sheet',
          'Visa N/A om värdet är null',
          'Formateras med två decimaler',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering:',
          '  - RÖD om (TB/S)/Price < 1.00',
          '  - GRÖN om (TB/S)/Price ≥ 1.00',
          '  - Ingen färg om värdet är null eller ogiltigt'
        ]
      },
      {
        columnKey: 'ro40F1',
        dataSource: 'Dashboard sheet, kolumn "Ro40 F1"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - RÖD om Ro40-värdet ≤ RO40 MIN (från Industry Threshold baserat på industry)',
          '  - GRÖN om Ro40-värdet ≥ RO40 MAX (från Industry Threshold baserat på industry)',
          '  - BLÅ om RO40 MIN < Ro40-värdet < RO40 MAX (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A',
          'Konverterar procent till decimal för jämförelse (t.ex. 25.0% → 0.25)'
        ]
      },
      {
        columnKey: 'ro40F2',
        dataSource: 'Dashboard sheet, kolumn "Ro40 F2"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - RÖD om Ro40-värdet ≤ RO40 MIN (från Industry Threshold baserat på industry)',
          '  - GRÖN om Ro40-värdet ≥ RO40 MAX (från Industry Threshold baserat på industry)',
          '  - BLÅ om RO40 MIN < Ro40-värdet < RO40 MAX (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A',
          'Konverterar procent till decimal för jämförelse (t.ex. 25.0% → 0.25)'
        ]
      },
      {
        columnKey: 'currentRatio',
        dataSource: 'Dashboard sheet, kolumn "Current Ratio"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.00"',
          'Formateras med två decimaler',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - RÖD om Current Ratio < Current Ratio MIN (från Industry Threshold baserat på industry)',
          '  - GRÖN om Current Ratio MIN ≤ Current Ratio < Current Ratio MAX (från Industry Threshold baserat på industry)',
          '  - BLÅ om Current Ratio ≥ Current Ratio MAX (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'cashSdebt',
        dataSource: 'Dashboard sheet, kolumn "Cash/SDebt"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.00"',
          'Formateras med två decimaler',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - GRÖN om division-by-zero (#DIV/0!)',
          '  - RÖD om Cash/SDebt ≤ Cash/SDebt MIN (från Industry Threshold baserat på industry)',
          '  - GRÖN om Cash/SDebt ≥ Cash/SDebt MAX (från Industry Threshold baserat på industry)',
          '  - BLÅ om Cash/SDebt MIN < Cash/SDebt < Cash/SDebt MAX (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'leverageF2',
        dataSource: 'Dashboard sheet, kolumn "Leverage F2"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Industry Threshold:',
          '  - GRÖN om Leverage F2 ≤ Leverage F2 MIN (från Industry Threshold baserat på industry)',
          '  - BLÅ om Leverage F2 MIN < Leverage F2 ≤ Leverage F2 MAX (från Industry Threshold baserat på industry)',
          '  - RÖD om Leverage F2 > Leverage F2 MAX (från Industry Threshold baserat på industry)',
          '  - Ingen färg om industry inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'pe1Industry',
        dataSource: 'Dashboard sheet, kolumn "P/E1" jämfört med P/E INDUSTRY tabell, kolumn "P/E1 INDUSTRY" (median)',
        conditions: [
          'Beräknar procentuell skillnad: (P/E1 från Dashboard - P/E1 INDUSTRY från P/E INDUSTRY) / P/E1 INDUSTRY från P/E INDUSTRY * 100',
          'Visa N/A om värdet är null eller om industry inte hittas i P/E INDUSTRY tabellen',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Matchar industry från Dashboard med industry i P/E INDUSTRY tabellen (case-insensitive)',
          'Röd färg om procenttalet > 0, grön färg om procenttalet <= 0'
        ]
      },
      {
        columnKey: 'pe2Industry',
        dataSource: 'Dashboard sheet, kolumn "P/E2" jämfört med P/E INDUSTRY tabell, kolumn "P/E2 INDUSTRY" (median)',
        conditions: [
          'Beräknar procentuell skillnad: (P/E2 från Dashboard - P/E2 INDUSTRY från P/E INDUSTRY) / P/E2 INDUSTRY från P/E INDUSTRY * 100',
          'Visa N/A om värdet är null eller om industry inte hittas i P/E INDUSTRY tabellen',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Matchar industry från Dashboard med industry i P/E INDUSTRY tabellen (case-insensitive)',
          'Röd färg om procenttalet > 0, grön färg om procenttalet <= 0'
        ]
      }
    ]
  },
  {
    tableId: 'industry-threshold',
    columns: [
      {
        columnKey: 'industry',
        dataSource: 'Dashboard sheet, kolumn "INDUSTRY"',
        conditions: [
          'Hämtar alla unika industries från Dashboard',
          'Filtrera bort rader där Industry är N/A, tomt eller ogiltigt',
          'Varje industry visas endast en gång (inga dubbletter)',
          'Sorteras alfabetiskt'
        ]
      },
      {
        columnKey: 'irr',
        dataSource: 'Dashboard sheet, kolumn "IRR"',
        conditions: [
          'Kan redigeras manuellt',
          'Används som threshold för färgmarkering av IRR-kolumnen i SCORE BOARD',
          'Matchning sker baserat på industry (case-insensitive)'
        ]
      },
      {
        columnKey: 'leverageF2Min',
        dataSource: 'Auto-fylld baserat på industry mapping (Green_Max värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'leverageF2Max',
        dataSource: 'Auto-fylld baserat på industry mapping (Red_Min värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'ro40Min',
        dataSource: 'Auto-fylld baserat på industry mapping (Min värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'ro40Max',
        dataSource: 'Auto-fylld baserat på industry mapping (Max värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'cashSdebtMin',
        dataSource: 'Auto-fylld baserat på industry mapping (Min värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'cashSdebtMax',
        dataSource: 'Auto-fylld baserat på industry mapping (Max värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'currentRatioMin',
        dataSource: 'Auto-fylld baserat på industry mapping (Min värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'currentRatioMax',
        dataSource: 'Auto-fylld baserat på industry mapping (Max värde)',
        conditions: [
          'Auto-fylld baserat på industry namn',
          'Kan redigeras manuellt',
          'Visa 0 om industry inte hittas i mappningen'
        ]
      }
    ]
  },
  {
    tableId: 'sma-100',
    columns: [
      {
        columnKey: 'companyName',
        dataSource: 'Dashboard sheet, kolumn "Company Name"',
        conditions: [
          'Filtrera bort rader där Company Name är N/A eller tomt',
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)'
        ]
      },
      {
        columnKey: 'ticker',
        dataSource: 'Dashboard sheet, kolumn "Ticker"',
        conditions: [
          'Filtrera bort rader där Ticker är N/A (Dashboard regel)',
          'Filtrera bort rader där Company Name är N/A'
        ]
      },
      {
        columnKey: 'sma9',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(9)"',
        conditions: [
          'Visa faktiska 0-värden som "0.00"',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'sma21',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(21)"',
        conditions: [
          'Visa faktiska 0-värden som "0.00"',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'sma55',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(55)"',
        conditions: [
          'Visa faktiska 0-värden som "0.00"',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'sma200',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(200)"',
        conditions: [
          'Visa faktiska 0-värden som "0.00"',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      }
    ]
  },
  {
    tableId: 'personal-portfolio',
    columns: [
      {
        columnKey: 'rowNumber',
        dataSource: 'Radnummer i tabellen',
        conditions: [
          'Visar radnummer (1, 2, 3, …) för identifiering',
          'Klicka på pilen för att expandera och se fördelning per broker'
        ]
      },
      {
        columnKey: 'currency',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Standardvärde är USD om currency saknas',
          'Currency kan endast redigeras i Entry/Exit-tabellen'
        ]
      }
    ]
  }
];

export function getTableMetadata(tableId: string): TableMetadata | undefined {
  return tableMetadata.find(meta => meta.tableId === tableId);
}

export function getColumnMetadata(tableId: string, columnKey: string) {
  const table = getTableMetadata(tableId);
  return table?.columns.find(col => col.columnKey === columnKey);
}

