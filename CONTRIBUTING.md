# Contributing

## Branch-namngivning

- `feature/<kort-beskrivning>` – ny funktion (t.ex. `feature/portfolio-export`)
- `fix/<kort-beskrivning>` – buggfix (t.ex. `fix/tableId-conditions-modal`)
- `refactor/<kort-beskrivning>` – refaktor utan beteendeförändring
- `chore/<kort-beskrivning>` – dependencies, config, docs (t.ex. `chore/update-deps`)
- `docs/<kort-beskrivning>` – endast dokumentation

## Commit-konventioner (Conventional Commits, rekommenderat)

- `feat: ...` – ny funktion
- `fix: ...` – buggfix
- `refactor: ...` – refaktor
- `test: ...` – testerna
- `docs: ...` – dokumentation
- `chore: ...` – övrigt

Exempel: `fix: use shared getTableId in ConditionsSidebar`

För enkel rollback: håll PR:ar små och **en commit per PR** (squash vid merge) underlättar `git revert` (en revert = en commit).

## Lint / ESLint

- ESLint konfigureras **endast** via `eslint.config.js` (flat config). Använd inte legacy `.eslintrc.*`.

## PR och rollback

- Använd [PR-mallen](.github/PULL_REQUEST_TEMPLATE.md) och kryssa av checklistan innan merge.
- Verifiering: se [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) för `npm run verify` / `verify:full`.
- Rollback: se [docs/ROLLBACK.md](docs/ROLLBACK.md).
