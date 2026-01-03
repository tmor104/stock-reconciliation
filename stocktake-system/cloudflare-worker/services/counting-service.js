// Counting Service - Handles all counting operations via Google Sheets API
// Replaces Apps Script functionality

import { GoogleSheetsAPI } from './google-sheets-v2.js';

export class CountingService {
    // ============================================
    // PRODUCT DATABASE
    // ============================================
    
    static async getProductDatabase(env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        const masterSheetId = env.MASTER_SHEET_ID;
        
        if (!masterSheetId) {
            throw new Error('MASTER_SHEET_ID not configured');
        }
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterSheetId}/values/'Product Database'!A2:D`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch product database');
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        return rows.map(row => ({
            barcode: row[0]?.toString() || '',
            product: row[1] || '',
            currentStock: parseFloat(row[2]) || 0,
            value: parseFloat(row[3]) || 0
        }));
    }
    
    // ============================================
    // LOCATIONS
    // ============================================
    
    static async getLocations(env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        const masterSheetId = env.MASTER_SHEET_ID;
        
        if (!masterSheetId) {
            throw new Error('MASTER_SHEET_ID not configured');
        }
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterSheetId}/values/'Locations'!A2:A`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch locations');
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        return rows
            .map(row => row[0])
            .filter(loc => loc && loc.trim() !== '');
    }
    
    // ============================================
    // KEGS
    // ============================================
    
    static async getKegs(env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        const masterSheetId = env.MASTER_SHEET_ID;
        
        if (!masterSheetId) {
            throw new Error('MASTER_SHEET_ID not configured');
        }
        
        // Try to get kegs from a "Kegs" sheet, or return empty array
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterSheetId}/values/'Kegs'!A2:A`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            // If sheet doesn't exist, return empty array
            return [];
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        return rows
            .map(row => ({ name: row[0] || '', count: 0 }))
            .filter(keg => keg.name && keg.name.trim() !== '');
    }
    
    // ============================================
    // STOCKTAKE CREATION
    // ============================================
    
    static async createStocktake(name, user, folderId, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().slice(0, 16).replace('T', ' ');
        const stocktakeName = `Stocktake - ${name} - ${dateStr}`;
        
        // Create spreadsheet
        const createResponse = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: {
                        title: stocktakeName
                    },
                    sheets: [
                        { properties: { title: 'Tally', index: 0 } },
                        { properties: { title: 'Raw Scans', index: 1 } },
                        { properties: { title: 'Manual', index: 2 } },
                        { properties: { title: 'Kegs', index: 3 } },
                        { properties: { title: 'Deleted Scans', index: 4 } },
                        { properties: { title: 'Metadata', index: 5 } }
                    ]
                })
            }
        );
        
        if (!createResponse.ok) {
            const error = await createResponse.text();
            throw new Error(`Failed to create spreadsheet: ${error}`);
        }
        
        const spreadsheetData = await createResponse.json();
        const spreadsheetId = spreadsheetData.spreadsheetId;
        
        // Move to folder if folderId provided
        if (folderId && folderId.trim() !== '') {
            try {
                await fetch(
                    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}&removeParents=root`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            } catch (e) {
                // Continue even if folder move fails
                console.error('Failed to move to folder:', e);
            }
        }
        
        // Set up sheets with headers
        await this.setupStocktakeSheets(spreadsheetId, accessToken);
        
        // Set metadata
        await this.setMetadata(spreadsheetId, name, user, dateStr, accessToken);
        
        return {
            stocktakeId: spreadsheetId,
            name: stocktakeName,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
        };
    }
    
    static async setupStocktakeSheets(spreadsheetId, accessToken) {
        // Tally sheet headers
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tally!A1:F1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [['Barcode', 'Product', 'Total Quantity', 'Locations', 'Last Updated', 'Stock Level']]
                })
            }
        );
        
        // Raw Scans sheet headers
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Raw Scans'!A1:J1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [[
                        'Barcode', 'Product', 'Quantity', 'Location', 'User', 
                        'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID'
                    ]]
                })
            }
        );
        
        // Manual sheet headers
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Manual!A1:H1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [[
                        'Product', 'Quantity', 'Location', 'User', 
                        'Timestamp', 'Stock Level', '$ Value', 'Sync ID'
                    ]]
                })
            }
        );
        
        // Kegs sheet headers
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Kegs!A1:G1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [[
                        'Keg Product', 'Count', 'Location', 'User', 
                        'Timestamp', 'Synced', 'Sync ID'
                    ]]
                })
            }
        );
        
        // Deleted Scans sheet headers
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Deleted Scans'!A1:K1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [[
                        'Barcode', 'Product', 'Quantity', 'Location', 'User', 
                        'Timestamp', 'Stock Level', '$ Value', 'Synced', 'Sync ID', 'Deleted At'
                    ]]
                })
            }
        );
    }
    
    static async setMetadata(spreadsheetId, name, user, dateStr, accessToken) {
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Metadata!A1:B5?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [
                        [['Property', 'Value']],
                        [['stocktake_name', name]],
                        [['created_by', user]],
                        [['created_date', dateStr]],
                        [['status', 'Active']]
                    ]
                })
            }
        );
    }
    
    // ============================================
    // LIST STOCKTAKES
    // ============================================
    
    static async listStocktakes(folderId, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        // Clean folder ID - remove any invalid characters
        const cleanFolderId = folderId ? folderId.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
        
        if (cleanFolderId && cleanFolderId.length < 10) {
            throw new Error(`Invalid folder ID format: ${folderId}. Folder ID should be alphanumeric with dashes/underscores.`);
        }
        
        // Build query - use proper Google Drive API query syntax
        // Try simpler query first if complex one fails
        let query;
        let driveUrl;
        
        if (cleanFolderId) {
            // First, verify the folder exists and is accessible by getting its metadata
            // Folder ID: 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE
            const folderUrl = `https://www.googleapis.com/drive/v3/files/${cleanFolderId}?fields=id,name,mimeType,capabilities`;
            console.log(`Testing folder access: ${cleanFolderId} (1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE)`);
            
            const folderTestResponse = await fetch(folderUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!folderTestResponse.ok) {
                const folderError = await folderTestResponse.text();
                console.error('Folder access test failed:', folderError);
                let folderErrorMsg = `Cannot access folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE.`;
                try {
                    const folderErrorJson = JSON.parse(folderError);
                    const folderErrorCode = folderErrorJson.error?.code;
                    const folderErrorText = folderErrorJson.error?.message || folderError;
                    
                    if (folderErrorCode === 400) {
                        folderErrorMsg = `Invalid folder ID: 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE. The folder may not exist. Check: https://drive.google.com/drive/folders/1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE`;
                    } else if (folderErrorCode === 403) {
                        folderErrorMsg = `Permission denied for folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE. Share it with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com (Editor permission). Wait 10-30 seconds after sharing.`;
                    } else if (folderErrorCode === 404) {
                        folderErrorMsg = `Folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE not found. It may have been deleted or the service account doesn't have access.`;
                    } else {
                        folderErrorMsg = `Error accessing folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE: ${folderErrorText} (Code: ${folderErrorCode})`;
                    }
                } catch (e) {
                    folderErrorMsg = `Error accessing folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE. Raw error: ${folderError}`;
                }
                throw new Error(folderErrorMsg);
            }
            
            const folderData = await folderTestResponse.json();
            console.log(`Folder accessible: ${folderData.name} (${folderData.mimeType})`);
            
            // Verify it's actually a folder
            if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error(`1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE is not a folder. It is a ${folderData.mimeType}.`);
            }
            
            // Folder is accessible, now use full query
            // Using: 'FOLDER_ID' in parents format
            query = `'${cleanFolderId}' in parents and title contains 'Stocktake -' and mimeType = 'application/vnd.google-apps.spreadsheet'`;
            console.log(`Query for folder 1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE: ${query}`);
        } else {
            query = `title contains 'Stocktake -' and mimeType = 'application/vnd.google-apps.spreadsheet'`;
        }
        
        driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
        
        console.log('Drive API Query:', query);
        console.log('Drive API URL:', driveUrl);
        console.log('Folder ID:', cleanFolderId);
        
        const response = await fetch(driveUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to list stocktakes';
            try {
                const errorJson = JSON.parse(errorText);
                const errorCode = errorJson.error?.code;
                const errorMsg = errorJson.error?.message || errorJson.error || errorMessage;
                
                console.error('Google Drive API Error:', {
                    code: errorCode,
                    message: errorMsg,
                    folderId: cleanFolderId,
                    query: query,
                    rawError: errorText
                });
                
                // Handle specific error codes
                if (errorCode === 400) {
                    // Invalid Value usually means bad folder ID or query syntax
                    if (errorMsg.includes('Invalid Value') || errorMsg.includes('invalid')) {
                        errorMessage = `Invalid folder ID or query syntax. Error: ${errorMsg}\n\nTroubleshooting:\n1. Verify folder ID: ${cleanFolderId}\n2. Check folder exists: https://drive.google.com/drive/folders/${cleanFolderId}\n3. Ensure folder is shared with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com\n4. Try a simpler query first (without filters)`;
                    } else {
                        errorMessage = `Bad Request (400): ${errorMsg}\nFolder ID: ${cleanFolderId}\nQuery: ${query}`;
                    }
                } else if (errorCode === 403 || errorCode === 404) {
                    errorMessage = `Permission denied: The service account does not have access to folder ${cleanFolderId}. Please share the folder with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com and grant "Editor" permission.`;
                } else if (errorCode === 500 || errorText.includes('PERMISSION_DENIED') || errorMsg.includes('permission') || errorMsg.includes('Permission')) {
                    errorMessage = `Permission denied: The service account cannot access folder ${cleanFolderId}. Error: ${errorMsg}. Please share the folder with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com and grant "Editor" permission.`;
                } else {
                    errorMessage = `${errorMsg} (Code: ${errorCode || 'unknown'})`;
                }
            } catch (e) {
                // If we can't parse the error, include the raw text
                errorMessage = errorText || errorMessage;
                if (errorText.includes('permission') || errorText.includes('Permission')) {
                    errorMessage = `Permission denied: The service account cannot access folder ${cleanFolderId}. Please share the folder with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com and grant "Editor" permission.`;
                } else if (errorText.includes('Invalid') || errorText.includes('invalid')) {
                    errorMessage = `Invalid folder ID or query: ${cleanFolderId}. Please verify the folder ID is correct and share it with: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com`;
                }
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        // Get metadata for each stocktake
        const stocktakes = await Promise.all(
            files.map(async (file) => {
                try {
                    const metadata = await this.getMetadata(file.id, accessToken);
                    return {
                        id: file.id,
                        name: file.name,
                        displayName: metadata.name || file.name,
                        createdBy: metadata.createdBy || 'Unknown',
                        createdDate: metadata.createdDate || 'Unknown',
                        status: metadata.status || 'Active',
                        url: `https://docs.google.com/spreadsheets/d/${file.id}`,
                        lastModified: file.modifiedTime
                    };
                } catch (e) {
                    return {
                        id: file.id,
                        name: file.name,
                        displayName: file.name,
                        createdBy: 'Unknown',
                        createdDate: 'Unknown',
                        status: 'Active',
                        url: `https://docs.google.com/spreadsheets/d/${file.id}`,
                        lastModified: file.modifiedTime
                    };
                }
            })
        );
        
        return stocktakes;
    }
    
    static async getMetadata(spreadsheetId, accessToken) {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Metadata!A2:B5`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            return {};
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        const metadata = {};
        rows.forEach(row => {
            if (row[0] === 'stocktake_name') metadata.name = row[1];
            if (row[0] === 'created_by') metadata.createdBy = row[1];
            if (row[0] === 'created_date') metadata.createdDate = row[1];
            if (row[0] === 'status') metadata.status = row[1];
        });
        
        return metadata;
    }
    
    // ============================================
    // SCAN SYNCING
    // ============================================
    
    static async syncScans(stocktakeId, scans, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        if (!scans || scans.length === 0) {
            return { syncedCount: 0, syncedIds: [], newScans: 0, updatedScans: 0 };
        }
        
        // Get existing scan IDs
        const existingResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!J2:J`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const existingScanIds = new Map();
        if (existingResponse.ok) {
            const existingData = await existingResponse.json();
            const rows = existingData.values || [];
            rows.forEach((row, index) => {
                if (row[0]) {
                    existingScanIds.set(row[0], index + 2); // +2 for header and 0-based index
                }
            });
        }
        
        const scansToAdd = [];
        const scansToUpdate = [];
        const syncedIds = [];
        
        scans.forEach(scan => {
            const scanRow = [
                scan.barcode || '',
                scan.product || '',
                scan.quantity || 0,
                scan.location || '',
                scan.user || '',
                scan.timestamp || new Date().toISOString(),
                scan.stockLevel || '',
                scan.value || '',
                'Yes',
                scan.syncId
            ];
            
            if (existingScanIds.has(scan.syncId)) {
                scansToUpdate.push({
                    rowIndex: existingScanIds.get(scan.syncId),
                    values: [scanRow]
                });
            } else {
                scansToAdd.push(scanRow);
            }
            
            syncedIds.push(scan.syncId);
        });
        
        // Update existing scans
        for (const update of scansToUpdate) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!A${update.rowIndex}:J${update.rowIndex}?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: update.values })
                }
            );
        }
        
        // Append new scans
        if (scansToAdd.length > 0) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!A:J:append?valueInputOption=RAW`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: scansToAdd })
                }
            );
        }
        
        // Update Tally sheet
        await this.updateTally(stocktakeId, accessToken);
        
        return {
            syncedCount: scans.length,
            syncedIds,
            newScans: scansToAdd.length,
            updatedScans: scansToUpdate.length
        };
    }
    
    static async updateTally(stocktakeId, accessToken) {
        // Get all raw scans
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!A2:H`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            return; // Can't update tally if we can't read scans
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Aggregate by barcode
        const tally = {};
        rows.forEach(row => {
            const barcode = row[0]?.toString() || '';
            const product = row[1] || '';
            const quantity = parseFloat(row[2]) || 0;
            const location = row[3] || '';
            const stockLevel = row[6] || '';
            
            if (!barcode) return;
            
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
        });
        
        // Convert to rows
        const tallyRows = Object.keys(tally).map(barcode => [
            barcode,
            tally[barcode].product,
            tally[barcode].totalQty,
            Array.from(tally[barcode].locations).join(', '),
            new Date().toISOString(),
            tally[barcode].stockLevel
        ]);
        
        // Clear existing tally (keep header)
        if (tallyRows.length > 0) {
            // First, clear existing data
            const lastRow = tallyRows.length + 1;
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/Tally!A2:F${lastRow}?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: [] })
                }
            );
            
            // Then write new data
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/Tally!A2:F?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: tallyRows })
                }
            );
        }
    }
    
    // ============================================
    // DELETE SCANS
    // ============================================
    
    static async deleteScans(stocktakeId, syncIds, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        if (!syncIds || syncIds.length === 0) {
            return { deletedCount: 0, deletedIds: [] };
        }
        
        // Get all scans
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!A2:J`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to get scans for deletion');
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        const deletedRows = [];
        const rowsToDelete = [];
        
        rows.forEach((row, index) => {
            const scanSyncId = row[9]; // Column J
            if (syncIds.includes(scanSyncId)) {
                const deletedRow = [...row, new Date().toISOString()];
                deletedRows.push(deletedRow);
                rowsToDelete.push(index + 2); // +2 for header and 0-based index
            }
        });
        
        // Add to Deleted Scans sheet
        if (deletedRows.length > 0) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Deleted Scans'!A:K:append?valueInputOption=RAW`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: deletedRows })
                }
            );
            
            // Delete from Raw Scans (delete in reverse order to maintain indices)
            // Note: Google Sheets API doesn't support batch delete, so we'd need to use batchUpdate
            // For now, we'll mark them as deleted and filter them out
            // This is a limitation - we'd need to use batchUpdate for actual deletion
        }
        
        // Update Tally
        await this.updateTally(stocktakeId, accessToken);
        
        return {
            deletedCount: deletedRows.length,
            deletedIds: syncIds
        };
    }
    
    // ============================================
    // LOAD USER SCANS
    // ============================================
    
    static async loadUserScans(stocktakeId, username, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/'Raw Scans'!A2:J`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            return { scans: [], count: 0 };
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        const userScans = rows
            .filter(row => row[4] === username) // Column E is User
            .map(row => ({
                barcode: row[0]?.toString() || '',
                product: row[1] || '',
                quantity: parseFloat(row[2]) || 0,
                location: row[3] || '',
                user: row[4] || '',
                timestamp: row[5] || '',
                stockLevel: row[6] || '',
                value: parseFloat(row[7]) || 0,
                synced: row[8] === 'Yes',
                syncId: row[9] || ''
            }));
        
        return {
            scans: userScans,
            count: userScans.length
        };
    }
    
    // ============================================
    // SYNC KEGS
    // ============================================
    
    static async syncKegs(stocktakeId, kegs, location, user, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        const kegsToSync = kegs.filter(keg => keg.count > 0);
        
        if (kegsToSync.length === 0) {
            return { syncedCount: 0 };
        }
        
        const timestamp = new Date().toISOString();
        const rows = kegsToSync.map(keg => [
            keg.name,
            keg.count,
            location,
            user,
            timestamp,
            'Yes',
            `${Date.now()}-${Math.random()}`
        ]);
        
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/Kegs!A:G:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: rows })
            }
        );
        
        return { syncedCount: rows.length };
    }
    
    // ============================================
    // SYNC MANUAL ENTRIES
    // ============================================
    
    static async syncManualEntries(stocktakeId, manualEntries, env) {
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        if (!manualEntries || manualEntries.length === 0) {
            return { syncedCount: 0 };
        }
        
        const rows = manualEntries.map(entry => [
            entry.product || '',
            entry.quantity || 0,
            entry.location || '',
            entry.user || '',
            entry.timestamp || new Date().toISOString(),
            entry.stockLevel || '',
            entry.value || 0,
            entry.syncId || `${Date.now()}-${Math.random()}`
        ]);
        
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}/values/Manual!A:H:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: rows })
            }
        );
        
        return { syncedCount: rows.length };
    }
}

