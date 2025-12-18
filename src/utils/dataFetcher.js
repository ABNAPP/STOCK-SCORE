/**
 * Hämtar data från Google Apps Script endpoint eller direkt från Google Sheets
 * Stödjer både CSV och JSON-respons
 */
export async function fetchDataFromUrl(url) {
  if (!url) {
    throw new Error('URL is required')
  }

  try {
    const response = await fetch(url)

    if (response.status === 401 || response.status === 403) {
      throw new Error('CORS_ERROR')
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    
    // Om JSON
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      const json = await response.json()
      // Om det är en array, returnera direkt
      if (Array.isArray(json)) {
        return { type: 'json', data: json }
      }
      // Om det är ett objekt med data-array
      if (json.data && Array.isArray(json.data)) {
        return { type: 'json', data: json.data }
      }
      // Annars wrappa i array
      return { type: 'json', data: [json] }
    }

    // Om XLSX eller Excel-format
    if (contentType.includes('spreadsheet') || contentType.includes('excel') || url.includes('.xlsx')) {
      const arrayBuffer = await response.arrayBuffer()
      return { type: 'xlsx', data: arrayBuffer }
    }

    // Annars CSV (default) - kan vara text/csv eller text/plain
    const text = await response.text()
    return { type: 'csv', data: text }
  } catch (error) {
    if (error.message === 'CORS_ERROR') {
      throw error
    }
    throw new Error(`Failed to fetch: ${error.message}`)
  }
}

/**
 * Legacy: Hämtar data från Google Apps Script endpoint
 * @deprecated Använd fetchDataFromUrl istället
 */
export async function fetchAppsScriptData(url) {
  return fetchDataFromUrl(url)
}

/**
 * Parsar CSV-text till array av objekt
 */
export function parseCsv(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  // Parse header
  const header = parseCsvLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row = {}
    header.forEach((key, idx) => {
      row[key] = values[idx] || ''
    })
    rows.push(row)
  }

  return rows
}

/**
 * Parsar en CSV-rad med hantering av citattecken
 */
function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Parsar XLSX-data med SheetJS
 */
export function parseXlsx(arrayBuffer) {
  if (!window.XLSX) {
    throw new Error('XLSX library not loaded')
  }

  const workbook = window.XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  
  return window.XLSX.utils.sheet_to_json(worksheet, { defval: '' })
}

/**
 * Parsar JSON-data (redan en array)
 */
export function parseJson(jsonData) {
  if (Array.isArray(jsonData)) {
    return jsonData
  }
  return []
}
