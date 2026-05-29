# Companies in ISM sector **Mining**

## How “Mining” is determined

ISM ingest uses the DashBoard column **`SECTOR (ISM)`** only (the **Industry** column is **not** used for `sectorIsm`). The app maps that string to a stable id with `ismSectorIdFromName` (see [`src/services/ism/rebalance/sectorSlug.ts`](../src/services/ism/rebalance/sectorSlug.ts)): for example **`Mining`** → **`mining`**.

## Authoritative list (your environment)

The **full** roster lives in your **DashBoard** Google Sheet (and in the app’s cached snapshot). It is **not** stored in this git repository, so this file cannot stay perfectly in sync without manual or scripted updates.

**To list every Mining company from the app or CLI:**

1. Open **Central Data Service** (Management Monitoring → Central Data Service).  
2. Use the **DashBoard** tab.  
3. Filter or sort by **`SECTOR (ISM)`** = `Mining` (exact text may vary by sheet; match what you use on the board).  
4. Copy **Company Name** and **Ticker** (and any other columns you need) into the table below.

Or run (sheet + index basket diagnostics):

```bash
npm run analyze:ism-candidates -- --sector Mining
```

See [ism-sheet-to-sector-index.md](./ism-sheet-to-sector-index.md) for why sheet Mining rows may differ from the ISM constituent basket.

**To refresh from ISM ingest in the UI:** use **Refresh sheet data** on **ISM Posture & Positioning**, then repeat the steps above (or inspect ingest in devtools if you add logging).

---

## Mining companies — roster table *(maintain below)*

| # | Company name | Ticker (DashBoard) | Notes |
|---|--------------|--------------------|--------|
| 1 | Repsol SA | BME:REP | Seen in ISM Mining debug trace (`bme_rep`). |
| 2 | Tidewater Inc | TDW | Seen in ISM Mining debug trace (`unknown_tdw`). |
| 3 | Nabors Industries Ltd | NBR | Seen in ISM Mining debug trace (`unknown_nbr`). |
| 4 | Equinor ASA | OTCMKTS:STOHF | Seen in ISM Mining debug trace (`otcmkts_stohf`). |
| 5 | Newmont Corporation | NYSE:NEM | Seen in ISM Mining debug trace (`nyse_nem`). |
| 6 | *(add from sheet)* | | |
| 7 | *(add from sheet)* | | |
| 8 | *(add from sheet)* | | |
| 9 | *(add from sheet)* | | |
| 10 | *(add from sheet)* | | |
| 11 | *(add from sheet)* | | |
| 12 | *(add from sheet)* | | |
| 13 | *(add from sheet)* | | |

> **Note:** One ISM debug run reported **13** DashBoard rows for the Mining sector; only the **five** names above were present in the diagnostic “Mining trace” output captured in chat. Rows 6–13 are placeholders—replace them using your current **Central Data Service** / sheet export so this table matches production.

---

*Document created 2026-05-13. Update the table whenever the DashBoard Mining universe changes.*
