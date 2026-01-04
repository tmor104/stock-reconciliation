// Counting Service - Handles reading data from Google Sheets API
// File operations have been moved to Apps Script

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
        
        // Read more columns to check for stock group (A-D is standard, but may have more)
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterSheetId}/values/'Product Database'!A2:Z`,
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
            value: parseFloat(row[3]) || 0,
            stockGroup: row[4] || '' // Column E - Stock Group (if exists)
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
        
        // Get all products from Product Database
        const products = await this.getProductDatabase(env);
        
        // Filter by stock groups: "1 Beer Keg" and "300 Cider/Seltzer Keg"
        const kegStockGroups = ['1', '300', '1 Beer Keg', '300 Cider/Seltzer Keg', 'Beer Keg', 'Cider/Seltzer Keg'];
        const kegs = products
            .filter(product => {
                const stockGroup = (product.stockGroup || '').toString().trim();
                return kegStockGroups.some(group => 
                    stockGroup === group || 
                    stockGroup.includes('Beer Keg') || 
                    stockGroup.includes('Cider/Seltzer Keg') ||
                    stockGroup === '1' ||
                    stockGroup === '300'
                );
            })
            .map(product => ({
                name: product.product,
                barcode: product.barcode,
                count: 0
            }));
        
        return kegs;
    }
    
    // ============================================
    // FILE OPERATIONS MOVED TO APPS SCRIPT
    // ============================================
    // All file operations have been moved to Apps Script:
    // - createStocktake
    // - listStocktakes
    // - syncScans
    // - deleteScans
    // - loadUserScans
    // - syncKegs
    // - syncManualEntries
    // 
    // Apps Script runs as the user, so it can create files in the user's Drive.
    // This service now only handles reading data (products, locations, kegs).
}
