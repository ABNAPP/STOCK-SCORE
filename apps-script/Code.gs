/**
 * Google Apps Script for Delta Sync API
 *
 * Endpoints:
 * - POST (prod): Token in header (Authorization Bearer or X-API-Token) preferred.
 *   Apps Script Web App does NOT expose headers; token in body when request comes via appsScriptProxy (proxy adds it).
 *   JSON body { action, sheet, since? } from client; proxy forwards with token in body.
 * - GET: No token in URL. When API_TOKEN is set, POST is required.
 *
 * Fail-closed: When API_TOKEN is set in Script Properties, token is required. Missing/invalid => 401.
 * When API_TOKEN is not set: allow access, log warning, include authMode: 'open' in response.
 *
 * Setup:
 * 1. Copy this code to Apps Script bound to your Google Sheet
 * 2. Set API token in Script Properties: key="API_TOKEN", value="your-secret-token"
 * 3. Run installTriggers() function once to set up onEdit trigger
 * 4. Deploy as Web App with "Anyone" access
 */

// Configuration
const SHEET_ID = '1KOOSLJVGdDZHBV1MUmb4D9oVIKUJj5TIgYCerjkWYcE'; // Your spreadsheet ID
const CHANGE_LOG_SHEET_NAME = 'ChangeLog';
const KEY_COLUMN_NAME = 'Ticker'; // Column used as unique key
const MONITORED_SHEETS = ['DashBoard', 'SMA']; // Sheets to track changes for

/**
 * Get token from request. Header-first when Apps Script exposes headers; body fallback.
 * Apps Script Web App does NOT expose e.headers - we read from body (proxy adds token when forwarding).
 * Querystring token is NOT supported (return null to force 401 when API_TOKEN set).
 */
function getRequestToken(e) {
  // A) Header first (Apps Script does not expose e.headers yet - placeholder for future API)
  var tokenFromHeader = null;
  if (e && e.headers) {
    var ah = e.headers['Authorization'] || e.headers['authorization'];
    if (ah && ah.indexOf('Bearer ') === 0) tokenFromHeader = ah.substring(7);
    if (!tokenFromHeader) tokenFromHeader = e.headers['X-Api-Token'] || e.headers['x-api-token'] || null;
  }

  // B) Body (JSON): used when request comes via appsScriptProxy - proxy adds token to body
  var tokenFromBody = null;
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      tokenFromBody = body.token || null;
    } catch (err) { /* invalid JSON */ }
  }

  // C) Querystring: NOT supported - never use params.token for security
  return tokenFromHeader || tokenFromBody;
}

/**
 * Main entry point for GET requests (querystring params; no token in URL)
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    if (params.token) {
      return createErrorResponse('Unauthorized: Token in URL not allowed. Use POST with token in header or body.', 401);
    }
    // When API_TOKEN is set, GET is not allowed (Apps Script cannot receive token via GET)
    var hasApiToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (hasApiToken) {
      return createErrorResponse('Use POST with token in body. GET not allowed when API_TOKEN is set.', 405);
    }
    var token = null;
    var authResult = checkAuth(token);
    if (authResult.error) {
      return authResult.response;
    }
    
    var action = params.action || 'snapshot';
    var sheetName = params.sheet || 'DashBoard';
    
    if (action === 'snapshot' || !params.action) {
      return addAuthMeta(handleSnapshot(sheetName), authResult.authMode);
    } else if (action === 'changes') {
      var sinceVersion = params.since ? parseInt(params.since, 10) : 0;
      return addAuthMeta(handleChanges(sheetName, sinceVersion), authResult.authMode);
    } else {
      return createErrorResponse('Invalid action. Use "snapshot" or "changes"', 400);
    }
  } catch (error) {
    return createErrorResponse('Server error: ' + error.toString(), 500);
  }
}

/**
 * Main entry point for POST requests (JSON body - token via header or proxy body)
 */
