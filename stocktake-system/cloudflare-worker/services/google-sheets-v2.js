import * as jose from 'jose';

export class GoogleSheetsAPI {
    static async getAccessToken(env) {
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        // Create JWT assertion
        const now = Math.floor(Date.now() / 1000);
        
        // Import private key
        const privateKey = await jose.importPKCS8(
            serviceAccount.private_key,
            'RS256'
        );
        
        // Create JWT
        const jwt = await new jose.SignJWT({
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive'
        })
            .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
            .setIssuedAt(now)
            .setIssuer(serviceAccount.client_email)
            .setAudience('https://oauth2.googleapis.com/token')
            .setExpirationTime(now + 3600)
            .sign(privateKey);
        
        // Exchange JWT for access token
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get access token: ${error}`);
        }
        
        const data = await response.json();
        return data.access_token;
    }
    
    static async getBarcodeMapping(env) {
        const accessToken = await this.getAccessToken(env);
        
        // Option 1: Use dedicated Barcode Mapping sheet if provided
        if (env.BARCODE_SHEET_ID && env.BARCODE_SHEET_ID !== 'YOUR_GOOGLE_SHEETS_BARCODE_MAPPING_ID') {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${env.BARCODE_SHEET_ID}/values/A:B`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch barcode mapping');
            }
            
            const data = await response.json();
            const rows = data.values || [];
            
            // Skip header row, create mapping
            const mapping = new Map();
            for (let i = 1; i < rows.length; i++) {
                const [barcode, product] = rows[i];
                if (barcode && product) {
                    // Map product description to barcode
                    mapping.set(product.trim(), barcode.trim());
                }
            }
            
