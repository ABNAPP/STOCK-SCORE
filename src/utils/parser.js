/**
 * Robust parsing av numeriska värden (sv/en-format)
 * Stödjer: "12,34", "12 345,67", "12.345", "12,345.67"
 */
export function parseValue(value) {
  if (value === null || value === undefined || value === '') {
    return value
  }

  // Konvertera till string om inte redan
  const str = String(value).trim()
  
  if (str === '') {
    return str
  }

  // Rensa bort icke-numeriska tecken (behåll . , - + och mellanslag)
  let cleaned = str.replace(/[^\d\s.,+\-]/g, '')
  
  if (cleaned === '') {
    return value // Returnera original om inget numeriskt kvar
  }

  // Ta bort mellanslag
  cleaned = cleaned.replace(/\s/g, '')

  // Identifiera decimalseparator
  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')

  let decimalSeparator = null
  let thousandsSeparator = null

  if (hasDot && hasComma) {
    // Om både . och , finns → sista separatorn är decimal
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    
    if (lastDot > lastComma) {
      decimalSeparator = '.'
      thousandsSeparator = ','
    } else {
      decimalSeparator = ','
      thousandsSeparator = '.'
    }
  } else if (hasComma) {
    // Bara komma → kan vara decimal eller tusentalsseparator
    // Om komma följs av exakt 2-3 siffror → decimal
    const commaMatch = cleaned.match(/,(\d{2,3})/)
    if (commaMatch && commaMatch[1].length <= 3) {
      decimalSeparator = ','
    } else {
      thousandsSeparator = ','
    }
  } else if (hasDot) {
    // Bara punkt → kan vara decimal eller tusentalsseparator
    // Om punkt följs av exakt 2-3 siffror → decimal
    const dotMatch = cleaned.match(/\.(\d{2,3})/)
    if (dotMatch && dotMatch[1].length <= 3) {
      decimalSeparator = '.'
    } else {
      thousandsSeparator = '.'
    }
  }

  // Ta bort tusentalsseparator
  if (thousandsSeparator) {
    cleaned = cleaned.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
  }

  // Ersätt decimalseparator med punkt
  if (decimalSeparator) {
    cleaned = cleaned.replace(decimalSeparator, '.')
  }

  // Parsa till number
  const num = parseFloat(cleaned)
  
  if (!isNaN(num) && isFinite(num)) {
    return num
  }

  // Fallback: returnera originalvärde
  return value
}

/**
 * Identifierar kolumner automatiskt
 */
export function identifyColumns(data) {
  if (!data || data.length === 0) {
    return { score: null, name: null, ticker: null }
  }

  const firstRow = data[0]
  const columnNames = Object.keys(firstRow)
  
  let scoreCol = null
  let nameCol = null
  let tickerCol = null

  // Score-kolumn: prioritet 1 - namn som innehåller score/poäng/rating
  const scoreKeywords = ['score', 'poäng', 'rating']
  for (const col of columnNames) {
    const lower = col.toLowerCase()
    if (scoreKeywords.some(kw => lower.includes(kw))) {
      scoreCol = col
      break
    }
  }

  // Score-kolumn: fallback - kolumn med flest numeriska värden mellan 0-100
  if (!scoreCol) {
    let maxNumericCount = 0
    for (const col of columnNames) {
      let numericCount = 0
      let totalCount = 0
      
      for (const row of data) {
        const val = parseValue(row[col])
        if (typeof val === 'number') {
          totalCount++
          if (val >= 0 && val <= 100) {
            numericCount++
          }
        }
      }
      
      const ratio = totalCount > 0 ? numericCount / totalCount : 0
      if (ratio > 0.5 && numericCount > maxNumericCount) {
        maxNumericCount = numericCount
        scoreCol = col
      }
    }
  }

  // Name-kolumn: matcha namn, aktie, bolag, företag, name, company
  const nameKeywords = ['namn', 'aktie', 'bolag', 'företag', 'name', 'company']
  for (const col of columnNames) {
    const lower = col.toLowerCase()
    if (nameKeywords.some(kw => lower.includes(kw))) {
      nameCol = col
      break
    }
  }

  // Name-kolumn: fallback - första icke-numeriska kolumn
  if (!nameCol) {
    for (const col of columnNames) {
      if (col === scoreCol) continue
      
      let hasNonNumeric = false
      for (const row of data) {
        const val = parseValue(row[col])
        if (typeof val !== 'number' && val !== '' && val !== null) {
          hasNonNumeric = true
          break
        }
      }
      
      if (hasNonNumeric) {
        nameCol = col
        break
      }
    }
  }

  // Name-kolumn: sista fallback - första kolumnen
  if (!nameCol && columnNames.length > 0) {
    nameCol = columnNames[0]
  }

  // Ticker-kolumn: matcha ticker, symbol, kortnamn, kod, id
  const tickerKeywords = ['ticker', 'symbol', 'kortnamn', 'kod', 'id']
  for (const col of columnNames) {
    const lower = col.toLowerCase()
    if (tickerKeywords.some(kw => lower.includes(kw))) {
      tickerCol = col
      break
    }
  }

  return { score: scoreCol, name: nameCol, ticker: tickerCol }
}

/**
 * Normaliserar data med identifierade kolumner
 * @param {Array} data - Rådata från källan
 * @param {Object} columns - Identifierade kolumner
 * @param {string} sourceKey - Nyckel för datakällan
 * @param {string} sourceName - Namn på datakällan
 */
export function normalizeData(data, columns, sourceKey = null, sourceName = null) {
  return data.map((row, index) => {
    const normalized = {
      score: columns.score ? parseValue(row[columns.score]) : null,
      name: columns.name ? String(row[columns.name] || '').trim() : '',
      ticker: columns.ticker ? String(row[columns.ticker] || '').trim() : '',
      raw: row, // Behåll originaldata
      sourceKey: sourceKey || null,
      sourceName: sourceName || null
    }

    // Skapa ID: ticker om finns, annars name
    normalized.id = normalized.ticker || normalized.name || `row_${index}`

    return normalized
  }).filter(item => {
    // Filtrera bort rader utan score eller name
    return item.score !== null && item.name !== ''
  })
}

