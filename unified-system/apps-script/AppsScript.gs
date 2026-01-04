// Stock Wizard - Google Apps Script Backend
// Requirements: Always returns JSON, never HTML. Handles all errors gracefully.

const MASTER_SHEET_ID = '1e3rsYW4RoEpxpH8ZMckLP7VdtnpbbfQpd8N_NB9fRgM';
const STOCKTAKE_FOLDER_ID = '1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE';
// API_SECRET is set via Script Properties only (not hardcoded)

// ============================================
// HTTP HANDLERS - ALWAYS RETURN JSON
// ============================================

function doPost(e) {
  const requestId = Utilities.getUuid();
  try {
    // Validate request structure
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse('No request data received', 'doPost', requestId);
    }
    
    // Parse JSON safely
    let request;
    try {
      request = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 'doPost', requestId);
    }
    
    // Basic authentication check (only uses Script Properties, no hardcoded fallback)
    const providedSecret = request.secret || request.apiSecret;
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (expectedSecret && providedSecret !== expectedSecret) {
      console.error(`[${requestId}] Authentication failed`);
      return errorResponse('Unauthorized', 'doPost', requestId, 'UNAUTHORIZED');
    }
    // If no secret is set in Script Properties, authentication is disabled (for development)
    
    // Validate action
    if (!request.action || typeof request.action !== 'string') {
      return errorResponse('Missing or invalid action parameter', 'doPost', requestId);
    }
    
    // Route to handler
    const handlers = {
      getProductDatabase: () => getProductDatabase(requestId),
      getLocations: () => getLocations(requestId),
      createStocktake: () => createStocktake(request, requestId),
      listStocktakes: () => listStocktakes(request, requestId),
      syncScans: () => syncScans(request, requestId),
      deleteScans: () => deleteScans(request, requestId),
      loadUserScans: () => loadUserScans(request, requestId),
      syncKegs: () => syncKegs(request, requestId),
      syncManualEntries: () => syncManualEntries(request, requestId)
    };
    
    const handler = handlers[request.action];
    if (!handler) {
      return errorResponse('Unknown action: ' + request.action, 'doPost', requestId);
    }
    
    return handler();
  } catch (error) {
    console.error(`[${requestId}] Uncaught error in doPost:`, error);
    return errorResponse(error.toString(), 'doPost', requestId);
  }
}

function doGet(e) {
  const requestId = Utilities.getUuid();
  try {
    return successResponse('API is running', { timestamp: new Date().toISOString() }, requestId);
  } catch (error) {
    return errorResponse(error.toString(), 'doGet', requestId);
  }
}

// ============================================
// RESPONSE HELPERS - ALWAYS JSON, CONSISTENT CONTRACT
// ============================================

function successResponse(message, data = {}, requestId = null) {
  const response = {
    ok: true,
    requestId: requestId || Utilities.getUuid(),
    message: message,
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, where, requestId = null, code = 'ERROR') {
  const response = {
    ok: false,
    requestId: requestId || Utilities.getUuid(),
    error: {
      code: code,
      message: String(message),
      where: String(where)
    }
  };
  
  // Log detailed error for debugging (not sent to client)
  console.error(`[${response.requestId}] Error in ${where}:`, message);
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// PRODUCT DATABASE & LOCATIONS
// ============================================

function getProductDatabase(requestId) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('Product Database');
    if (!sheet) {
      return errorResponse('Product Database sheet not found', 'getProductDatabase', requestId);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return successResponse('No products found', { products: [] }, requestId);
    }
    
    const data = sheet.getRange('A2:D' + lastRow).getValues();
    const products = data.map(row => ({
      barcode: String(row[0] || ''),
      product: row[1] || '',
      currentStock: row[2] || 0,
      value: row[3] || 0
    }));
    
    return successResponse('Products loaded', { products }, requestId);
  } catch (error) {
    return errorResponse('Error loading products: ' + error.toString(), 'getProductDatabase', requestId);
  }
}

function getLocations(requestId) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('Locations');
    if (!sheet) {
      return errorResponse('Locations sheet not found', 'getLocations', requestId);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return successResponse('No locations found', { locations: [] }, requestId);
    }
    
    const data = sheet.getRange('A2:A' + lastRow).getValues();
    const locations = data.map(row => row[0]).filter(loc => loc);
    
    return successResponse('Locations loaded', { locations }, requestId);
  } catch (error) {
    return errorResponse('Error loading locations: ' + error.toString(), 'getLocations', requestId);
  }
}

