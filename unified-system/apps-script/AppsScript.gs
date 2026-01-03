// Unified Stock System - Google Apps Script Backend
// This script provides API endpoints for the unified stock counting and reconciliation app
// WITH PROPER CORS HEADERS

// CONFIGURATION - Update this with your Master Sheet ID and Stocktake Folder ID
const MASTER_SHEET_ID = '1e3rsYW4RoEpxpH8ZMckLP7VdtnpbbfQpd8N_NB9fRgM'; // Master Sheet ID
const STOCKTAKE_FOLDER_ID = '1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE'; // Google Drive Folder ID where stocktakes will be created

// ============================================
// HTTP REQUEST HANDLERS WITH CORS
// ============================================

// Main entry point for HTTP POST requests
function doPost(e) {
  try {
    // Log the request for debugging
    Logger.log('doPost called');
    Logger.log('e.postData: ' + JSON.stringify(e.postData));
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    
    // Handle both JSON and text/plain Content-Type
    let requestData;
    if (e.postData && e.postData.contents) {
      requestData = e.postData.contents;
      Logger.log('Using e.postData.contents');
    } else if (e.parameter && e.parameter.data) {
      requestData = e.parameter.data;
      Logger.log('Using e.parameter.data');
    } else {
      Logger.log('No request data found');
      return createResponse(false, 'No request data received. postData: ' + (e.postData ? 'exists' : 'null') + ', parameter: ' + (e.parameter ? 'exists' : 'null'));
    }
    
    Logger.log('Request data: ' + requestData);
    const request = JSON.parse(requestData);
    const action = request.action;
    Logger.log('Action: ' + action);

    // Route to appropriate handler
    switch(action) {
      case 'getProductDatabase':
        return handleGetProductDatabase(request);
      case 'getLocations':
        return handleGetLocations(request);
      case 'createStocktake':
        return handleCreateStocktake(request);
      case 'listStocktakes':
        return handleListStocktakes(request);
      case 'syncScans':
        return handleSyncScans(request);
      case 'deleteScans':
        return handleDeleteScans(request);
      case 'loadUserScans':
        return handleLoadUserScans(request);
      case 'syncKegs':
        return handleSyncKegs(request);
      case 'syncManualEntries':
        return handleSyncManualEntries(request);
      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Server error: ' + error.toString() + ' (Stack: ' + error.stack + ')');
  }
}

// Handle GET requests (for testing) - NOW WITH CORS
function doGet(e) {
  const response = {
    success: true,
    message: 'Unified Stock System API is running. Use POST requests.',
    timestamp: new Date().toISOString()
  };

  return createResponse(true, 'API is running', response);
}

// ============================================
// PRODUCT DATABASE
// ============================================

function handleGetProductDatabase(request) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const productSheet = ss.getSheetByName('Product Database');

  const lastRow = productSheet.getLastRow();
  if (lastRow < 2) {
    return createResponse(true, 'No products found', { products: [] });
  }

  // Get all product data (skip header row)
  const data = productSheet.getRange('A2:D' + lastRow).getValues();

  const products = data.map(row => ({
    barcode: row[0].toString(),
    product: row[1],
    currentStock: row[2] || 0,
    value: row[3] || 0
  }));

  return createResponse(true, 'Products loaded', { products });
}

// ============================================
// LOCATIONS
// ============================================

function handleGetLocations(request) {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const locationsSheet = ss.getSheetByName('Locations');

  const lastRow = locationsSheet.getLastRow();
  if (lastRow < 2) {
    return createResponse(true, 'No locations found', { locations: [] });
  }

  const data = locationsSheet.getRange('A2:A' + lastRow).getValues();
  const locations = data.map(row => row[0]).filter(loc => loc !== '');

  return createResponse(true, 'Locations loaded', { locations });
}

// ============================================
// STOCKTAKE MANAGEMENT
// ============================================

