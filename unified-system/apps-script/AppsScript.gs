// Stock Wizard - Google Apps Script Backend
// Handles file operations: creating spreadsheets, syncing data, listing stocktakes

const MASTER_SHEET_ID = '1e3rsYW4RoEpxpH8ZMckLP7VdtnpbbfQpd8N_NB9fRgM';
const STOCKTAKE_FOLDER_ID = '1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE';

// ============================================
// HTTP HANDLERS
// ============================================

function doPost(e) {
  try {
    if (!e?.postData?.contents) {
      return jsonResponse(false, 'No request data');
    }
    
    const request = JSON.parse(e.postData.contents);
    if (!request.action) {
      return jsonResponse(false, 'Missing action');
    }
    
    const handlers = {
      getProductDatabase: () => getProductDatabase(),
      getLocations: () => getLocations(),
      createStocktake: () => createStocktake(request),
      listStocktakes: () => listStocktakes(request),
      syncScans: () => syncScans(request),
      deleteScans: () => deleteScans(request),
      loadUserScans: () => loadUserScans(request),
      syncKegs: () => syncKegs(request),
      syncManualEntries: () => syncManualEntries(request)
    };
    
    const handler = handlers[request.action];
    if (!handler) {
      return jsonResponse(false, 'Unknown action: ' + request.action);
    }
    
    return handler();
  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

function doGet(e) {
  return jsonResponse(true, 'API is running', { timestamp: new Date().toISOString() });
}

// ============================================
// RESPONSE HELPERS
// ============================================

function jsonResponse(success, message, data = {}) {
  const response = {
    success: success,
    ok: success,
    message: message,
    ...data
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// PRODUCT DATABASE & LOCATIONS
// ============================================

function getProductDatabase() {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('Product Database');
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return jsonResponse(true, 'No products found', { products: [] });
    }
    
    const data = sheet.getRange('A2:D' + lastRow).getValues();
    const products = data.map(row => ({
      barcode: String(row[0] || ''),
      product: row[1] || '',
      currentStock: row[2] || 0,
      value: row[3] || 0
    }));
    
    return jsonResponse(true, 'Products loaded', { products });
  } catch (error) {
    return jsonResponse(false, 'Error loading products: ' + error.toString());
  }
}

function getLocations() {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('Locations');
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return jsonResponse(true, 'No locations found', { locations: [] });
    }
    
    const data = sheet.getRange('A2:A' + lastRow).getValues();
    const locations = data.map(row => row[0]).filter(loc => loc);
    
    return jsonResponse(true, 'Locations loaded', { locations });
  } catch (error) {
    return jsonResponse(false, 'Error loading locations: ' + error.toString());
  }
}

// ============================================
// STOCKTAKE MANAGEMENT
// ============================================