function doPost(e) {
  try {
    var token = getRequestToken(e);
    var action = 'snapshot';
    var sheetName = 'DashBoard';
    var sinceVersion = 0;

    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        action = body.action || 'snapshot';
        sheetName = body.sheet || 'DashBoard';
        sinceVersion = body.since ? parseInt(body.since, 10) : 0;
      } catch (parseErr) {
        return createErrorResponse('Invalid JSON body', 400);
      }
    }

    var authResult = checkAuth(token);
    if (authResult.error) {
      return authResult.response;
    }
    
    if (action === 'snapshot' || !action) {
      return addAuthMeta(handleSnapshot(sheetName), authResult.authMode);
    } else if (action === 'changes') {
      return addAuthMeta(handleChanges(sheetName, sinceVersion), authResult.authMode);
    } else {
      return createErrorResponse('Invalid action. Use "snapshot" or "changes"', 400);
    }
  } catch (error) {
    return createErrorResponse('Server error: ' + error.toString(), 500);
  }
}

/**
 * Wrap JSON response with auth meta when authMode is open (for dev)
 */
function addAuthMeta(output, authMode) {
  if (!authMode) return output;
  try {
    var text = output.getContent();
    var data = JSON.parse(text);
    data.meta = data.meta || {};
    data.meta.authMode = authMode;
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return output;
  }
}

/**
 * Handle snapshot request - returns full data
 */
function handleSnapshot(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return createErrorResponse('Sheet "' + sheetName + '" not found', 404);
    }
    
    // Get all data
    const values = sheet.getDataRange().getValues();
    if (values.length === 0) {
      return createErrorResponse('Sheet "' + sheetName + '" is empty', 404);
    }
    
    const headers = values[0].map(function(h) { return String(h).trim(); });
    
    // Find key column index
    const keyColumnIndex = headers.indexOf(KEY_COLUMN_NAME);
    if (keyColumnIndex === -1) {
      return createErrorResponse('Key column "' + KEY_COLUMN_NAME + '" not found in sheet', 400);
    }
    
    // Build rows array with key-value pairs
    const rows = [];
    for (var i = 1; i < values.length; i++) {
      var rowValues = values[i];
      var key = rowValues[keyColumnIndex] ? String(rowValues[keyColumnIndex]).trim() : '';
      if (key) { // Only include rows with a key
        rows.push({
          key: key,
          values: rowValues
        });
      }
    }
    
    // Get current version
    const currentVersion = getCurrentVersion();
    
    const response = {
      ok: true,
      version: currentVersion,
      headers: headers,
      rows: rows,
      generatedAt: new Date().toISOString()
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return createErrorResponse('Failed to generate snapshot: ' + error.toString(), 500);
  }
}

/**
 * Handle changes request - returns only changes since version
 */