// ============================================
// STOCKTAKE MANAGEMENT
// ============================================

function createStocktake(request, requestId) {
  let ss = null;
  let stocktakeId = null;
  
  try {
    // Validate required parameters
    if (!request.name || typeof request.name !== 'string') {
      return errorResponse('Missing or invalid name parameter', 'createStocktake', requestId);
    }
    if (!request.user || typeof request.user !== 'string') {
      return errorResponse('Missing or invalid user parameter', 'createStocktake', requestId);
    }
    
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const stocktakeName = `Stocktake - ${request.name} - ${dateStr}`;
    
    // Create spreadsheet
    try {
      ss = SpreadsheetApp.create(stocktakeName);
      stocktakeId = ss.getId();
    } catch (createError) {
      return errorResponse('Failed to create spreadsheet: ' + createError.toString(), 'createStocktake', requestId);
    }
    
    // Move to folder if specified - validate folder access
    const folderId = request.folderId || STOCKTAKE_FOLDER_ID;
    let folderMoveFailed = false;
    let folderMoveError = null;
    
    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const folderName = folder.getName();
        const file = DriveApp.getFileById(stocktakeId);
        file.moveTo(folder);
        console.log(`[${requestId}] Moved to folder: ${folderName}`);
      } catch (folderError) {
        folderMoveFailed = true;
        folderMoveError = folderError.toString();
        console.error(`[${requestId}] Folder move failed:`, folderMoveError);
        // Cleanup: trash the created spreadsheet
        try {
          DriveApp.getFileById(stocktakeId).setTrashed(true);
          console.log(`[${requestId}] Cleaned up orphan spreadsheet`);
        } catch (cleanupError) {
          console.error(`[${requestId}] Cleanup failed:`, cleanupError);
        }
        return errorResponse('Folder not found or not accessible: ' + folderMoveError, 'createStocktake', requestId);
      }
    }
    
    // Setup sheets
    try {
      setupStocktakeSheets(ss, request.name, request.user, dateStr);
    } catch (setupError) {
      // Cleanup on setup failure
      try {
        DriveApp.getFileById(stocktakeId).setTrashed(true);
      } catch (cleanupError) {
        console.error(`[${requestId}] Cleanup after setup failure failed:`, cleanupError);
      }
      return errorResponse('Failed to setup sheets: ' + setupError.toString(), 'createStocktake', requestId);
    }
    
    return successResponse('Stocktake created', {
      stocktakeId: stocktakeId,
      name: stocktakeName,
      url: ss.getUrl()
    }, requestId);
  } catch (error) {
    // Final cleanup on any unexpected error
    if (stocktakeId) {
      try {
        DriveApp.getFileById(stocktakeId).setTrashed(true);
      } catch (cleanupError) {
        console.error(`[${requestId}] Final cleanup failed:`, cleanupError);
      }
    }
    return errorResponse('Error creating stocktake: ' + error.toString(), 'createStocktake', requestId);
  }
}

function setupStocktakeSheets(ss, name, user, dateStr) {
  const activeSheet = ss.getActiveSheet();
  activeSheet.setName('Tally');
  activeSheet.getRange('A1:F1').setValues([['Barcode', 'Product', 'Total Quantity', 'Locations', 'Last Updated', 'Stock Level']]);
  formatHeader(activeSheet.getRange('A1:F1'));
  
  const sheets = [
    { name: 'Raw Scans', headers: ['Barcode', 'Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID'] },
    { name: 'Manual', headers: ['Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Sync ID'] },
    { name: 'Kegs', headers: ['Keg Product', 'Count', 'Location', 'User', 'Timestamp', 'Synced', 'Sync ID'] },
    { name: 'Deleted Scans', headers: ['Barcode', 'Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID', 'Deleted At'] },
    { name: 'Metadata', headers: ['Property', 'Value'] }
  ];
  
  sheets.forEach(sheetConfig => {
    const sheet = ss.insertSheet(sheetConfig.name);
    sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]);
    formatHeader(sheet.getRange(1, 1, 1, sheetConfig.headers.length));
    
    if (sheetConfig.name === 'Deleted Scans' || sheetConfig.name === 'Metadata') {
      sheet.hideSheet();
    }
  });
  
  const metadataSheet = ss.getSheetByName('Metadata');
  metadataSheet.getRange('A2:B5').setValues([
    ['stocktake_name', name],
    ['created_by', user],
    ['created_date', dateStr],
    ['status', 'Active']
  ]);
}

