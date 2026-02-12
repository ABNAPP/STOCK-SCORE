# Security

## Data Refresh (Refresh Now)

**Admin Refresh är server-side via Cloud Function.**

- Knappen "Refresh Now" (admin only) anropar Cloud Function `adminRefreshCache`.
- Cloud Function hämtar data från Apps Script och skriver till Firestore `viewData`.
- adminRefreshCache refreshar även threshold-industry från Sheets (kräver ark "ThresholdIndustry" i Google Sheet).
- Klienten hämtar **aldrig** Sheets-data direkt vid Refresh Now; den läser bara `viewData` efter att functionen har uppdaterat.
- Säkerhetskontroller (admin-roll) sker server-side i Cloud Function.

## Steg B — Token & Auth (kontrakt)

### A) Token transport
- **A1** Client→Proxy/Apps Script: Token SKA INTE ligga i querystring (?token=...). Token SKA skickas i Authorization header ("Bearer <token>") när möjligt.
- **A2** Service Worker / deltaSync (client): Endast Authorization header. Ingen token i URL, ingen token i body.
- **A3** Cloud Function→Apps Script: Apps Script Web App kan inte läsa Authorization header; token SKA skickas i JSON body: { token: "<token>" }. Token SKA fortfarande aldrig ligga i URL.
- **A4** Logging: All loggning SKA redaktera token/authorization/apiKey-liknande värden.

### B) Apps Script auth-mode
- **B1** När API_TOKEN är satt => fail-closed: saknad/ogiltig token => 401 JSON.
- **B2** När API_TOKEN saknas => authMode "open" (dev-only); måste vara tydligt markerat i docs.

### C) GET/POST-policy
- Token i URL (?token=xxx) => 401 (aldrig accepterat).
- När API_TOKEN är satt: GET blockas (405); använd POST med token i header eller body.
- När API_TOKEN saknas: GET tillåtet (open mode).

### Token transport matrix
| Källa | Mål | Token-placering | Motivering |
|-------|-----|-----------------|------------|
| Client (hooks) | Proxy | Authorization header | Proxy läser header, vidarebefordrar till Apps Script |
| SW / deltaSync | Proxy | Authorization header | Samma som client; ingen token i body |
| Cloud Function | Apps Script | JSON body | Apps Script kan inte läsa request headers |

### Övrigt
- Client must use proxy (VITE_APPS_SCRIPT_PROXY_URL) when API_TOKEN is enabled.
- **Manuell verifiering:** GET mot Apps Script med `?token=xxx` ska alltid ge 401 (token i URL accepteras aldrig).

## Steg C — Secure mode vs Open mode

Secure mode tvingar proxy + auth och blockerar legacy GET utan token. Open mode tillåter direkt GET till Apps Script (endast för dev).

| Mode     | Beteende                                           |
|----------|----------------------------------------------------|
| **Secure** | Proxy krävs; legacy GET blockeras med `SecurityError` |
| **Open**   | Direkt GET till Apps Script ok (endast dev)         |

**Definition av secure mode:** `VITE_APPS_SCRIPT_TOKEN` är satt (truthy) **eller** `VITE_APPS_SCRIPT_SECURE_MODE === 'true'`.

I secure mode:
- `fetchJSONData` (legacy GET) blockeras innan fetch med `SecurityError`. Använd delta sync eller admin refresh.
- Om `VITE_APPS_SCRIPT_URL` är satt och `VITE_APPS_SCRIPT_PROXY_URL` är tom: `requireProxyInSecureMode()` kastar med tydligt fel (inkl. hur man sätter proxy).
- deltaSync använder alltid POST när secure mode (och proxy) är konfigurerat.

## RBAC (Rollbaserad åtkomst)

- `viewData`: läs enligt `allowedViews`, skriv endast via server (admin).
- `adminActions`: endast admin kan läsa; skriv endast via Cloud Functions.
