export class GoogleSheetsAPI {
    static async getAccessToken(env) {
        // Parse service account key from environment
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        // Create JWT for Google OAuth
        const now = Math.floor(Date.now() / 1000);
        const claim = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };
        
        // In a real implementation, you'd sign this JWT with the private key
        // For Cloudflare Workers, you might use the Web Crypto API or a library
        // This is a simplified version - you'll need to implement proper JWT signing
        
        // For now, using a placeholder - implement actual JWT signing
        const token = await this.signJWT(claim, serviceAccount.private_key);
        
        // Exchange JWT for access token
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            })
        });
        
        const data = await response.json();
        return data.access_token;
    }
    
    static async signJWT(payload, privateKey) {
        // Implement JWT signing using Web Crypto API
        // This is a complex operation - you may want to use a library like jose
        // Placeholder for actual implementation
        throw new Error('JWT signing not implemented - use jose library or similar');
    }
    
    static async getBarcodeMapping(env) {
        const accessToken = await this.getAccessToken(env);
        const sheetId = env.BARCODE_SHEET_ID;
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:B`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row, create mapping
        const mapping = new Map();
        for (let i = 1; i < rows.length; i++) {
            const [barcode, product] = rows[i];
            if (barcode && product) {
                mapping.set(product.trim(), barcode.trim());
            }
        }
        
        return mapping;
    }
    
    static async listSheetsInFolder(env) {
        const accessToken = await this.getAccessToken(env);
        const folderId = env.COUNT_SHEETS_FOLDER_ID;
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        return data.files || [];
    }
    
    static async createStocktakeSpreadsheet(name, env) {
        const accessToken = await this.getAccessToken(env);
        
        // Create new spreadsheet
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
                        title: `Stocktake - ${name}`
                    },
                    sheets: [
                        { properties: { title: 'Theoretical' } },
                        { properties: { title: 'Variance' } },
                        { properties: { title: 'Audit Trail' } }
                    ]
                })
            }
        );
        
        const data = await response.json();
        return data.spreadsheetId;
    }
    
    static async populateTheoreticalSheet(spreadsheetId, hnlData, barcodeMapping, env) {
        const accessToken = await this.getAccessToken(env);
        
        // Prepare data rows
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
            const productCode = item.productCode || item.description;
            const barcode = barcodeMapping.get(productCode) || '';
            
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
        
        // Write to sheet
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Theoretical!A1:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: allData
                })
            }
        );
    }
    
    static async linkCountSheet(spreadsheetId, countSheetId, env) {
        // Store the link in the spreadsheet metadata or a separate sheet
        const accessToken = await this.getAccessToken(env);
        
        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Config'!A1:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [
                        ['Count Sheet ID', countSheetId]
                    ]
                })
            }
        );
    }
    
    static async getTheoreticalData(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Theoretical!A:H`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row
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
    
    static async getCountData(countSheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${countSheetId}/values/A:K`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row
        return rows.slice(1).map(row => ({
            barcode: row[0] || '',
            product: row[1] || '',
            quantity: parseFloat(row[2]) || 0,
            location: row[3] || '',
            user: row[4] || '',
            timestamp: row[5] || '',
            stockLevel: row[6] || '',
            value: parseFloat(row[7]) || 0,
            synced: row[8] || '',
            status: row[9] || '',
            syncId: row[10] || ''
        }));
    }
    
    static async getAdjustments(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A:F`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row if exists
        if (rows.length <= 1) return [];
        
        return rows.slice(1).map(row => ({
            productCode: row[0] || '',
            oldCount: parseFloat(row[1]) || 0,
            newCount: parseFloat(row[2]) || 0,
            reason: row[3] || '',
            user: row[4] || '',
            timestamp: row[5] || ''
        }));
    }
    
    static async saveAdjustment(spreadsheetId, adjustment, env) {
        const accessToken = await this.getAccessToken(env);
        
        // First, check if Audit Trail sheet has headers
        const checkResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A1:F1`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const checkData = await checkResponse.json();
        const hasHeaders = checkData.values && checkData.values.length > 0;
        
        // Add headers if needed
        if (!hasHeaders) {
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Audit Trail'!A1:append?valueInputOption=RAW`,
                {
                    method: 'POST',
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
        await fetch(
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
    }
    
    static async lockSpreadsheet(spreadsheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        // Get all sheets in the spreadsheet
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        const data = await response.json();
        const sheets = data.sheets || [];
        
        // Create protected range for each sheet
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
        
        // Apply protection
        await fetch(
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
    }
}
