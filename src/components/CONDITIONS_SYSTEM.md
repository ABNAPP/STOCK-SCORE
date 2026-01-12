# Conditions System - Dokumentation

## Översikt

Conditions-systemet är en dokumentations- och informationskomponent som ger användare detaljerad information om hur data i Stock Score-applikationen är strukturerad, beräknad och formaterad. Systemet består av metadata som beskriver datakällor, formler och villkor för varje kolumn i varje tabell.

## Systemarkitektur

### 1. Datastruktur

Systemet bygger på en hierarkisk datastruktur definierad i TypeScript:

```typescript
// types/columnMetadata.ts
export interface ColumnMetadata {
  columnKey: string;           // Unik identifierare för kolumnen
  dataSource: string;          // Varifrån data kommer
  formula?: string;           // Beräkningsformel (valfritt)
  conditions?: string[];      // Lista över villkor och regler
  description?: string;       // Ytterligare beskrivning (valfritt)
}

export interface TableMetadata {
  tableId: string;            // Unik identifierare för tabellen
  columns: ColumnMetadata[];   // Lista över kolumnmetadata
}
```

### 2. Metadata-konfiguration

All metadata definieras centralt i `src/config/tableMetadata.ts`. Denna fil innehåller metadata för alla tabeller i systemet:

- **score** - Huvudpoängtabellen
- **score-board** - Detaljerad poängtabell med alla metrics
- **benjamin-graham** - Benjamin Graham-värderingar
- **pe-industry** - P/E-industri-medianer
- **threshold-industry** - Tröskelvärden per industri
- **entry-exit-entry1** - Manuella entry/exit-värden
- **sma-100** - SMA-tekniska indikatorer

Varje tabell har en `tableId` som används för att hämta rätt metadata.

### 3. Komponenter

#### ConditionsModal (`src/components/ConditionsModal.tsx`)

En modal-dialog som visar fullständig information om alla kolumner i en tabell.

**Funktioner:**
- Visar modal med scrollbar för långa listor
- Visar för varje kolumn:
  - Datakälla (dataSource)
  - Formel (formula) - om den finns
  - Villkor (conditions) - lista över alla villkor
- Stängs med Escape-tangent eller stäng-knapp
- Responsiv design med dark mode-stöd
- Animeringar och hover-effekter

**Props:**
```typescript
interface ConditionsModalProps {
  isOpen: boolean;              // Om modalen är öppen
  onClose: () => void;         // Callback för att stänga
  metadata: TableMetadata | null; // Metadata för tabellen
  pageName: string;            // Namn på sidan/tabellen
}
```

#### ConditionsSidebar (`src/components/ConditionsSidebar.tsx`)

En kollapsbar sidebar-komponent i huvudnavigeringen som ger snabb åtkomst till conditions för olika vyer.

**Funktioner:**
- Expandable/collapsible meny
- Listar alla tillgängliga vyer med metadata
- Visar endast vyer som har metadata definierade
- Inaktiverar länkar för vyer utan metadata
- Mappar ViewId till tableId för att hitta rätt metadata

**Props:**
```typescript
interface ConditionsSidebarProps {
  onOpenModal: (viewId: ViewId) => void; // Callback när användare klickar
}
```

**ViewId till TableId-mappning:**
```typescript
'score' → 'score'
'score-board' → 'score-board'
'entry-exit-benjamin-graham' → 'benjamin-graham'
'fundamental-pe-industry' → 'pe-industry'
'entry-exit-entry1' → 'entry-exit-entry1'
'threshold-industry' → 'threshold-industry'
```

#### ColumnTooltip (`src/components/ColumnTooltip.tsx`)

En tooltip-komponent som visas när användaren hovrar över kolumnnamn i tabellerna.

**Funktioner:**
- Visar snabb information om en specifik kolumn
- Visar datakälla, formel och villkor
- Automatisk positionering (undviker viewport-kanter)
- Visas ovanför eller under beroende på plats
- Stängs automatiskt när musen lämnar

**Props:**
```typescript
interface ColumnTooltipProps {
  metadata: ColumnMetadata;    // Metadata för kolumnen
  children: React.ReactNode;   // Element som triggar tooltip
}
```

### 4. Integration i Applikationen

#### App.tsx Integration

Huvudapplikationen hanterar state för conditions-modal:

```typescript
const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
const [selectedViewForModal, setSelectedViewForModal] = useState<ViewId | null>(null);

const handleOpenConditionsModal = (viewId: ViewId) => {
  setSelectedViewForModal(viewId);
  setConditionsModalOpen(true);
};

const handleCloseConditionsModal = () => {
  setConditionsModalOpen(false);
  setSelectedViewForModal(null);
};
```

Metadata hämtas baserat på vald vy:
```typescript
const metadata = selectedViewForModal 
  ? getTableMetadata(getTableId(selectedViewForModal))
  : null;
```

#### Sidebar Integration

Sidebar-komponenten inkluderar ConditionsSidebar:
```tsx
<ConditionsSidebar onOpenModal={handleOpenConditionsModal} />
```

## Dataflöde

1. **Användare klickar på "Villkor" i sidebar**
   - ConditionsSidebar visar expanderad meny
   - Användare väljer en vy (t.ex. "SCORE BOARD")

2. **ConditionsSidebar anropar callback**
   - `onOpenModal(viewId)` anropas med vald ViewId

3. **App.tsx hanterar öppning**
   - `handleOpenConditionsModal(viewId)` sätter state
   - ViewId mappas till tableId
   - Metadata hämtas från `tableMetadata.ts`

