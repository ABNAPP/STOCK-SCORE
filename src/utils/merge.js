/**
 * Mergar data från flera källor och deduplicerar
 * 
 * Dedupliceringsregel:
 * - Behåll högst score
 * - Om samma score, behåll första förekomst
 */
export function mergeAndDeduplicate(sourcesData) {
  if (!sourcesData || sourcesData.length === 0) {
    return []
  }

  // Skapa en map för deduplicering (key = id)
  const mergedMap = new Map()

  for (const sourceData of sourcesData) {
    if (!sourceData.data || !Array.isArray(sourceData.data)) {
      continue
    }

    for (const item of sourceData.data) {
      const id = item.id
      if (!id) continue

      const existing = mergedMap.get(id)

      if (!existing) {
        // Lägg till nytt item
        mergedMap.set(id, item)
      } else {
        // Jämför score och behåll högst
        const existingScore = typeof existing.score === 'number' ? existing.score : 0
        const newScore = typeof item.score === 'number' ? item.score : 0

        if (newScore > existingScore) {
          // Ersätt med nytt item (högre score)
          mergedMap.set(id, item)
        }
        // Annars behåll befintligt (högre eller samma score)
      }
    }
  }

  // Konvertera map till array
  return Array.from(mergedMap.values())
}

