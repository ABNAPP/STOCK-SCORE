/**
 * Konverterar Google Sheets URL till CSV-export URL
 * Stödjer olika format: /edit, /pubhtml, /pub, iframe-kod
 * 
 * Denna logik är baserad på den fungerande koden från den gamla appen
 */
export function convertSheetsUrlToCsv(url) {
  if (!url) return null

  // Ta bort whitespace
  let cleanUrl = url.trim()

  // Om iframe-kod, extrahera src
  if (cleanUrl.includes('<iframe') || cleanUrl.includes('src=')) {
    const srcMatch = cleanUrl.match(/src=["']([^"']+)["']/)
    if (srcMatch && srcMatch[1]) {
      cleanUrl = srcMatch[1]
    }
  }

  // Om det redan är en CSV-export URL, returnera direkt (med cache-bypass)
  if (cleanUrl.includes('/export?format=csv') || cleanUrl.includes('/pub?output=csv')) {
    const separator = cleanUrl.includes('?') ? '&' : '?'
    return `${cleanUrl}${separator}_=${Date.now()}`
  }

  // Hantera olika Google Sheets URL-format
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    let targetUrl = cleanUrl

    // Format: /pubhtml
    if (targetUrl.includes('/pubhtml')) {
      const gidMatch = targetUrl.match(/[?&]gid=([0-9]+)/)
      const gid = gidMatch ? gidMatch[1] : '0'
      targetUrl = targetUrl.replace(/\/pubhtml.*/, `/pub?output=csv&gid=${gid}`)
    }
    // Format: /edit
    else if (targetUrl.includes('/edit')) {
      try {
        const idMatch = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
        if (idMatch) {
          const id = idMatch[1]
          const gidMatch = targetUrl.match(/[?&#]gid=([0-9]+)/)
          const gid = gidMatch ? gidMatch[1] : '0'
          targetUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
        }
      } catch (e) {
        console.error('Error parsing edit URL:', e)
      }
    }
    // Format: /pub (utan output=csv)
    else if (targetUrl.includes('/pub') && !targetUrl.includes('output=csv')) {
      const separator = targetUrl.includes('?') ? '&' : '?'
      targetUrl = `${targetUrl}${separator}output=csv`
    }
    // Format: direkt /d/ID (utan /edit eller /pub)
    else if (targetUrl.match(/\/d\/[a-zA-Z0-9-_]+/)) {
      const idMatch = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
      if (idMatch) {
        const id = idMatch[1]
        const gidMatch = targetUrl.match(/[?&#]gid=([0-9]+)/)
        const gid = gidMatch ? gidMatch[1] : '0'
        targetUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
      }
    }

    // Lägg till cache-bypass
    const separator = targetUrl.includes('?') ? '&' : '?'
    return `${targetUrl}${separator}_=${Date.now()}`
  }

  // Om det inte är en Google Sheets URL, returnera null
  return null
}

/**
 * Kontrollerar om en URL är en Google Sheets URL
 */
export function isSheetsUrl(url) {
  if (!url) return false
  return url.includes('docs.google.com/spreadsheets')
}

/**
 * Kontrollerar om en URL är en Apps Script URL
 */
export function isAppsScriptUrl(url) {
  if (!url) return false
  return url.includes('script.google.com/macros')
}

