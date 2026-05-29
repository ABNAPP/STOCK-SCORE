# DashBoard tab: column contract and consumers

The live DashBoard tab is read through [`getSheetSnapshot('DashBoard')`](src/services/sheets/sheetSnapshotService.ts). Parsed rows are `Record<string, string | number | undefined>` keyed by **exact header strings** from the sheet ([`DataRow`](src/services/sheets/types.ts)).

Canonical alias lists live in [`src/services/sheets/dashboardSheetContract.ts`](src/services/sheets/dashboardSheetContract.ts). Update that file (and transformers) when the sheet adds or renames columns.

## Logical fields and consumers

| Logical field | Accepted headers (aliases) | Used by |
|---------------|---------------------------|---------|
| Company name | `DASHBOARD_COMPANY_NAME_COLUMNS` | Score Board, Benjamin Graham, P/E sector transform, ISM ingest |
| Ticker | `DASHBOARD_TICKER_COLUMNS` | Same |
| Sector key (Score / P/E) | `DASHBOARD_INDUSTRY_KEY_COLUMNS` (`SECTOR (ISM)`, `Sector (ISM)`, `sector (ism)`, or legacy `Industry` / `INDUSTRY`) | Score Board `industry`, P/E median transform |
| Sector (ISM only) | `DASHBOARD_ISM_SECTOR_COLUMNS` | ISM ingest `sectorIsm` — **does not** fall back to `Industry` |
| Market cap | `DASHBOARD_MARKET_CAP_COLUMNS` | Score Board, ISM ingest |
| Date of update | `DASHBOARD_DATE_OF_UPDATE_COLUMNS` | Score Board, ISM ingest |
| Munger / value / leverage / ratios / valuation block | See `DASHBOARD_*` constants in contract | Score Board only |
| Price | `DASHBOARD_PRICE_COLUMNS` | Score Board, Benjamin Graham |
| P/E, P/E1, P/E2 | `DASHBOARD_PE_COLUMNS`, `PE1`, `PE2` | Score Board row + P/E sector aggregation |
| ENTRY/EXIT / IV / IRR1 | `DASHBOARD_ENTRY_F1_COLUMNS`, etc. | Benjamin Graham |

`DASHBOARD_CONSUMER_FIELDS` in the contract module lists logical groups for tooling and tests.

## Firestore layers (same tab)

1. **Raw snapshot** — `cache:dashboardSnapshot` (or delta entry): `{ headers, rows, version?, generatedAt? }`.
2. **Derived view docs** — `viewData` documents written after transforms (`score-board`, `entry-exit-benjamin-graham`, `fundamental-pe-industry`). ISM ingest reads the raw snapshot path (or cache), not a separate `viewData` doc.

## Entry / exit overlay

Currency and entry/exit numbers for a user come from Firestore `entiryExit`, not the DashBoard fetch ([`EntryExitContext`](src/contexts/EntryExitContext.tsx)). ISM merge joins DashBoard rows with that overlay via `getFieldValue(..., 'currency')`.