function createStocktake(request) {
  try {
    if (!request.name || !request.user) {
      return jsonResponse(false, 'Missing name or user');
    }
    
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const stocktakeName = `Stocktake - ${request.name} - ${dateStr}`;
    const ss = SpreadsheetApp.create(stocktakeName);
    const stocktakeId = ss.getId();
    
    // Move to folder if specified
    const folderId = request.folderId || STOCKTAKE_FOLDER_ID;
    if (folderId) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        DriveApp.getFileById(stocktakeId).moveTo(folder);
      } catch (e) {
        // Continue if folder move fails
      }
    }
    
    // Setup sheets
    setupStocktakeSheets(ss, request.name, request.user, dateStr);
    
    return jsonResponse(true, 'Stocktake created', {
      stocktakeId: stocktakeId,
      name: stocktakeName,
      url: ss.getUrl()
    });
  } catch (error) {
    return jsonResponse(false, 'Error creating stocktake: ' + error.toString());
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
  
  // Set metadata
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

function listStocktakes(request) {
  try {
    const folderId = request.folderId || STOCKTAKE_FOLDER_ID;
    let files;
    
    if (folderId) {
      try {
        files = DriveApp.getFolderById(folderId)
          .searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
      } catch (e) {
        files = DriveApp.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
      }
    } else {
      files = DriveApp.searchFiles('name contains "Stocktake -" and mimeType = "application/vnd.google-apps.spreadsheet"');
    }
    
    const stocktakes = [];
    while (files.hasNext()) {
      try {
        const file = files.next();
        const ss = SpreadsheetApp.openById(file.getId());
        const metadata = getMetadata(ss);
        
        stocktakes.push({
          id: file.getId(),
          name: file.getName(),
          displayName: metadata.name || file.getName(),
          createdBy: metadata.createdBy || 'Unknown',
          createdDate: metadata.createdDate || 'Unknown',
          status: metadata.status || 'Active',
          url: file.getUrl(),
          lastModified: file.getLastUpdated()
        });
      } catch (e) {
        continue; // Skip inaccessible files
      }
    }
    
    stocktakes.sort((a, b) => b.lastModified - a.lastModified);
    return jsonResponse(true, 'Stocktakes loaded', { stocktakes });
  } catch (error) {
    return jsonResponse(false, 'Error listing stocktakes: ' + error.toString());
  }
}

function getMetadata(ss) {
  try {
    const sheet = ss.getSheetByName('Metadata');
    if (!sheet) return {};
    
    const data = sheet.getRange('A2:B5').getValues();
    const metadata = {};
    data.forEach(row => {
      if (row[0] === 'stocktake_name') metadata.name = row[1];
      if (row[0] === 'created_by') metadata.createdBy = row[1];
      if (row[0] === 'created_date') metadata.createdDate = row[1];
      if (row[0] === 'status') metadata.status = row[1];
    });
    return metadata;
  } catch (e) {
    return {};
  }
}

// ============================================
// SCAN SYNCING
// ============================================

function syncScans(request) {
  try {
    if (!request.scans || request.scans.length === 0) {
      return jsonResponse(true, 'No scans to sync', { syncedCount: 0 });
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const rawSheet = ss.getSheetByName('Raw Scans');
    const tallySheet = ss.getSheetByName('Tally');
    
    // Get existing sync IDs
    const lastRow = rawSheet.getLastRow();
    const existingIds = {};
    if (lastRow > 1) {
      const syncIds = rawSheet.getRange('J2:J' + lastRow).getValues();
      syncIds.forEach((row, i) => {
        if (row[0]) existingIds[row[0]] = i + 2;
      });
    }
    
    const toAdd = [];
    const syncedIds = [];
    
    request.scans.forEach(scan => {
      const row = [
        scan.barcode, scan.product, scan.quantity, scan.location,
        scan.user, scan.timestamp, scan.stockLevel || '', scan.value || '',
        'Yes', scan.syncId
      ];
      
      if (existingIds[scan.syncId]) {
        rawSheet.getRange(existingIds[scan.syncId], 1, 1, 10).setValues([row]);
      } else {
        toAdd.push(row);
      }
      syncedIds.push(scan.syncId);
    });
    
    if (toAdd.length > 0) {
      rawSheet.getRange(rawSheet.getLastRow() + 1, 1, toAdd.length, 10).setValues(toAdd);
    }
    
    updateTally(tallySheet, rawSheet);
    
    return jsonResponse(true, 'Scans synced', {
      syncedCount: request.scans.length,
      syncedIds: syncedIds,
      newScans: toAdd.length,
      updatedScans: request.scans.length - toAdd.length
    });
  } catch (error) {
    return jsonResponse(false, 'Error syncing scans: ' + error.toString());
  }
}

function updateTally(tallySheet, rawSheet) {
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
}

function loadUserScans(request) {
  try {
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Raw Scans');
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return jsonResponse(true, 'No scans found', { scans: [] });
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
    
    return jsonResponse(true, 'User scans loaded', { scans, count: scans.length });
  } catch (error) {
    return jsonResponse(false, 'Error loading scans: ' + error.toString());
  }
}

function deleteScans(request) {
  try {
    if (!request.syncIds || request.syncIds.length === 0) {
      return jsonResponse(true, 'No scans to delete', { deletedCount: 0 });
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const rawSheet = ss.getSheetByName('Raw Scans');
    const deletedSheet = ss.getSheetByName('Deleted Scans');
    
    if (!deletedSheet || rawSheet.getLastRow() < 2) {
      return jsonResponse(true, 'No scans found', { deletedCount: 0 });
    }
    
    const data = rawSheet.getRange('A2:J' + rawSheet.getLastRow()).getValues();
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
    
    return jsonResponse(true, 'Scans deleted', { deletedCount: toDelete.length, deletedIds: request.syncIds });
  } catch (error) {
    return jsonResponse(false, 'Error deleting scans: ' + error.toString());
  }
}

// ============================================
// KEGS & MANUAL ENTRIES
// ============================================

function syncKegs(request) {
  try {
    if (!request.kegs || request.kegs.length === 0) {
      return jsonResponse(true, 'No kegs to sync', { syncedCount: 0 });
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Kegs');
    if (!sheet) {
      return jsonResponse(false, 'Kegs sheet not found');
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
    return jsonResponse(true, 'Kegs synced', { syncedCount: request.kegs.length, syncId });
  } catch (error) {
    return jsonResponse(false, 'Error syncing kegs: ' + error.toString());
  }
}

function syncManualEntries(request) {
  try {
    if (!request.manualEntries || request.manualEntries.length === 0) {
      return jsonResponse(true, 'No manual entries to sync', { syncedCount: 0 });
    }
    
    const ss = SpreadsheetApp.openById(request.stocktakeId);
    const sheet = ss.getSheetByName('Manual');
    if (!sheet) {
      return jsonResponse(false, 'Manual sheet not found');
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
        sheet.getRange(existingIds[syncId], 1, 1, 8).setValues([row]);
      } else {
        toAdd.push(row);
      }
      syncedIds.push(syncId);
    });
    
    if (toAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 8).setValues(toAdd);
    }
    
    return jsonResponse(true, 'Manual entries synced', {
      syncedCount: request.manualEntries.length,
      syncedIds: syncedIds,
      newEntries: toAdd.length,
      updatedEntries: request.manualEntries.length - toAdd.length
    });
  } catch (error) {
    return jsonResponse(false, 'Error syncing manual entries: ' + error.toString());
  }
}
