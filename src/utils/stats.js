import { parseValue } from './parser'

/**
 * Identifierar numeriska kolumner (förutom score/name/ticker)
 */
export function getNumericColumns(data, identifiedColumns) {
  if (!data || data.length === 0) return []

  const firstRow = data[0]
  const columnNames = Object.keys(firstRow)
  const excluded = [identifiedColumns.score, identifiedColumns.name, identifiedColumns.ticker].filter(Boolean)
  
  const numericColumns = []

  for (const col of columnNames) {
    if (excluded.includes(col)) continue

    let numericCount = 0
    let totalCount = 0

    for (const row of data) {
      const val = row[col]
      if (val !== null && val !== undefined && val !== '') {
        totalCount++
        const parsed = parseValue(val)
        if (typeof parsed === 'number') {
          numericCount++
        }
      }
    }

    // Minst 50% numeriska värden
    if (totalCount > 0 && (numericCount / totalCount) >= 0.5) {
      numericColumns.push({
        name: col,
        numericCount,
        totalCount,
        ratio: numericCount / totalCount
      })
    }
  }

  return numericColumns.sort((a, b) => b.ratio - a.ratio)
}

/**
 * Beräknar sum och average för en kolumn
 */
export function calculateColumnStats(data, columnName) {
  const values = []

  for (const row of data) {
    const val = parseValue(row[columnName])
    if (typeof val === 'number' && isFinite(val)) {
      values.push(val)
    }
  }

  if (values.length === 0) {
    return { sum: 0, average: 0, count: 0 }
  }

  const sum = values.reduce((acc, val) => acc + val, 0)
  const average = sum / values.length

  return {
    sum: Math.round(sum * 100) / 100,
    average: Math.round(average * 100) / 100,
    count: values.length
  }
}