4. **ConditionsModal renderas**
   - Tar emot metadata som prop
   - Visar alla kolumner med deras information
   - Användare kan scrolla och läsa information

5. **Användare stänger modal**
   - Klickar på stäng-knapp eller Escape
   - `handleCloseConditionsModal()` rensar state

## Användningsfall

### 1. För användare
- **Förstå datakällor**: Se varifrån data kommer (Google Sheets, beräkningar, etc.)
- **Förstå formler**: Se hur värden beräknas
- **Förstå villkor**: Se filtreringsregler, färgkodning, formatering

### 2. För utvecklare
- **Dokumentation**: Metadata fungerar som levande dokumentation
- **Underhåll**: Centraliserad plats för att uppdatera beskrivningar
- **Kvalitetssäkring**: Tydlig dokumentation av affärslogik

## Exempel på Conditions

### Enkel kolumn (companyName)
```typescript
{
  columnKey: 'companyName',
  dataSource: 'Dashboard sheet, kolumn "Company Name"',
  conditions: [
    'Filtrera bort rader där Company Name är N/A eller tomt',
    'Filtrera bort rader där Ticker är N/A (Dashboard regel)'
  ]
}
```

### Kolumn med formel (pe)
```typescript
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
}
```

### Komplex kolumn med färgkodning (score)
```typescript
{
  columnKey: 'score',
  dataSource: 'Beräknat från Score Board data med viktat poängsystem',
  formula: 'Summa av (vikt × färgfaktor) för alla metrics, där färgfaktor = 1.0 (grön), 0.7 (blå), 0.0 (röd/tom/N/A)',
  conditions: [
    'Poängsystem från 0-100',
    'Beräknas baserat på färgkodning i SCORE BOARD',
    'Fundamental metrics (50p totalt): ...',
    'Technical metrics (50p totalt): ...',
    'Färgmarkering: GRÖN om score >= 75, BLÅ om score >= 45, GRÅ om score < 45'
  ]
}
```

## Internationell stöd (i18n)

Systemet stödjer flerspråkighet via react-i18next:

**Översättningsnycklar:**
- `navigation.condition` - "Villkor" (meny)
- `conditions.dataSource` - "Datakälla"
- `conditions.formula` - "Formel"
- `conditions.conditions` - "Villkor"
- `conditions.close` - "Stäng"

Översättningar finns i:
- `src/locales/sv/translation.json` (Svenska)
- `src/locales/en/translation.json` (Engelska)

## Utveckling och underhåll

### Lägga till ny metadata

1. **Öppna `src/config/tableMetadata.ts`**
2. **Hitta eller skapa TableMetadata-objekt för din tabell**
3. **Lägg till ColumnMetadata för varje kolumn:**

```typescript
{
  tableId: 'min-tabell',
  columns: [
    {
      columnKey: 'minKolumn',
      dataSource: 'Beskrivning av datakälla',
      formula: 'Formel om det finns en', // Valfritt
      conditions: [
        'Villkor 1',
        'Villkor 2',
        // ... fler villkor
      ]
    }
  ]
}
```

4. **Lägg till ViewId → TableId-mappning i ConditionsSidebar.tsx** (om det är en ny vy)

### Uppdatera befintlig metadata

1. **Hitta rätt TableMetadata i `tableMetadata.ts`**
2. **Hitta rätt ColumnMetadata**
3. **Uppdatera dataSource, formula eller conditions**
4. **Ändringarna syns direkt i ConditionsModal**

### Best Practices

1. **Var specifik**: Beskriv exakt var data kommer ifrån
2. **Var tydlig**: Använd enkelt språk i conditions
3. **Var komplett**: Lista alla villkor, även de som verkar självklara
4. **Var konsekvent**: Använd samma terminologi genomgående
5. **Uppdatera regelbundet**: Håll metadata synkroniserad med kod

## Tekniska detaljer

### Prestanda
- Metadata laddas inte dynamiskt, utan är statisk data
- Inga API-anrop behövs för att visa conditions
- Modal renderas endast när den är öppen

### Tillgänglighet
- Keyboard-navigation (Escape för att stänga)
- ARIA-labels och semantisk HTML
- Touch-friendly knappar (min-h-[44px])
- Fokus-hantering

### Styling
- Tailwind CSS för styling
- Dark mode-stöd via dark: prefix
- Responsiv design (mobile-first)
- Animeringar med CSS transitions

## Framtida förbättringar

Potentiella förbättringar för systemet:

1. **Sökfunktion**: Sök i conditions för att hitta specifik information
2. **Export**: Exportera metadata som dokumentation
3. **Versionering**: Spåra ändringar i metadata över tid
4. **Validering**: Automatisk validering att metadata matchar faktiska kolumner
5. **Visualisering**: Diagram för komplexa formler
6. **Exempel**: Lägg till exempelvärden i metadata

## Relaterade filer

- `src/components/ConditionsModal.tsx` - Modal-komponent
- `src/components/ConditionsSidebar.tsx` - Sidebar-komponent
- `src/components/ColumnTooltip.tsx` - Tooltip-komponent
- `src/config/tableMetadata.ts` - Metadata-konfiguration
- `src/types/columnMetadata.ts` - TypeScript-typer
- `src/App.tsx` - Huvudapplikation (integration)
- `src/components/Sidebar.tsx` - Huvudsidebar (integration)
- `src/locales/sv/translation.json` - Svenska översättningar
- `src/locales/en/translation.json` - Engelska översättningar