function handleChanges(sheetName, sinceVersion) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const changeLogSheet = ensureChangeLogSheet(ss);
    
    if (!changeLogSheet) {
      return createErrorResponse('Failed to access ChangeLog sheet', 500);
    }
    
    // Get all change log entries for this sheet since the version
    const changeLogData = changeLogSheet.getDataRange().getValues();
    if (changeLogData.length <= 1) {
      // No changes logged yet (only header row)
      const currentVersion = getCurrentVersion();
      return createSuccessResponse({
        ok: true,
        fromVersion: sinceVersion,
        toVersion: currentVersion,
        changes: [],
        needsFullResync: false
      });
    }
    
    // Parse change log (skip header row)
    const changes = [];
    var maxVersion = sinceVersion;
    
    // Column indices in ChangeLog sheet
    var changeIdCol = 0;
    var tsISOCol = 1;
    var sheetNameCol = 2;
    var rowIndexCol = 3;
    var keyCol = 4;
    var changedColumnsCol = 5;
    var rowValuesJsonCol = 6;
    
    for (var i = 1; i < changeLogData.length; i++) {
      var row = changeLogData[i];
      var changeId = parseInt(row[changeIdCol], 10);
      var logSheetName = String(row[sheetNameCol] || '').trim();
      
      // Filter by sheet name and version
      if (logSheetName === sheetName && changeId > sinceVersion) {
        try {
          var rowValuesJson = row[rowValuesJsonCol];
          var rowValues = JSON.parse(rowValuesJson);
          
          var changedColumnsJson = row[changedColumnsCol];
          var changedColumns = changedColumnsJson ? JSON.parse(changedColumnsJson) : [];
          
          changes.push({
            id: changeId,
            tsISO: String(row[tsISOCol] || ''),
            key: String(row[keyCol] || '').trim(),
            rowIndex: parseInt(row[rowIndexCol], 10),
            changedColumns: changedColumns,
            values: rowValues
          });
          
          if (changeId > maxVersion) {
            maxVersion = changeId;
          }
        } catch (parseError) {
          // Skip invalid entries, log error
          console.error('Failed to parse change log entry:', parseError);
        }
      }
    }
    
    // If sinceVersion is too old (e.g., ChangeLog was cleared), suggest full resync
    var needsFullResync = false;
    if (sinceVersion > 0 && changes.length === 0 && maxVersion > sinceVersion) {
      // This shouldn't happen, but if it does, suggest resync
      needsFullResync = true;
    }
    
    // Check if ChangeLog might have been cleared (sinceVersion exists but no changes found)
    var minChangeId = getMinChangeIdInLog(changeLogSheet);
    if (sinceVersion > 0 && sinceVersion < minChangeId) {
      needsFullResync = true;
    }
    
    const currentVersion = getCurrentVersion();
    
    return createSuccessResponse({
      ok: true,
      fromVersion: sinceVersion,
      toVersion: currentVersion,
      changes: changes,
      needsFullResync: needsFullResync
    });
  } catch (error) {
    return createErrorResponse('Failed to get changes: ' + error.toString(), 500);
  }
}

/**
 * Get minimum changeId currently in ChangeLog
 */
function getMinChangeIdInLog(changeLogSheet) {
  try {
    var data = changeLogSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 0; // Only header row
    }
    
    var minId = Infinity;
    for (var i = 1; i < data.length; i++) {
      var changeId = parseInt(data[i][0], 10);
      if (!isNaN(changeId) && changeId < minId) {
        minId = changeId;
      }
    }
    
    return isFinite(minId) ? minId : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * onEdit trigger - logs changes to ChangeLog sheet
 */
function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    var sheetName = sheet.getName();
    
    // Only track changes for monitored sheets
    if (MONITORED_SHEETS.indexOf(sheetName) === -1) {
      return;
    }
    
    // Ignore changes to ChangeLog sheet itself
    if (sheetName === CHANGE_LOG_SHEET_NAME) {
      return;
    }
    
    var range = e.range;
    var rowIndex = range.getRow();
    var columnIndex = range.getColumn();
    
    // Ignore header row (row 1)
    if (rowIndex <= 1) {
      return;
    }
    
    var ss = e.source;
    var changeLogSheet = ensureChangeLogSheet(ss);
    if (!changeLogSheet) {
      return; // Failed to create/access ChangeLog
    }
    
    // Get the edited row data
    var editedRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Get headers to find key column
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).trim();
    });
    var keyColumnIndex = headers.indexOf(KEY_COLUMN_NAME);
    
    if (keyColumnIndex === -1) {
      return; // Key column not found, skip logging
    }
    
    var key = editedRow[keyColumnIndex] ? String(editedRow[keyColumnIndex]).trim() : '';
    if (!key) {
      return; // No key value, skip logging
    }
    
    // Determine which columns changed
    var numColumns = range.getNumColumns();
    var changedColumns = [];
    var startCol = range.getColumn();
    for (var i = 0; i < numColumns; i++) {
      var colIndex = startCol + i - 1; // Convert to 0-based
      if (colIndex < headers.length) {
        changedColumns.push(headers[colIndex]);
      }
    }
    
    // Get next changeId
    var changeId = getNextChangeId();
    
    // Log the change
    var timestamp = new Date().toISOString();
    var rowValuesJson = JSON.stringify(editedRow);
    var changedColumnsJson = JSON.stringify(changedColumns);
    
    changeLogSheet.appendRow([
      changeId,
      timestamp,
      sheetName,
      rowIndex,
      key,
      changedColumnsJson,
      rowValuesJson
    ]);
    
  } catch (error) {
    // Log error but don't throw (onEdit triggers should not throw)
    console.error('Error in onEdit trigger:', error);
  }
}

