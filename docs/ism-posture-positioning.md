# ISM Posture & Positioning — logic and page behavior

## What the page is

The nav item **ISM Posture & Positioning** maps to the view id `ism-posture-positioning`. The app renders `ISMPostureView`, which wraps an inner view in `EntryExitProvider` so currency can load the same way as on the Score Board (Firestore entry/exit path), without affecting other tabs.

```tsx
// src/components/views/ISMPostureView.tsx
/**
 * ISM tab: own `EntryExitProvider` so currency loads via existing Firestore path without touching other tabs.
 */
export default function ISMPostureView() {
  return (
    <EntryExitProvider>
      <ISMPostureViewInner />
    </EntryExitProvider>
  );
}
```

`App.tsx` switches on `activeView === 'ism-posture-positioning'` and lazy-loads that view.

## Two layers of data

### 1) Ingest / universe (from your dashboard)

`useIsmIngestData` reuses **Score Board** rows and merges them with **currency** from the existing Entry/Exit accessor (`mergeIsmIngestRows`). Each row carries an ISM sector label from the dashboard **`industry`** field (`sectorIsm` in ingest types). That defines **which sectors appear at all**: distinct non-empty `sectorIsm` values are normalized to stable sector ids (`ismSectorIdFromName`) in `buildIsmSectorUniverseFromIngest`.

### 2) Official posture metrics (from Firestore)

For each sector in that universe, `useIsmSectorOverviewData` reads the latest **`sector_index_daily`** document per sector (`fetchLatestSectorIndexDailyDoc` → `parsedToOverviewRow`). Those documents are the **authoritative** daily sector index row: coverage, regime, allowed sizing, breadth, RS vs SPY, SMA trends, rebalance metadata, etc. The client does **not** recompute that motor; it only reads and displays (`readSectorIndexDaily.ts` is explicit: “no motor”).

Daily index **computation** lives in services like `computeDailySectorIndex` (defaults from `ismPostureDefaults.ts`: SMA length, RS MA, breadth threshold, coverage targets, etc.) and is meant to run where you persist to Firestore—not in the React overview hook.

## Overview UI logic (`ISMPostureOverview`)

Rows are **`IsmOverviewSectorRow`** slices of the parsed daily doc (regime, coverage, breadth, flags, rebalance timestamps).

The overview **partitions** sectors into:

- **Strong / weak / transition** — only for rows that have a daily doc and coverage is `limited` or `full` (not `data_building`).
- **“Data building”** — missing daily doc or `coverage_status === 'data_building'`.

Within buckets, sorting favors **weighted breadth** where present. It also computes summary stats (counts per regime, average breadth, last `computed_at`, latest active rebalance date).

Loading states distinguish: no sectors in universe yet, ingest still loading, Firestore loading daily docs, or empty/errors.

## Detail view (`ISMPostureSectorDetail`)

Choosing a sector sets local state in `ISMPostureViewInner` and swaps the main content to **`ISMPostureSectorDetail`**, which loads richer data via `useIsmSectorDetailData` (full parsed daily doc, constituents, diagnostics). It shows header metrics, charts (`IsmSectorDetailChart`), constituent basket table, and an optional **local/custom analysis** path (`IsmSectorDetailLocalContext`) that can diverge from “official” params for exploration, with a reset back to official.

“Data building” UX is when there is no daily doc yet or coverage is still `data_building` (`isDataBuildingUx`).

## Admin-only tools

If the user is admin, the inner view shows **Run ISM debug sync** (`useIsmDebugSync`)—a diagnostic/bootstrap path over ingest and mining, separate from normal browsing.

## Access control

Firestore rules allow authenticated roles that can view **`ism-posture-positioning`** (or score-board / admin as documented) to **read** `sector_index_daily` and related ISM collections; writes are constrained to schema/version and doc id patterns.

## Mental model

The Posture page answers: for each **ISM sector that appears on my Score Board**, what does the **latest official daily sector index** say (regime, coverage, breadth, sizing)? The Score Board defines **which sectors exist** in the grid; Firestore defines **the numbers**. If a sector has no persisted daily doc yet, it lands in the building/missing bucket until the backend pipeline fills `sector_index_daily`.

For **EODHD** as the primary market-data provider, ticker format, and fallback chains, see [`eodhd-tickers-and-providers.md`](./eodhd-tickers-and-providers.md).

## Key files

| Area | Location |
|------|----------|
| View shell + provider | `src/components/views/ISMPostureView.tsx`, `ISMPostureViewInner.tsx` |
| Routing | `src/App.tsx` (`ism-posture-positioning`) |
| Ingest | `src/hooks/useIsmIngestData.ts`, `src/services/ism/mergeIsmIngest.ts` |
| Overview rows | `src/hooks/useIsmSectorOverviewData.ts`, `src/types/ismSectorOverview.ts` |
| Daily doc read/parse | `src/services/ism/dailySector/readSectorIndexDaily.ts` |
| Overview UI | `src/components/ism/ISMPostureOverview.tsx` |
| Detail UI | `src/components/ism/ISMPostureSectorDetail.tsx` |
| Types / defaults | `src/types/ismPosturePositioning.ts`, `src/config/ismPostureDefaults.ts` |
| Daily computation (server-side) | `src/services/ism/dailySector/computeDailySectorIndex.ts` |
| Rules | `firestore.rules` (`sector_index_daily`, `ismFetchEngine`, …) |
