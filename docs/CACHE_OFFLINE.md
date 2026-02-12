# Cache & Offline — Verification (Steg A)

After turning off Service Worker caching for API data and removing the localStorage data cache, **Firestore `appCache` is the only source of truth for shared data**. No cached API/snapshot data is stored in localStorage; offline/stale behaviour is driven by Firestore (and optional Firestore offline persistence), not by localStorage or SW data cache.

The Service Worker precaches the app shell (`/`, `/index.html`) so the app can start offline; API requests remain pass-through and are never cached by the SW.

## Manual verification checklist

- [ ] **Online — ScoreBoard load**  
  Load ScoreBoard; data is fetched. No SW cache is used for API (requests go through SW as pass-through only).

- [ ] **Refresh Now (admin)**  
  As admin, run Refresh Now. Firestore `appCache` is updated; UI shows the new data.

- [ ] **Offline**  
  Turn off network (e.g. DevTools offline). OfflineIndicator is shown; app behaves correctly with no SW-stale API fallback (fetch fails normally).

## Test suite

Run the full test suite and confirm all tests pass:

```bash
pnpm test
# or
npm test
```
