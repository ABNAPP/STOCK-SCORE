# Release-checklista

Standardiserad verifiering innan merge till main och vid release.

## Verifiering

### Snabb verifiering (pre-push)

Kör innan varje push:

```bash
npm run verify
```

Kör: lint → build:check → unit-tester → integration-tester.

### Full verifiering (pre-release / pre-merge till main)

Kör innan merge till main eller vid release:

```bash
npm run verify:full
```

Kör: `verify` + E2E-tester.

### Manuella steg

| Kommando | Syfte |
|----------|--------|
| `npm run lint` | ESLint (max-warnings 0) |
| `npm run build:check` | TypeScript (tsc) + Vite-build |
| `npm run test:unit` | Unit-tester (`src/**/__tests__/**/*.test.{ts,tsx}`) |
| `npm run test:integration` | Integrationstester (`src/test/integration/`) |
| `npm run test:e2e` | Playwright E2E-tester |
| `npm run test:coverage` | Coverage-rapport |
| `npm run storybook` | Manuell kontroll av UI-komponenter |

### Secret scan (innan push)

Se [docs/SECRETS.md](SECRETS.md) för ripgrep-kommandon som verifierar att inga riktiga API-nycklar finns i repo.

---

## Revertera PR/commit

Se [docs/ROLLBACK.md](ROLLBACK.md) för detaljerad rollback-process.

**Kortversion:**

1. Hitta merge-commit: `git log --oneline main`
2. Revert: `git revert -m 1 <merge-commit-hash>`
3. Push: `git push origin main`
4. Verifiera: `npm run verify` (eller `verify:full` vid E2E-ändringar)

---

## Taggar och release-markering

Om ni vill markera utgivna versioner:

### Skapa tagg

```bash
git checkout main
git pull origin main
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

### Lista taggar

```bash
git tag -l
```

### Checka ut vid specifik version

```bash
git checkout v1.2.3
```

**OBS:** Taggning är valfritt. Vercel deployar automatiskt från main. Använd taggar om ni behöver versionshistorik, rollback till en känd stabil punkt, eller changelog-triggers.