function formatHeader(range) {
  range.setFontWeight('bold').setBackground('#4A5568').setFontColor('#FFFFFF');
}

function listStocktakes(request, requestId) {
  try {
    const MAX_RESULTS = 100; // Cap to prevent timeouts
    const folderId = request.folderId || STOCKTAKE_FOLDER_ID;
    let files;
    
    // Validate folder access if folder ID provided
    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const folderName = folder.getName();
        files = folder.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
        console.log(`[${requestId}] Searching folder: ${folderName}`);
      } catch (folderError) {
        // Don't fallback to Drive-wide search - it's too slow and risky
        return errorResponse('Folder not accessible: ' + folderError.toString(), 'listStocktakes', requestId);
      }
    } else {
      // Cap Drive-wide search tightly
      files = DriveApp.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
    }
    
    const stocktakes = [];
    let count = 0;
    
    // Use file properties only - don't open spreadsheets (too slow)
    while (files.hasNext() && count < MAX_RESULTS) {
      try {
        const file = files.next();
        count++;
        
        // Extract metadata from filename pattern: "Stocktake - {name} - {date}"
        const fileName = file.getName();
        const nameMatch = fileName.match(/Stocktake - (.+?) - (\d{4}-\d{2}-\d{2})/);
        const displayName = nameMatch ? nameMatch[1] : fileName;
        
        stocktakes.push({
          id: file.getId(),
          name: fileName,
          displayName: displayName,
          createdBy: 'Unknown', // Can't get without opening spreadsheet
          createdDate: nameMatch ? nameMatch[2] : 'Unknown',
          status: 'Active',
          url: file.getUrl(),
          lastModified: file.getLastUpdated()
        });
      } catch (fileError) {
        // Skip inaccessible files
        continue;
      }
    }
    
    stocktakes.sort((a, b) => b.lastModified - a.lastModified);
    
    return successResponse('Stocktakes loaded', {
      stocktakes: stocktakes,
      totalFound: count,
      limited: count >= MAX_RESULTS
    }, requestId);
  } catch (error) {
    return errorResponse('Error listing stocktakes: ' + error.toString(), 'listStocktakes', requestId);
  }
}

// ============================================
// SCAN SYNCING - BATCHED WRITES
// ============================================

