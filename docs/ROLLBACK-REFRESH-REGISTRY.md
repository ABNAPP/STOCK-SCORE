# Rollback: RefreshContext registry (Steg 4)

Om ändringarna i RefreshContext-registryt orsakar problem, återställ med:

```bash
git revert HEAD~3..HEAD  # eller motsvarande commit-range
```

## Ändringar som kan rullas tillbaka

1. **RefreshContext.tsx**
   - Borttagna: `useBenjaminGrahamData`, `useScoreBoardData`, `usePEIndustryData`
   - Tillagda: `registerRefetch`, `useRefreshOptional`, registry-baserad `refreshAll`
   - `isRefreshing` styrs nu av `useState` under refresh i stället för hook-loading

2. **Data hooks (useScoreBoardData, useBenjaminGrahamData, usePEIndustryData)**
   - Ny self-registration: `useRefreshOptional` + `useEffect` som registrerar refetch

3. **Tester**
   - Ny: `RefreshContext.integration.test.tsx`
   - Mocks för `useRefreshOptional` i useScoreBoardData, useBenjaminGrahamData, usePEIndustryData

## Återställning manuellt

För att gå tillbaka till att RefreshProvider själv mountar hooks:
- Återinför de tre `use*Data()`-anropen i RefreshProvider
- Ta bort `registerRefetch` och registry-logiken
- Ta bort self-registration i de tre data-hooksen (useEffect som anropar `registerRefetch`)
- Ta bort `useRefreshOptional` export