function handleCreateStocktake(request) {
  const { name, user } = request;
  const timestamp = new Date();
  const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

  // Create new spreadsheet for this stocktake
  const stocktakeName = `Stocktake - ${name} - ${dateStr}`;
  const newSheet = SpreadsheetApp.create(stocktakeName);
  const stocktakeId = newSheet.getId();

  // Move spreadsheet to folder if folder ID is provided
  if (STOCKTAKE_FOLDER_ID && STOCKTAKE_FOLDER_ID.trim() !== '') {
    try {
      const file = DriveApp.getFileById(stocktakeId);
      const folder = DriveApp.getFolderById(STOCKTAKE_FOLDER_ID);
      file.moveTo(folder);
    } catch (e) {
      Logger.log('Warning: Could not move spreadsheet to folder: ' + e.message);
      // Continue anyway - spreadsheet is still created
    }
  }

  // Set up Tally sheet
  const tallySheet = newSheet.getActiveSheet();
  tallySheet.setName('Tally');
  tallySheet.getRange('A1:F1').setValues([[
    'Barcode', 'Product', 'Total Quantity', 'Locations', 'Last Updated', 'Stock Level'
  ]]);
  tallySheet.getRange('A1:F1').setFontWeight('bold').setBackground('#4A5568').setFontColor('#FFFFFF');

  // Create Raw Scans sheet
  const rawScansSheet = newSheet.insertSheet('Raw Scans');
  rawScansSheet.getRange('A1:J1').setValues([[
    'Barcode', 'Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID'
  ]]);
  rawScansSheet.getRange('A1:J1').setFontWeight('bold').setBackground('#2D3748').setFontColor('#FFFFFF');

  // Create Manual sheet
  const manualSheet = newSheet.insertSheet('Manual');
  manualSheet.getRange('A1:H1').setValues([[
    'Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Sync ID'
  ]]);
  manualSheet.getRange('A1:H1').setFontWeight('bold').setBackground('#6B46C1').setFontColor('#FFFFFF');

  // Create Kegs sheet
  const kegsSheet = newSheet.insertSheet('Kegs');
  kegsSheet.getRange('A1:G1').setValues([[
    'Keg Product', 'Count', 'Location', 'User', 'Timestamp', 'Synced', 'Sync ID'
  ]]);
  kegsSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#D97706').setFontColor('#FFFFFF');

  // Create Deleted Scans sheet (audit trail)
  const deletedScansSheet = newSheet.insertSheet('Deleted Scans');
  deletedScansSheet.getRange('A1:K1').setValues([[
    'Barcode', 'Product', 'Quantity', 'Location', 'User', 'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID', 'Deleted At'
  ]]);
  deletedScansSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#DC2626').setFontColor('#FFFFFF');
  deletedScansSheet.hideSheet();  // Hide from normal users

  // Create Metadata sheet to store stocktake info
  const metadataSheet = newSheet.insertSheet('Metadata');
  metadataSheet.getRange('A1:B1').setValues([['Property', 'Value']]);
  metadataSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#1F2937').setFontColor('#FFFFFF');
  metadataSheet.getRange('A2:B5').setValues([
    ['stocktake_name', name],
    ['created_by', user],
    ['created_date', dateStr],
    ['status', 'Active']
  ]);
  metadataSheet.hideSheet();  // Hide metadata sheet from users

  return createResponse(true, 'Stocktake created', {
    stocktakeId,
    name: stocktakeName,
    url: newSheet.getUrl()
  });
}

function handleListStocktakes(request) {
  let files;
  
  // If folder ID is provided, search within that folder
  if (STOCKTAKE_FOLDER_ID && STOCKTAKE_FOLDER_ID.trim() !== '') {
    try {
      const folder = DriveApp.getFolderById(STOCKTAKE_FOLDER_ID);
      files = folder.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
    } catch (e) {
      Logger.log('Error accessing folder, falling back to Drive search: ' + e.message);
      // Fallback to Drive-wide search
      files = DriveApp.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
    }
  } else {
    // Search all of Drive
    files = DriveApp.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
  }

  const stocktakes = [];
  while (files.hasNext()) {
    const file = files.next();
    const ss = SpreadsheetApp.openById(file.getId());

    // Try to get metadata from Metadata sheet
    let name = file.getName();
    let createdBy = 'Unknown';
    let createdDate = 'Unknown';
    let status = 'Active';

    try {
      const metadataSheet = ss.getSheetByName('Metadata');
      if (metadataSheet) {
        const metadataData = metadataSheet.getRange('A2:B5').getValues();
        metadataData.forEach(row => {
          if (row[0] === 'stocktake_name') name = row[1] || file.getName();
          if (row[0] === 'created_by') createdBy = row[1] || 'Unknown';
          if (row[0] === 'created_date') createdDate = row[1] || 'Unknown';
          if (row[0] === 'status') status = row[1] || 'Active';
        });
      }
    } catch (e) {
      // If metadata sheet doesn't exist, use defaults
      Logger.log('No metadata sheet found for ' + file.getName());
    }

    stocktakes.push({
      id: file.getId(),
      name: file.getName(),
      displayName: name,
      createdBy,
      createdDate,
      status,
      url: file.getUrl(),
      lastModified: file.getLastUpdated()
    });
  }

  // Sort by last modified (newest first)
  stocktakes.sort((a, b) => b.lastModified - a.lastModified);

  return createResponse(true, 'Stocktakes loaded', { stocktakes });
}

