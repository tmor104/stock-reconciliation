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
