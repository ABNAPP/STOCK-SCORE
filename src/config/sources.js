/**
 * Konfiguration för datakällor via Google Apps Script
 * 
 * Bas-URL till Apps Script Web App ska sättas i settings i appen
 * Format: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 * 
 * OBS: SCRIPT_BASE_URL hanteras nu i appens settings, inte här
 */

/**
 * Datakällor som exponeras via Apps Script
 */
export const SOURCES = [
  {
    key: 'scoreboard',
    name: 'ScoreBoard',
    endpoint: '/exec?source=scoreboard',
    enabled: true
  },
  {
    key: 'dashboard',
    name: 'DashBoard',
    endpoint: '/exec?source=dashboard',
    enabled: true
  },
  {
    key: 'ro40',
    name: 'Ro40',
    endpoint: '/exec?source=ro40',
    enabled: true
  },
  {
    key: 'entryexit',
    name: 'Entry / Exit',
    endpoint: '/exec?source=entryexit',
    enabled: false
  }
]

/**
 * Hämtar alla enabled källor
 */
export function getEnabledSources() {
  return SOURCES.filter(source => source.enabled)
}

/**
 * Bygger full URL för en källa
 * @param {Object} source - Källobjekt
 * @param {string} scriptBaseUrl - Bas-URL till Apps Script eller Google Sheets
 */
export function buildSourceUrl(source, scriptBaseUrl) {
  if (!scriptBaseUrl) {
    throw new Error('SCRIPT_BASE_URL is not configured')
  }

  // Om det är en Google Sheets URL, returnera null (hanteras separat)
  const isSheetsUrl = scriptBaseUrl.includes('docs.google.com/spreadsheets')
  if (isSheetsUrl) {
    return null // Indikerar att detta ska hanteras som direkt Sheets-URL
  }
  
  // Annars bygg Apps Script URL
  const base = scriptBaseUrl.replace(/\/$/, '') // Ta bort trailing slash
  const endpoint = source.endpoint.startsWith('/') ? source.endpoint : `/${source.endpoint}`
  const url = `${base}${endpoint}`
  
  // Lägg till cache-bypass
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_=${Date.now()}`
}