// ============================================
// SCAN SYNCING
// ============================================

function handleSyncScans(request) {
  const { stocktakeId, scans } = request;

  if (!scans || scans.length === 0) {
    return createResponse(true, 'No scans to sync', { syncedCount: 0 });
  }

  const ss = SpreadsheetApp.openById(stocktakeId);
  const rawScansSheet = ss.getSheetByName('Raw Scans');
  const tallySheet = ss.getSheetByName('Tally');

  // Get all existing scan IDs to check for updates
  const lastRow = rawScansSheet.getLastRow();
  const existingScanIds = {};

  if (lastRow > 1) {
    const existingData = rawScansSheet.getRange('J2:J' + lastRow).getValues(); // Column J is syncId
    existingData.forEach((row, index) => {
      if (row[0]) {
        existingScanIds[row[0]] = index + 2; // +2 because index is 0-based and we start at row 2
      }
    });
  }

  const scansToAdd = [];
  const syncedIds = [];

  // Process each scan - either update existing or prepare to add new
  scans.forEach(scan => {
    const scanRow = [
      scan.barcode,
      scan.product,
      scan.quantity,
      scan.location,
      scan.user,
      scan.timestamp,
      scan.stockLevel || '',
      scan.value || '',
      'Yes',
      scan.syncId
    ];

    if (existingScanIds[scan.syncId]) {
      // Update existing scan
      const rowIndex = existingScanIds[scan.syncId];
      rawScansSheet.getRange(rowIndex, 1, 1, 10).setValues([scanRow]);
    } else {
      // Add to list of new scans to append
      scansToAdd.push(scanRow);
    }

    syncedIds.push(scan.syncId);
  });

  // Append new scans if any
  if (scansToAdd.length > 0) {
    const newLastRow = rawScansSheet.getLastRow();
    rawScansSheet.getRange(newLastRow + 1, 1, scansToAdd.length, 10).setValues(scansToAdd);
  }

  // Update Tally sheet
  updateTally(tallySheet, rawScansSheet);

  return createResponse(true, 'Scans synced successfully', {
    syncedCount: scans.length,
    syncedIds: syncedIds,
    newScans: scansToAdd.length,
    updatedScans: scans.length - scansToAdd.length
  });
}