function syncScans(request, requestId) {
  try {
    if (!request.stocktakeId) {
      return errorResponse('Missing stocktakeId', 'syncScans', requestId);
    }
    
    const MAX_SCANS = 500; // Reject large batches to prevent timeouts
    if (!request.scans || !Array.isArray(request.scans)) {
      return errorResponse('Missing or invalid scans array', 'syncScans', requestId);
    }
    if (request.scans.length === 0) {
      return successResponse('No scans to sync', { syncedCount: 0 }, requestId);
    }
    if (request.scans.length > MAX_SCANS) {
      return errorResponse(`Too many scans (${request.scans.length}). Maximum ${MAX_SCANS} per request. Please chunk your requests.`, 'syncScans', requestId, 'TOO_MANY_SCANS');
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const rawSheet = ss.getSheetByName('Raw Scans');
    const tallySheet = ss.getSheetByName('Tally');
    
    if (!rawSheet || !tallySheet) {
      return errorResponse('Required sheets not found in stocktake', 'syncScans', requestId);
    }
    
    // Get existing sync IDs
    const lastRow = rawSheet.getLastRow();
    const existingIds = {};
    if (lastRow > 1) {
      const syncIds = rawSheet.getRange('J2:J' + lastRow).getValues();
      syncIds.forEach((row, i) => {
        if (row[0]) existingIds[row[0]] = i + 2;
      });
    }
    
    // Separate updates and inserts
    const toUpdate = []; // Array of {rowIndex, rowData}
    const toAdd = [];
    const syncedIds = [];
    
    request.scans.forEach(scan => {
      if (!scan.syncId) return; // Skip scans without syncId
      
      const row = [
        scan.barcode || '', scan.product || '', scan.quantity || 0, scan.location || '',
        scan.user || '', scan.timestamp || '', scan.stockLevel || '', scan.value || '',
        'Yes', scan.syncId
      ];
      
      if (existingIds[scan.syncId]) {
        toUpdate.push({ rowIndex: existingIds[scan.syncId], row: row });
      } else {
        toAdd.push(row);
      }
      syncedIds.push(scan.syncId);
    });
    
    // Batch update existing rows
    if (toUpdate.length > 0) {
      // Group updates by consecutive rows for efficiency
      toUpdate.sort((a, b) => a.rowIndex - b.rowIndex);
      toUpdate.forEach(update => {
        rawSheet.getRange(update.rowIndex, 1, 1, 10).setValues([update.row]);
      });
    }
    
    // Batch insert new rows
    if (toAdd.length > 0) {
      rawSheet.getRange(rawSheet.getLastRow() + 1, 1, toAdd.length, 10).setValues(toAdd);
    }
    
    // Update tally
    updateTally(tallySheet, rawSheet);
    
    return successResponse('Scans synced', {
      syncedCount: request.scans.length,
      syncedIds: syncedIds,
      newScans: toAdd.length,
      updatedScans: toUpdate.length
    }, requestId);
  } catch (error) {
    return errorResponse('Error syncing scans: ' + error.toString(), 'syncScans', requestId);
  }
}

function updateTally(tallySheet, rawSheet) {
  try {
    const lastRow = rawSheet.getLastRow();
    if (lastRow < 2) return;
    
    const data = rawSheet.getRange('A2:H' + lastRow).getValues();
    const tally = {};
    
    data.forEach(row => {
      const barcode = String(row[0] || '');
      if (!tally[barcode]) {
        tally[barcode] = {
          product: row[1],
          totalQty: 0,
          locations: new Set(),
          stockLevel: row[6]
        };
      }
      tally[barcode].totalQty += parseFloat(row[2]) || 0;
      tally[barcode].locations.add(row[3]);
    });
    
    // Clear and write tally
    if (tallySheet.getLastRow() > 1) {
      tallySheet.getRange('A2:F' + tallySheet.getLastRow()).clearContent();
    }
    
    const rows = Object.keys(tally).map(barcode => [
      barcode,
      tally[barcode].product,
      tally[barcode].totalQty,
      Array.from(tally[barcode].locations).join(', '),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      tally[barcode].stockLevel
    ]);
    
    if (rows.length > 0) {
      tallySheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }
  } catch (e) {
    // Silently fail tally update - not critical
  }
}

function loadUserScans(request, requestId) {
  try {
    if (!request.stocktakeId) {
      return errorResponse('Missing stocktakeId', 'loadUserScans', requestId);
    }
    if (!request.username) {
      return errorResponse('Missing username', 'loadUserScans', requestId);
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Raw Scans');
    
    if (!sheet) {
      return errorResponse('Raw Scans sheet not found', 'loadUserScans', requestId);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return successResponse('No scans found', { scans: [] }, requestId);
    }
    
    const data = sheet.getRange('A2:J' + lastRow).getValues();
    const scans = data
      .filter(row => row[4] === request.username)
      .map(row => ({
        barcode: String(row[0] || ''),
        product: row[1],
        quantity: row[2],
        location: row[3],
        user: row[4],
        timestamp: row[5],
        stockLevel: row[6],
        value: row[7],
        synced: row[8] === 'Yes',
        syncId: row[9]
      }));
    
    return successResponse('User scans loaded', { scans, count: scans.length }, requestId);
  } catch (error) {
    return errorResponse('Error loading scans: ' + error.toString(), 'loadUserScans', requestId);
  }
}

function deleteScans(request, requestId) {
  try {
    if (!request.stocktakeId) {
      return errorResponse('Missing stocktakeId', 'deleteScans', requestId);
    }
    if (!request.syncIds || !Array.isArray(request.syncIds) || request.syncIds.length === 0) {
      return successResponse('No scans to delete', { deletedCount: 0 }, requestId);
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const rawSheet = ss.getSheetByName('Raw Scans');
    const deletedSheet = ss.getSheetByName('Deleted Scans');
    
    if (!rawSheet || !deletedSheet) {
      return errorResponse('Required sheets not found', 'deleteScans', requestId);
    }
    
    const lastRow = rawSheet.getLastRow();
    if (lastRow < 2) {
      return successResponse('No scans found', { deletedCount: 0 }, requestId);
    }
    
    const data = rawSheet.getRange('A2:J' + lastRow).getValues();
    const toDelete = [];
    const rowIndices = [];
    
    data.forEach((row, i) => {
      if (request.syncIds.includes(row[9])) {
        toDelete.push([...row, new Date().toISOString()]);
        rowIndices.push(i + 2);
      }
    });
    
    if (toDelete.length > 0) {
      deletedSheet.getRange(deletedSheet.getLastRow() + 1, 1, toDelete.length, 11).setValues(toDelete);
      rowIndices.reverse().forEach(idx => rawSheet.deleteRow(idx));
      updateTally(ss.getSheetByName('Tally'), rawSheet);
    }
    
    return successResponse('Scans deleted', { deletedCount: toDelete.length, deletedIds: request.syncIds }, requestId);
  } catch (error) {
    return errorResponse('Error deleting scans: ' + error.toString(), 'deleteScans', requestId);
  }
}

// ============================================
// KEGS & MANUAL ENTRIES
// ============================================

function syncKegs(request, requestId) {
  try {
    if (!request.stocktakeId) {
      return errorResponse('Missing stocktakeId', 'syncKegs', requestId);
    }
    if (!request.kegs || !Array.isArray(request.kegs) || request.kegs.length === 0) {
      return successResponse('No kegs to sync', { syncedCount: 0 }, requestId);
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Kegs');
    
    if (!sheet) {
      return errorResponse('Kegs sheet not found', 'syncKegs', requestId);
    }
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const syncId = Utilities.getUuid();
    const rows = request.kegs.map(keg => [
      keg.product || keg.name || '',
      keg.count || 0,
      request.location || '',
      request.user || '',
      timestamp,
      'Yes',
      syncId
    ]);
    
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    return successResponse('Kegs synced', { syncedCount: request.kegs.length, syncId }, requestId);
  } catch (error) {
    return errorResponse('Error syncing kegs: ' + error.toString(), 'syncKegs', requestId);
  }
}

function syncManualEntries(request, requestId) {
  try {
    if (!request.stocktakeId) {
      return errorResponse('Missing stocktakeId', 'syncManualEntries', requestId);
    }
    if (!request.manualEntries || !Array.isArray(request.manualEntries) || request.manualEntries.length === 0) {
      return successResponse('No manual entries to sync', { syncedCount: 0 }, requestId);
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Manual');
    
    if (!sheet) {
      return errorResponse('Manual sheet not found', 'syncManualEntries', requestId);
    }
    
    // Get existing sync IDs
    const lastRow = sheet.getLastRow();
    const existingIds = {};
    if (lastRow > 1) {
      const syncIds = sheet.getRange('H2:H' + lastRow).getValues();
      syncIds.forEach((row, i) => {
        if (row[0]) existingIds[row[0]] = i + 2;
      });
    }
    
    // Separate updates and inserts for batching
    const toUpdate = [];
    const toAdd = [];
    const syncedIds = [];
    
    request.manualEntries.forEach(entry => {
      const syncId = entry.syncId || Utilities.getUuid();
      const timestamp = entry.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const row = [
        entry.product || '',
        entry.quantity || 0,
        entry.location || '',
        entry.user || '',
        timestamp,
        entry.stockLevel || '',
        entry.value || '',
        syncId
      ];
      
      if (existingIds[syncId]) {
        toUpdate.push({ rowIndex: existingIds[syncId], row: row });
      } else {
        toAdd.push(row);
      }
      syncedIds.push(syncId);
    });
    
    // Batch update existing rows
    if (toUpdate.length > 0) {
      toUpdate.forEach(update => {
        sheet.getRange(update.rowIndex, 1, 1, 8).setValues([update.row]);
      });
    }
    
    // Batch insert new rows
    if (toAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 8).setValues(toAdd);
    }
    
    return successResponse('Manual entries synced', {
      syncedCount: request.manualEntries.length,
      syncedIds: syncedIds,
      newEntries: toAdd.length,
      updatedEntries: toUpdate.length
    }, requestId);
  } catch (error) {
    return errorResponse('Error syncing manual entries: ' + error.toString(), 'syncManualEntries', requestId);
  }
}
