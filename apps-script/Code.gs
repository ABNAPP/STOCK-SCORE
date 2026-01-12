/**
 * Google Apps Script for Delta Sync API
 * 
 * This script provides delta-sync endpoints for Google Sheets data:
 * - GET /snapshot?sheet={name}&token={token} - Returns full snapshot
 * - GET /changes?sheet={name}&since={version}&token={token} - Returns changes since version
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
 * Main entry point for GET requests
 */
function doGet(e) {
  try {
    // Check authentication
    const authError = checkAuth(e.parameter.token);
    if (authError) {
      return authError;
    }
    
    const action = e.parameter.action || 'snapshot';
    const sheetName = e.parameter.sheet || 'DashBoard';
    
    if (action === 'snapshot' || !e.parameter.action) {
      return handleSnapshot(sheetName);
    } else if (action === 'changes') {
      const sinceVersion = e.parameter.since ? parseInt(e.parameter.since, 10) : 0;
      return handleChanges(sheetName, sinceVersion);
    } else {
      return createErrorResponse('Invalid action. Use "snapshot" or "changes"', 400);
    }
  } catch (error) {
    return createErrorResponse('Server error: ' + error.toString(), 500);
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
 * Check authentication token
 */
function checkAuth(token) {
  try {
    var props = PropertiesService.getScriptProperties();
    var validToken = props.getProperty('API_TOKEN');
    
    // If no token is configured, allow access (for easier setup)
    if (!validToken) {
      return null; // Allow access
    }
    
    if (!token || token !== validToken) {
      return createErrorResponse('Unauthorized: Invalid or missing token', 401);
    }
    
    return null; // Auth passed
  } catch (error) {
    // On error, allow access (fail open for easier setup)
    return null;
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
