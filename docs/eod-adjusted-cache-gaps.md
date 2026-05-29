# Adjusted EOD cache — gaps vs Firestore registry

Auto-generated: **2026-05-19T19:22:28.536Z** (run `node scripts/report-eod-cache-gaps.mjs` after `gcloud auth application-default login`.)

This compares **`symbols/*`** (same inclusion rules as [`eodAdjustedCache.ts`](../functions/src/eodAdjustedCache.ts)) to documents in **`eodAdjustedDaily/{eodSymbol}`**. It does not call EODHD.

---

## A — Not on the warm list (excluded before fetch)

These rows are **never** requested from EODHD.

| symbol_id | company | ticker_raw | Reason |
|-----------|---------|------------|--------|


*(none)*


---

## B — On the warm list but no cache document for their EOD symbol

Eligible docs have schema **1** and non-empty **ticker_raw**. **eodSymbol** is **always** computed from `ticker_raw` with `eodSymbolFromTickerRaw` (same as the nightly warm job) — not from stored `eodhd_symbol`. If multiple registry rows map to the same **eodSymbol**, one shared cache doc covers them all — only rows whose **eodSymbol** still has **no** doc appear here.

| symbol_id | company | eod_symbol | Reason |
|-----------|---------|------------|--------|
| bit_bre | Brembo NV | BRE.MI | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| bit_eni | Eni SpA | ENI.MI | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| otcmkts_cadlf | Cadeler A/S | CADLF.OTCMKTS | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| otcmkts_stohf | Equinor ASA | STOHF.OTCMKTS | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| otcmkts_tseof | Trinseo PLC | TSEOF.OTCMKTS | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_aixa | AIXTRON SE | AIXA.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_alo | Alstom SA | ALO.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_dcc | DCC plc | DCC.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_dfds | DFDS A/S | DFDS.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_elisa | Elisa Oyj | ELISA.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_embrac_b | EMBRACER GROUP AB | EMBRAC-B.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_eolu_b | Eolus AB (publ) | EOLU-B.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_fortum | Fortum Oyj | FORTUM.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_hexa_b | Hexagon AB | HEXA-B.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_hpol_b | HEXPOL AB | HPOL-B.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_inwi | Inwido AB (publ) | INWI.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_jm | JM AB | JM.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_ker | Kering SA | KER.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_mtrs | Munters Group AB | MTRS.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_nesn | Nestle SA | NESN.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_nibe_b | Nibe Industrier AB | NIBE-B.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_nokia | Nokia Oyj | NOKIA.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_orsted | Oersted A/S | ORSTED.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_pact | Proact IT Group AB | PACT.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |
| unknown_rmv | Rightmove Plc | RMV.US | No cache row for this EOD symbol — last warm got zero usable daily bars from EODHD (HTTP/auth error, wrong venue suffix / eodhd_symbol, delisted, or rows dropped because adjusted_close was missing or invalid). |



---

## Totals

| Category | Count |
|----------|-------|
| Excluded (section A) | 0 |
| Eligible but missing cache doc (section B) | 25 |
| `symbols` docs scanned | 201 |
| `eodAdjustedDaily` docs | 172 |