            return mapping;
        }
        
        // Option 2: Auto-read from Master Sheet's Product Database
        if (env.MASTER_SHEET_ID && env.MASTER_SHEET_ID !== 'YOUR_MASTER_SHEET_ID') {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${env.MASTER_SHEET_ID}/values/'Product Database'!A:B`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch barcode mapping from Master Sheet. Make sure Master Sheet has a "Product Database" sheet with Barcode (A) and Product (B) columns.');
            }
            
            const data = await response.json();
            const rows = data.values || [];
            
            // Skip header row, create mapping
            const mapping = new Map();
            for (let i = 1; i < rows.length; i++) {
                const [barcode, product] = rows[i];
                if (barcode && product) {
                    // Map product description to barcode
                    mapping.set(product.trim(), barcode.trim());
                }
            }
            
            return mapping;
        }
        
        // No mapping available
        throw new Error('Barcode mapping not configured. Set either BARCODE_SHEET_ID or MASTER_SHEET_ID in wrangler.toml');
    }
    
    static async listSheetsInFolder(env) {
        const accessToken = await this.getAccessToken(env);
        
        // Stock app creates individual spreadsheets (not in a folder)
        // Search for all spreadsheets with "Stocktake -" in the name
        // If COUNT_SHEETS_FOLDER_ID is set, search within that folder; otherwise search all Drive
        const folderId = env.COUNT_SHEETS_FOLDER_ID;
        let query;
        
        if (folderId && folderId !== 'YOUR_GOOGLE_DRIVE_FOLDER_ID') {
            // Clean folder ID
            const cleanFolderId = folderId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
            // Search within specific folder - use standard Google Drive API query syntax
            // NOTE: Use 'name' not 'title' - title is deprecated in Drive API v3
            query = `parents in '${cleanFolderId}' and name contains 'Stocktake -' and mimeType = 'application/vnd.google-apps.spreadsheet'`;
        } else {
            // Search all Drive for stocktake spreadsheets (Stock app creates them individually)
            // NOTE: Use 'name' not 'title' - title is deprecated in Drive API v3
            query = `name contains 'Stocktake -' and mimeType = 'application/vnd.google-apps.spreadsheet'`;
        }
        
        // Add supportsAllDrives=true for service account access
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to list count sheets';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return data.files || [];
    }
    
    static async createStocktakeSpreadsheet(name, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: {
                        title: `Stocktake - ${name} - ${new Date().toLocaleDateString()}`
                    },
                    sheets: [
                        { properties: { title: 'Theoretical', index: 0 } },
                        { properties: { title: 'Audit Trail', index: 1 } },
                        { properties: { title: 'Config', index: 2 } }
                    ]
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create spreadsheet: ${error}`);
        }
        
        const data = await response.json();
        return data.spreadsheetId;
    }
    
    static async populateTheoreticalSheet(spreadsheetId, hnlData, barcodeMapping, env) {
        const accessToken = await this.getAccessToken(env);
        
        const headers = [
            'Category',
            'Product Code',
            'Barcode',
            'Description',
            'Unit',
            'Unit Cost',
            'Theoretical Qty',
            'Theoretical Value'
        ];
        
        const rows = hnlData.items.map(item => {
            // Try to find barcode by matching description
            const barcode = barcodeMapping.get(item.description) || '';
            
            return [
                item.category,
                item.productCode,
                barcode,
                item.description,
                item.unit,
                item.unitCost,
                item.theoreticalQty,
                item.theoreticalValue
            ];
        });
        
        const allData = [headers, ...rows];
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Theoretical!A1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: allData
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to populate theoretical sheet');
        }
    }
    
    static async linkCountSheet(spreadsheetId, countSheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Config!A1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [
                        ['Setting', 'Value'],
                        ['Count Sheet ID', countSheetId],
                        ['Created At', new Date().toISOString()]
                    ]
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to link count sheet');
        }
    }
    
    static async getTheoreticalData(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Theoretical!A:H`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to get theoretical data');
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        return rows.slice(1).map(row => ({
            category: row[0] || '',
            productCode: row[1] || '',
            barcode: row[2] || '',
            description: row[3] || '',
            unit: row[4] || '',
            unitCost: parseFloat(row[5]) || 0,
            theoreticalQty: parseFloat(row[6]) || 0,
            theoreticalValue: parseFloat(row[7]) || 0
        }));
    }
    
    static async getCountData(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        // Apps Script creates "Tally" sheet with aggregated counts
        // Format: Barcode, Product, Total Quantity, Locations, Last Updated, Stock Level
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Tally'!A:F`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            // Fallback to Raw Scans if Tally doesn't exist
            const rawResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Raw Scans'!A:J`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            
            if (!rawResponse.ok) {
                throw new Error('Failed to get count data');
            }
            
            const rawData = await rawResponse.json();
            const rows = rawData.values || [];
            
            // Aggregate Raw Scans by barcode
            const tally = {};
            rows.slice(1).forEach(row => {
                const barcode = row[0] || '';
                if (!barcode) return;
                
                if (!tally[barcode]) {
                    tally[barcode] = {
                        barcode: barcode,
                        product: row[1] || '',
                        quantity: 0,
                        locations: new Set(),
                        stockLevel: row[6] || ''
                    };
                }
                tally[barcode].quantity += parseFloat(row[2]) || 0;
                if (row[3]) tally[barcode].locations.add(row[3]);
            });
            
            return Object.values(tally).map(item => ({
                barcode: item.barcode,
                product: item.product,
                quantity: item.quantity,
                location: Array.from(item.locations).join(', '),
                stockLevel: item.stockLevel
            }));
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row
        // Tally format: A=Barcode, B=Product, C=Total Quantity, D=Locations, E=Last Updated, F=Stock Level
        return rows.slice(1).map(row => ({
            barcode: row[0] || '',
            product: row[1] || '',
            quantity: parseFloat(row[2]) || 0,
            location: row[3] || '',
            stockLevel: row[5] || ''
        }));
    }
    
    static async getAdjustments(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A:F`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            
            if (!response.ok) {
                return []; // Sheet might not have data yet
            }
            
            const data = await response.json();
            const rows = data.values || [];
            
            if (rows.length <= 1) return [];
            
            return rows.slice(1).map(row => ({
                productCode: row[0] || '',
                oldCount: parseFloat(row[1]) || 0,
                newCount: parseFloat(row[2]) || 0,
                reason: row[3] || '',
                user: row[4] || '',
                timestamp: row[5] || ''
            }));
        } catch (error) {
            console.error('Error getting adjustments:', error);
            return [];
        }
    }
    
    static async saveAdjustment(spreadsheetId, adjustment, env) {
        const accessToken = await this.getAccessToken(env);
        
        // Check for headers
        const checkResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A1:F1`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const checkData = await checkResponse.json();
        const hasHeaders = checkData.values && checkData.values.length > 0;
        
        if (!hasHeaders) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A1?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [
                            ['Product Code', 'Old Count', 'New Count', 'Reason', 'User', 'Timestamp']
                        ]
                    })
                }
            );
        }
        
        // Append adjustment
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [
                        [
                            adjustment.productCode,
                            adjustment.oldCount || 0,
                            adjustment.newCount,
                            adjustment.reason,
                            adjustment.user,
                            adjustment.timestamp
                        ]
                    ]
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to save adjustment');
        }
    }
    
    static async lockSpreadsheet(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to get spreadsheet info');
        }
        
        const data = await response.json();
        const sheets = data.sheets || [];
        
        const requests = sheets.map(sheet => ({
            addProtectedRange: {
                protectedRange: {
                    range: {
                        sheetId: sheet.properties.sheetId
                    },
                    description: 'Stocktake completed - locked for viewing only',
                    warningOnly: false
                }
            }
        }));
        
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests })
            }
        );
        
        if (!updateResponse.ok) {
            throw new Error('Failed to lock spreadsheet');
        }
    }
}
