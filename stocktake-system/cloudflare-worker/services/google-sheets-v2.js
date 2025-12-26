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
        const sheetId = env.BARCODE_SHEET_ID;
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:B`,
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
    
    static async listSheetsInFolder(env) {
        const accessToken = await this.getAccessToken(env);
        const folderId = env.COUNT_SHEETS_FOLDER_ID;
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to list count sheets');
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
    
    static async getCountData(countSheetId, env) {
        const accessToken = await this.getAccessToken(env);
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${countSheetId}/values/A:K`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to get count data');
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
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
