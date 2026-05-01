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
        dataSource: 'Beräknat utifrån THEOENTRY (Entry/Exit + pris). P/E-ingår inte i Score-poängen.',
        formula: '(Erhållna råpoäng ÷ 45) × 100, avrundat till en decimal (0–100). TheoEntry är GreenOnly (full vikt eller 0).',
        conditions: [
          'Poäng 0–100 efter normalisering (45 råvikter för THEOENTRY)',
          'P/E SECTOR-analys visas i dedikerad P/E-flik; ingår inte i Score.',
          'OBS: Övrigt rådata (t.ex. SMA, fundamentalkolumner på Score Board) ingår inte i Score-poängen.',
          'Färgmarkering för score-kolumn:',
          '  - GRÖN om score >= 70',
          '  - BLÅ om 50 ≤ score < 70',
          '  - Annars neutral textsättning för score < 50',
          'Expandera rad för detaljerad breakdown'
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