/**
 * Ensure ChangeLog sheet exists, create if needed
 */
function ensureChangeLogSheet(ss) {
  try {
    var changeLogSheet = ss.getSheetByName(CHANGE_LOG_SHEET_NAME);
    
    if (!changeLogSheet) {
      // Create ChangeLog sheet
      changeLogSheet = ss.insertSheet(CHANGE_LOG_SHEET_NAME);
      
      // Add headers
      changeLogSheet.getRange(1, 1, 1, 7).setValues([[
        'changeId',
        'tsISO',
        'sheetName',
        'rowIndex',
        'key',
        'changedColumns',
        'rowValuesJson'
      ]]);
      
      // Format header row
      var headerRange = changeLogSheet.getRange(1, 1, 1, 7);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e0e0e0');
    }
    
    return changeLogSheet;
  } catch (error) {
    console.error('Failed to ensure ChangeLog sheet:', error);
    return null;
  }
}

/**
 * Get current version (latest changeId)
 */
function getCurrentVersion() {
  try {
    var props = PropertiesService.getScriptProperties();
    var version = props.getProperty('CHANGE_ID');
    return version ? parseInt(version, 10) : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get next changeId and increment
 */
function getNextChangeId() {
  try {
    var props = PropertiesService.getScriptProperties();
    var currentId = parseInt(props.getProperty('CHANGE_ID') || '0', 10);
    var nextId = currentId + 1;
    props.setProperty('CHANGE_ID', String(nextId));
    return nextId;
  } catch (error) {
    console.error('Failed to get next changeId:', error);
    // Fallback: use timestamp (not ideal but better than failing)
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Check authentication token. Fail-closed when API_TOKEN is configured.
 * Returns { error: boolean, response?: TextOutput, authMode?: string }
 * - If API_TOKEN set and token missing/invalid: { error: true, response: 401 }
 * - If API_TOKEN not set: { error: false, authMode: 'open' } - allow but log warning
 * - If auth passes: { error: false }
 */
function checkAuth(token) {
  try {
    var props = PropertiesService.getScriptProperties();
    var validToken = props.getProperty('API_TOKEN');
    
    if (!validToken) {
      console.warn('API_TOKEN not configured in Script Properties - authMode: open (not for prod)');
      return { error: false, authMode: 'open' };
    }
    
    if (!token || token !== validToken) {
      return {
        error: true,
        response: createErrorResponse('Unauthorized: Invalid or missing API token', 401)
      };
    }
    
    return { error: false };
  } catch (err) {
    console.error('checkAuth error:', err);
    return { error: true, response: createErrorResponse('Authentication error', 500) };
  }
}

/**
 * Create error response
 */
function createErrorResponse(message, statusCode) {
  var response = {
    ok: false,
    error: message
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHttpResponseCode(statusCode || 500);
}

/**
 * Create success response
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Install onEdit trigger (run this once after deploying)
 */
function installTriggers() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var triggers = ScriptApp.getProjectTriggers();
    
    // Remove existing onEdit triggers for this function
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'onEdit') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    
    // Note: onEdit is a simple trigger that doesn't need to be installed
    // It's automatically triggered by Google Sheets on edits
    // This function is kept for documentation purposes
    
    console.log('onEdit trigger is automatically handled by Google Sheets');
    console.log('No manual trigger installation needed');
    
  } catch (error) {
    console.error('Error in installTriggers:', error);
    throw error;
  }
}