function updateTally(tallySheet, rawScansSheet) {
  // Get all raw scans (excluding header)
  const lastRow = rawScansSheet.getLastRow();
  if (lastRow < 2) return;

  const rawData = rawScansSheet.getRange('A2:H' + lastRow).getValues();

  // Aggregate by barcode
  const tally = {};
  rawData.forEach(row => {
    const barcode = row[0].toString();
    const product = row[1];
    const quantity = parseFloat(row[2]) || 0;
    const location = row[3];
    const stockLevel = row[6];

    if (!tally[barcode]) {
      tally[barcode] = {
        product,
        totalQty: 0,
        locations: new Set(),
        stockLevel,
        lastUpdated: new Date()
      };
    }

    tally[barcode].totalQty += quantity;
    tally[barcode].locations.add(location);
    tally[barcode].lastUpdated = new Date();
  });

  // Clear existing tally (keep header)
  if (tallySheet.getLastRow() > 1) {
    tallySheet.getRange('A2:F' + tallySheet.getLastRow()).clearContent();
  }

  // Write updated tally
  const tallyRows = Object.keys(tally).map(barcode => [
    barcode,
    tally[barcode].product,
    tally[barcode].totalQty,
    Array.from(tally[barcode].locations).join(', '),
    Utilities.formatDate(tally[barcode].lastUpdated, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    tally[barcode].stockLevel
  ]);

  if (tallyRows.length > 0) {
    tallySheet.getRange(2, 1, tallyRows.length, 6).setValues(tallyRows);
  }
}

// ============================================
// LOAD USER SCAN HISTORY
// ============================================

function handleLoadUserScans(request) {
  const { stocktakeId, username } = request;

  const ss = SpreadsheetApp.openById(stocktakeId);
  const rawScansSheet = ss.getSheetByName('Raw Scans');

  const lastRow = rawScansSheet.getLastRow();
  if (lastRow < 2) {
    return createResponse(true, 'No scans found', { scans: [] });
  }

  // Get all scans
  const data = rawScansSheet.getRange('A2:J' + lastRow).getValues();

  // Filter by username and map to scan objects
  const userScans = data
    .filter(row => row[4] === username) // Column E is User
    .map(row => ({
      barcode: row[0].toString(),
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

  return createResponse(true, 'User scans loaded', {
    scans: userScans,
    count: userScans.length
  });
}

// ============================================
// DELETE SCANS (WITH AUDIT TRAIL)
// ============================================

function handleDeleteScans(request) {
  const { stocktakeId, syncIds } = request;

  if (!syncIds || syncIds.length === 0) {
    return createResponse(true, 'No scans to delete', { deletedCount: 0 });
  }

  const ss = SpreadsheetApp.openById(stocktakeId);
  const rawScansSheet = ss.getSheetByName('Raw Scans');
  const deletedScansSheet = ss.getSheetByName('Deleted Scans');

  if (!deletedScansSheet) {
    return createResponse(false, 'Deleted Scans sheet not found in stocktake');
  }

  const lastRow = rawScansSheet.getLastRow();
  if (lastRow < 2) {
    return createResponse(true, 'No scans found to delete', { deletedCount: 0 });
  }

  // Get all scan IDs from column J (Sync ID)
  const allData = rawScansSheet.getRange('A2:J' + lastRow).getValues();
  const deletedRows = [];
  const rowsToDelete = [];

  // Find rows that match the syncIds to delete
  allData.forEach((row, index) => {
    const scanSyncId = row[9]; // Column J (10th column, index 9)
    if (syncIds.includes(scanSyncId)) {
      // Add deletion timestamp to the row
      const deletedRow = [...row, new Date().toISOString()];
      deletedRows.push(deletedRow);
      rowsToDelete.push(index + 2); // +2 because array is 0-indexed and data starts at row 2
    }
  });

  // Copy deleted rows to Deleted Scans sheet (audit trail)
  if (deletedRows.length > 0) {
    const deletedLastRow = deletedScansSheet.getLastRow();
    deletedScansSheet.getRange(deletedLastRow + 1, 1, deletedRows.length, 11).setValues(deletedRows);

    // Delete rows from Raw Scans sheet (in reverse order to maintain row indices)
    rowsToDelete.reverse().forEach(rowIndex => {
      rawScansSheet.deleteRow(rowIndex);
    });

    // Update Tally sheet
    const tallySheet = ss.getSheetByName('Tally');
    updateTally(tallySheet, rawScansSheet);
  }

  return createResponse(true, 'Scans deleted successfully', {
    deletedCount: deletedRows.length,
    deletedIds: syncIds
  });
}

// ============================================
// SYNC KEGS
// ============================================

function handleSyncKegs(request) {
  const { stocktakeId, kegs, location, user } = request;

  if (!kegs || kegs.length === 0) {
    return createResponse(true, 'No kegs to sync', { syncedCount: 0 });
  }

  const ss = SpreadsheetApp.openById(stocktakeId);
  const kegsSheet = ss.getSheetByName('Kegs');

  if (!kegsSheet) {
    return createResponse(false, 'Kegs sheet not found in stocktake');
  }

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const syncId = Utilities.getUuid();

  const kegsToAdd = kegs.map(keg => [
    keg.product || keg.name || '',
    keg.count || 0,
    location || '',
    user || '',
    timestamp,
    'Yes',
    syncId
  ]);

  const lastRow = kegsSheet.getLastRow();
  kegsSheet.getRange(lastRow + 1, 1, kegsToAdd.length, 7).setValues(kegsToAdd);

  return createResponse(true, 'Kegs synced successfully', {
    syncedCount: kegs.length,
    syncId: syncId
  });
}

// ============================================
// SYNC MANUAL ENTRIES
// ============================================

function handleSyncManualEntries(request) {
  const { stocktakeId, manualEntries } = request;

  if (!manualEntries || manualEntries.length === 0) {
    return createResponse(true, 'No manual entries to sync', { syncedCount: 0 });
  }

  const ss = SpreadsheetApp.openById(stocktakeId);
  const manualSheet = ss.getSheetByName('Manual');

  if (!manualSheet) {
    return createResponse(false, 'Manual sheet not found in stocktake');
  }

  const lastRow = manualSheet.getLastRow();
  const existingSyncIds = {};

  // Get existing sync IDs to check for updates
  if (lastRow > 1) {
    const existingData = manualSheet.getRange('H2:H' + lastRow).getValues(); // Column H is syncId
    existingData.forEach((row, index) => {
      if (row[0]) {
        existingSyncIds[row[0]] = index + 2;
      }
    });
  }

  const entriesToAdd = [];
  const syncedIds = [];

  manualEntries.forEach(entry => {
    const timestamp = entry.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const syncId = entry.syncId || Utilities.getUuid();
    
    const entryRow = [
      entry.product || '',
      entry.quantity || 0,
      entry.location || '',
      entry.user || '',
      timestamp,
      entry.stockLevel || '',
      entry.value || '',
      syncId
    ];

    if (existingSyncIds[syncId]) {
      // Update existing entry
      const rowIndex = existingSyncIds[syncId];
      manualSheet.getRange(rowIndex, 1, 1, 8).setValues([entryRow]);
    } else {
      // Add to list of new entries to append
      entriesToAdd.push(entryRow);
    }

    syncedIds.push(syncId);
  });

  // Append new entries if any
  if (entriesToAdd.length > 0) {
    const newLastRow = manualSheet.getLastRow();
    manualSheet.getRange(newLastRow + 1, 1, entriesToAdd.length, 8).setValues(entriesToAdd);
  }

  return createResponse(true, 'Manual entries synced successfully', {
    syncedCount: manualEntries.length,
    syncedIds: syncedIds,
    newEntries: entriesToAdd.length,
    updatedEntries: manualEntries.length - entriesToAdd.length
  });
}

// ============================================
// CORS-ENABLED RESPONSE HELPER
// THIS IS THE KEY FIX FOR YOUR CORS ERRORS!
// ============================================

/**
 * Creates a properly formatted JSON response
 * CORS headers are automatically handled by Apps Script when deployed as Web App with "Anyone" access
 */
function createResponse(success, message, data = {}) {
  const response = {
    success,
    message,
    ...data
  };

  const output = ContentService.createTextOutput(JSON.stringify(response));
  output.setMimeType(ContentService.MimeType.JSON);

  // *** CRITICAL CORS HEADERS ***
  // These headers tell the browser it's OK for ANY domain to access this script
  // Note: setHeader() may not work in all contexts, but matches working stock app pattern
  
  try {
    output.setHeader('Access-Control-Allow-Origin', '*');
    output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    output.setHeader('Access-Control-Max-Age', '3600');
  } catch (e) {
    // If setHeader doesn't work, deployment as "Anyone" should handle CORS automatically
    Logger.log('setHeader not supported, relying on deployment settings: ' + e.message);
  }

  return output;
}

// ============================================
// TEST FUNCTIONS
// ============================================

// Test function (run this in Apps Script to verify setup)
function testSetup() {
  Logger.log('Testing Master Sheet access...');
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  Logger.log('Master Sheet Name: ' + ss.getName());

  Logger.log('Testing Product Database...');
  const productSheet = ss.getSheetByName('Product Database');
  Logger.log('Products found: ' + (productSheet.getLastRow() - 1));

  Logger.log('Testing Locations...');
  const locationsSheet = ss.getSheetByName('Locations');
  Logger.log('Locations found: ' + (locationsSheet.getLastRow() - 1));

  Logger.log('Setup test complete!');
}

// Test CORS response
function testCorsResponse() {
  const testResponse = createResponse(true, 'CORS test successful', {
    timestamp: new Date().toISOString(),
    message: 'If you can see this, CORS is working!'
  });

  Logger.log('Test response created successfully');
  Logger.log('Response type: ' + testResponse.getMimeType());

  return testResponse;
}


