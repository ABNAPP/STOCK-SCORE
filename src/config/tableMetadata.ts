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
          'Tom som standard tills användaren väljer valuta',
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
          'Används för beräkning av RR T1: (EXIT T1 - ENTRY T1) / ENTRY T1 * 100'
        ]
      },
      {
        columnKey: 'entry2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR T2: (EXIT T2 - ENTRY T2) / ENTRY T2 * 100'
        ]
      },
      {
        columnKey: 'exit1',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR T1: (EXIT T1 - ENTRY T1) / ENTRY T1 * 100'
        ]
      },
      {
        columnKey: 'exit2',
        dataSource: 'Manuell inmatning',
        conditions: [
          'Användaren fyller i värdet manuellt',
          'Värdet är numeriskt',
          'Date of Update uppdateras automatiskt när värdet ändras',
          'Används för beräkning av RR T2: (EXIT T2 - ENTRY T2) / ENTRY T2 * 100'
        ]
      },
      {
        columnKey: 'dateOfUpdate',
        dataSource: 'Automatiskt beräknat',
        conditions: [
          'Uppdateras automatiskt när ENTRY T1, ENTRY T2, EXIT T1 eller EXIT T2 ändras',
          'Raderas om alla manuella fält (ENTRY T1, ENTRY T2, EXIT T1, EXIT T2) är tomma',
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
        columnKey: 'entryF1',
        dataSource: 'Dashboard sheet, kolumn "ENTRY F1"',
        conditions: [
          'Skrivskyddad i appen; hämtas endast från Dashboard',
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
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
        formula: 'RR T1 = (Exit - ENTRY T1) / ENTRY T1 * 100, där Exit = EXIT T1 om ifyllt annars EXIT T2',
        conditions: [
          'Beräknas från ENTRY T1 och EXIT T1, eller ENTRY T1 och EXIT T2 om EXIT T1 är tomt',
          'Visa N/A om ENTRY T1 och både EXIT T1/EXIT T2 saknas eller är 0',
          'Formateras som procent med %-tecken och noll decimaler',
          'Grön färg om RR T1 >= 60% OCH Price <= ENTRY T1 * 1.05',
          'Filtrera bort rader där Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'rr2',
        dataSource: 'Beräknat från Entry/Exit-värden',
        formula: 'RR T2 = (Exit - ENTRY T2) / ENTRY T2 * 100, där Exit = EXIT T2 om ifyllt annars EXIT T1',
        conditions: [
          'Beräknas från ENTRY T2 och EXIT T2, eller ENTRY T2 och EXIT T1 om EXIT T2 är tomt',
          'Visa N/A om ENTRY T2 och både EXIT T1/EXIT T2 saknas eller är 0',
          'Formateras som procent med %-tecken och noll decimaler',
          'Grön färg om RR T2 >= 60% OCH Price <= ENTRY T2 * 1.05',
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
        dataSource: 'Dashboard sheet, kolumn "SECTOR (ISM)"',
        conditions: [
          'Filtrera bort rader där SECTOR (ISM) är N/A eller tomt',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Gruppera rader per sektor (ISM)'
        ]
      },
      {
        columnKey: 'pe',
        dataSource: 'Dashboard sheet, kolumn "P/E"',
        formula: 'Median(P/E per sektor (ISM))',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E-värden per sektor (ISM)',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där SECTOR (ISM), Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'pe1',
        dataSource: 'Dashboard sheet, kolumn "P/E1"',
        formula: 'Median(P/E1 per sektor (ISM))',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E1-värden per sektor (ISM)',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där SECTOR (ISM), Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'pe2',
        dataSource: 'Dashboard sheet, kolumn "P/E2"',
        formula: 'Median(P/E2 per sektor (ISM))',
        conditions: [
          'Filtrera bort N/A och ogiltiga värden',
          'Beräkna median för alla P/E2-värden per sektor (ISM)',
          'Visa N/A om inga giltiga värden finns (0-värden visas som "0.00")',
          'Filtrera bort rader där SECTOR (ISM), Company Name eller Ticker är N/A'
        ]
      },
      {
        columnKey: 'companyCount',
        dataSource: 'Beräknat från Dashboard sheet',
        formula: 'Count(företag per sektor (ISM))',
        conditions: [
          'Räkna antal företag per sektor (ISM)',
          'Endast räkna företag där SECTOR (ISM), Company Name och Ticker är giltiga (inte N/A)'
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
          'Tom (—) om ingen valuta valts i Entry/Exit',
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
          'ENTRY T1 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR T1: (EXIT T1 - ENTRY T1) / ENTRY T1 * 100',
          'Grön färg om Price ≤ ENTRY T1 × 1,05 (inkl. alla pris under entry)'
        ]
      },
      {
        columnKey: 'entry2',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'ENTRY T2 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR T2: (EXIT T2 - ENTRY T2) / ENTRY T2 * 100',
          'Grön färg om Price ≤ ENTRY T2 × 1,05 (inkl. alla pris under entry)'
        ]
      },
      {
        columnKey: 'exit1',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'EXIT T1 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR T1: (EXIT T1 - ENTRY T1) / ENTRY T1 * 100',
          'Röd färg om Price ≥ EXIT T1 × 0,95 (inkl. alla pris över exit)'
        ]
      },
      {
        columnKey: 'exit2',
        dataSource: 'Speglat från Entry/Exit-tabellen',
        conditions: [
          'Skrivskyddad kolumn som endast visar värdet från Entry/Exit-tabellen',
          'Visar numeriskt värde om det finns, annars "-"',
          'EXIT T2 kan endast redigeras i Entry/Exit-tabellen',
          'Används för beräkning av RR T2: (EXIT T2 - ENTRY T2) / ENTRY T2 * 100',
          'Röd färg om Price ≥ EXIT T2 × 0,95 (inkl. alla pris över exit)'
        ]
      },
      {
        columnKey: 'score',
        dataSource: 'Beräknat från Score Board data med viktat poängsystem. SMA-data från tabellen SMA.',
        formula: 'Summa av (vikt × färgfaktor) för alla metrics, där färgfaktor = 1.0 (grön), 0.7 (blå), 0.0 (röd/tom/N/A). Total max 100p.',
        conditions: [
          'Poängsystem från 0-100 (total max 100p)',
          'Beräknas baserat på färgkodning i SCORE BOARD',
          'Fundamental metrics (50p totalt):',
          '  - VALUE CREATION (9), Munger Quality Score (12), LEVERAGE F2 (7), Cash/SDebt (7), Current Ratio (5), P/E1 SECTOR (ISM) (5), P/E2 SECTOR (ISM) (5)',
          'Technical metrics (50p totalt):',
          '  - TheoEntry (45), SMA(9) (2.5), SMA(21) (2.5)',
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
        columnKey: 'currentRatio',
        dataSource: 'Dashboard sheet, kolumn "Current Ratio"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0.00"',
          'Formateras med två decimaler',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Sector (ISM) threshold:',
          '  - RÖD om Current Ratio < Current Ratio MIN (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - GRÖN om Current Ratio MIN ≤ Current Ratio < Current Ratio MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - BLÅ om Current Ratio ≥ Current Ratio MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - Ingen färg om sektor (ISM) inte hittas eller värdet är null/N/A'
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
          'Färgmarkering baserat på threshold-värden från Sector (ISM) threshold:',
          '  - GRÖN om division-by-zero (#DIV/0!)',
          '  - RÖD om Cash/SDebt ≤ Cash/SDebt MIN (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - GRÖN om Cash/SDebt ≥ Cash/SDebt MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - BLÅ om Cash/SDebt MIN < Cash/SDebt < Cash/SDebt MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - Ingen färg om sektor (ISM) inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'leverageF2',
        dataSource: 'Dashboard sheet, kolumn "Leverage F2"',
        conditions: [
          'Visa N/A om värdet är null eller ogiltigt',
          'Visa faktiska 0-värden som "0"',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Färgmarkering baserat på threshold-värden från Sector (ISM) threshold:',
          '  - GRÖN om Leverage F2 ≤ Leverage F2 MIN (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - BLÅ om Leverage F2 MIN < Leverage F2 ≤ Leverage F2 MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - RÖD om Leverage F2 > Leverage F2 MAX (från Sector (ISM) threshold baserat på sektor (ISM))',
          '  - Ingen färg om sektor (ISM) inte hittas eller värdet är null/N/A'
        ]
      },
      {
        columnKey: 'pe1Industry',
        dataSource: 'Dashboard sheet, kolumn "P/E1" jämfört med P/E SECTOR (ISM)-tabell, kolumn "P/E1 SECTOR (ISM)" (median)',
        conditions: [
          'Beräknar procentuell skillnad: (P/E1 från Dashboard - P/E1 SECTOR (ISM) från P/E SECTOR (ISM)-tabellen) / P/E1 SECTOR (ISM) från P/E SECTOR (ISM)-tabellen * 100',
          'Visa N/A om värdet är null eller om sektor (ISM) inte hittas i P/E SECTOR (ISM)-tabellen',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Matchar sektor (ISM) från Dashboard med sektor (ISM) i P/E SECTOR (ISM)-tabellen (case-insensitive)',
          'Röd färg om procenttalet > 0, grön färg om procenttalet <= 0'
        ]
      },
      {
        columnKey: 'pe2Industry',
        dataSource: 'Dashboard sheet, kolumn "P/E2" jämfört med P/E SECTOR (ISM)-tabell, kolumn "P/E2 SECTOR (ISM)" (median)',
        conditions: [
          'Beräknar procentuell skillnad: (P/E2 från Dashboard - P/E2 SECTOR (ISM) från P/E SECTOR (ISM)-tabellen) / P/E2 SECTOR (ISM) från P/E SECTOR (ISM)-tabellen * 100',
          'Visa N/A om värdet är null eller om sektor (ISM) inte hittas i P/E SECTOR (ISM)-tabellen',
          'Visa faktiska 0-värden som "0.0%"',
          'Formateras som procent med %-tecken och en decimal',
          'Filtrera bort rader där Company Name eller Ticker är N/A',
          'Matchar sektor (ISM) från Dashboard med sektor (ISM) i P/E SECTOR (ISM)-tabellen (case-insensitive)',
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
        dataSource: 'Dashboard sheet, kolumn "SECTOR (ISM)"',
        conditions: [
          'Hämtar alla unika sektorer (ISM) från Dashboard',
          'Filtrera bort rader där SECTOR (ISM) är N/A, tomt eller ogiltigt',
          'Varje sektor (ISM) visas endast en gång (inga dubbletter)',
          'Sorteras alfabetiskt'
        ]
      },
      {
        columnKey: 'leverageF2Min',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Green_Max värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'leverageF2Max',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Red_Min värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'cashSdebtMin',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Min värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'cashSdebtMax',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Max värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'currentRatioMin',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Min värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
        ]
      },
      {
        columnKey: 'currentRatioMax',
        dataSource: 'Auto-fylld baserat på sektor (ISM)-mappning (Max värde)',
        conditions: [
          'Auto-fylld baserat på sektor (ISM) namn',
          'Kan redigeras manuellt',
          'Visa 0 om sektor (ISM) inte hittas i mappningen'
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
          'Valutan sätts i Entry/Exit; om den lämnas tom används tickerinferens (SEK för vissa nordiska suffix, annars USD) för omräkning i portföljen',
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

