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
        dataSource: 'Dashboard sheet, kolumn "IRR1"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Formateras som procent med %-tecken och noll decimaler',
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
          'Visa N/A om median är 0 eller inga giltiga värden finns',
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
          'Visa N/A om median är 0 eller inga giltiga värden finns',
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
          'Visa N/A om median är 0 eller inga giltiga värden finns',
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
        columnKey: 'score',
        dataSource: 'Beräknat från Score Board data med viktat poängsystem',
        formula: 'Summa av (vikt × färgfaktor) för alla metrics, där färgfaktor = 1.0 (grön), 0.7 (blå), 0.0 (röd/tom/N/A)',
        conditions: [
          'Poängsystem från 0-100',
          'Beräknas baserat på färgkodning i SCORE BOARD',
          'Fundamental metrics (50p totalt):',
          '  - VALUE CREATION (vikt: 7)',
          '  - Munger Quality Score (vikt: 7)',
          '  - IRR (vikt: 6)',
          '  - Ro40 F1 (vikt: 3)',
          '  - Ro40 F2 (vikt: 3)',
          '  - LEVERAGE F2 (vikt: 4)',
          '  - Cash/SDebt (vikt: 5)',
          '  - Current Ratio (vikt: 3)',
          '  - P/E1 INDUSTRY (vikt: 5)',
          '  - P/E2 INDUSTRY (vikt: 5)',
          '  - (TB/S)/Price (vikt: 2)',
          'Technical metrics (50p totalt):',
          '  - THEOENTRY (vikt: 40)',
          '  - SMA(100) (vikt: 2.5)',
          '  - SMA(200) (vikt: 2.5)',
          '  - SMA CROSS (vikt: 5)',
          'Färgmarkering:',
          '  - GRÖN om score >= 75',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - GRÖN om IRR >= IRR threshold (från Threshold Industry baserat på industry)',
          '  - RÖD om IRR < IRR threshold (från Threshold Industry baserat på industry)',
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
        dataSource: 'Dashboard sheet, kolumn "TB/Share" dividerat med kolumn "Price"',
        formula: '(TB/Share) / Price',
        conditions: [
          'Beräknas genom att dividera TB/Share med Price från Dashboard sheet',
          'Visa N/A om värdet är null eller om Price är 0/null',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - RÖD om Ro40-värdet ≤ RO40 MIN (från Threshold Industry baserat på industry)',
          '  - GRÖN om Ro40-värdet ≥ RO40 MAX (från Threshold Industry baserat på industry)',
          '  - BLÅ om RO40 MIN < Ro40-värdet < RO40 MAX (från Threshold Industry baserat på industry)',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - RÖD om Ro40-värdet ≤ RO40 MIN (från Threshold Industry baserat på industry)',
          '  - GRÖN om Ro40-värdet ≥ RO40 MAX (från Threshold Industry baserat på industry)',
          '  - BLÅ om RO40 MIN < Ro40-värdet < RO40 MAX (från Threshold Industry baserat på industry)',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - RÖD om Current Ratio < Current Ratio MIN (från Threshold Industry baserat på industry)',
          '  - GRÖN om Current Ratio MIN ≤ Current Ratio < Current Ratio MAX (från Threshold Industry baserat på industry)',
          '  - BLÅ om Current Ratio ≥ Current Ratio MAX (från Threshold Industry baserat på industry)',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - GRÖN om division-by-zero (#DIV/0!)',
          '  - RÖD om Cash/SDebt ≤ Cash/SDebt MIN (från Threshold Industry baserat på industry)',
          '  - GRÖN om Cash/SDebt ≥ Cash/SDebt MAX (från Threshold Industry baserat på industry)',
          '  - BLÅ om Cash/SDebt MIN < Cash/SDebt < Cash/SDebt MAX (från Threshold Industry baserat på industry)',
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
          'Färgmarkering baserat på threshold-värden från Threshold Industry:',
          '  - GRÖN om Leverage F2 ≤ Leverage F2 MIN (från Threshold Industry baserat på industry)',
          '  - BLÅ om Leverage F2 MIN < Leverage F2 ≤ Leverage F2 MAX (från Threshold Industry baserat på industry)',
          '  - RÖD om Leverage F2 > Leverage F2 MAX (från Threshold Industry baserat på industry)',
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
      },
      {
        columnKey: 'sma100',
        dataSource: 'SMA tabell (Technical section), kolumn "SMA(100)"',
        conditions: [
          'Hämtas från SMA tabellen i Technical section',
          'Matchas med Score Board data baserat på Ticker (case-insensitive)',
          'Visa N/A om värdet är null eller om ticker inte hittas i SMA tabellen',
          'Visa faktiska 0-värden som "0.00"',
          'Formateras med två decimaler',
          'Färgmarkering baserat på jämförelse med Price från ENTRY/EXIT tabellen:',
          '  - GRÖN om Price > SMA(100)',
          '  - RÖD om Price < SMA(100)',
          '  - GUL om Price == SMA(100)',
          '  - Ingen färg om Price eller SMA(100) saknas'
        ]
      },
      {
        columnKey: 'sma200',
        dataSource: 'SMA tabell (Technical section), kolumn "SMA(200)"',
        conditions: [
          'Hämtas från SMA tabellen i Technical section',
          'Matchas med Score Board data baserat på Ticker (case-insensitive)',
          'Visa N/A om värdet är null eller om ticker inte hittas i SMA tabellen',
          'Visa faktiska 0-värden som "0.00"',
          'Formateras med två decimaler',
          'Färgmarkering baserat på jämförelse med Price från ENTRY/EXIT tabellen:',
          '  - GRÖN om Price > SMA(200)',
          '  - RÖD om Price < SMA(200)',
          '  - GUL om Price == SMA(200)',
          '  - Ingen färg om Price eller SMA(200) saknas'
        ]
      },
      {
        columnKey: 'smaCross',
        dataSource: 'SMA tabell (Technical section), kolumn "SMA Cross"',
        conditions: [
          'Hämtas från SMA tabellen i Technical section',
          'Matchas med Score Board data baserat på Ticker (case-insensitive)',
          'Visa N/A om ticker inte hittas i SMA tabellen',
          'Röd färg om texten innehåller "GOLDEN"',
          'Grön färg om texten innehåller "DEATH"'
        ]
      }
    ]
  },
  {
    tableId: 'threshold-industry',
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
        columnKey: 'sma100',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(100)"',
        conditions: [
          'Visa N/A om värdet är 0',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'sma200',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA(200)"',
        conditions: [
          'Visa N/A om värdet är 0',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'smaCross',
        dataSource: 'SMA sheet (gid=1413104083), kolumn "SMA Cross"',
        conditions: [
          'Kolumnen innehåller text, inte nummer',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Visa tom sträng om värdet är N/A eller tomt'
        ]
      }
    ]
  },
  {
    tableId: 'entry-exit-entry1',
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
          'Date of Update uppdateras automatiskt när värdet ändras'
        ]
      },
      {
        columnKey: 'entry2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras'
        ]
      },
      {
        columnKey: 'exit1',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras'
        ]
      },
      {
        columnKey: 'exit2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras'
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

