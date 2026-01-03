import { Router } from 'itty-router';
import { parseHnLExcel } from './parsers/hnl-parser';
// Use v2 which has proper JWT signing with jose library
import { GoogleSheetsAPI } from './services/google-sheets-v2';
import { AuthService } from './services/auth';
import { VarianceCalculator } from './services/variance-calculator';
import { ExportService } from './services/export';
import { CountingService } from './services/counting-service';

// Router setup
const router = Router();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Authentication middleware
const requireAuth = async (request, env) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const token = authHeader.substring(7);
    const user = await AuthService.validateToken(token, env);
    
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    request.user = user;
    return null;
};

const requireAdmin = async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    if (request.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    return null;
};

// Routes

// Auth - Login
router.post('/auth/login', async (request, env) => {
    try {
        const { username, password } = await request.json();
        const result = await AuthService.login(username, password, env);
        
        if (!result) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), { 
                status: 401, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }
        
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Admin - Get Users
router.get('/admin/users', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const users = await AuthService.getUsers(env);
        return new Response(JSON.stringify(users), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Admin - Add User
router.post('/admin/users', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const { username, password, role } = await request.json();
        await AuthService.addUser(username, password, role, env);
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Admin - Delete User
router.delete('/admin/users/:username', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const { username } = request.params;
        await AuthService.deleteUser(username, env);
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Admin - Update User Password
router.put('/admin/users/:username/password', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const { username } = request.params;
        const { password } = await request.json();
        
        if (!password) {
            return new Response(JSON.stringify({ error: 'Password is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        await AuthService.updatePassword(username, password, env);
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Stocktake - Get Current
router.get('/stocktake/current', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake) {
            // 404 is expected when there's no active stocktake - return proper JSON
            return new Response(JSON.stringify({ error: 'No active stocktake' }), { 
                status: 404, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }
        
        return new Response(JSON.stringify(currentStocktake), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Stocktake - Get History
router.get('/stocktake/history', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const historyJson = await env.STOCKTAKE_KV.get('stocktake_history', { type: 'json' });
        const history = historyJson || [];
        
        return new Response(JSON.stringify(history), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Sheets - Get Available Count Sheets
router.get('/sheets/count-sheets', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const sheets = await GoogleSheetsAPI.listSheetsInFolder(env);
        
        return new Response(JSON.stringify(sheets), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error listing count sheets:', error);
        return new Response(JSON.stringify({ 
            error: error.message || 'Failed to list count sheets',
            details: error.stack 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Helper function to extract stocktake name from count sheet name
// Format: "Stocktake - {name} - {date}" -> extracts {name}
function extractStocktakeName(countSheetName) {
    // Remove "Stocktake - " prefix
    let name = countSheetName.replace(/^Stocktake\s*-\s*/i, '');
    
    // Remove date suffix (format: " - YYYY-MM-DD HH:MM" or similar)
    // Match pattern: " - " followed by date-like string
    name = name.replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/i, '');
    name = name.replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}.*$/i, '');
    
    // Trim whitespace
    return name.trim() || countSheetName;
}

// Stocktake - Create New
router.post('/stocktake/create', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const formData = await request.formData();
        const hnlFile = formData.get('hnlFile');
        const countSheetId = formData.get('countSheetId');
        let stocktakeName = formData.get('stocktakeName');
        
        // If stocktake name not provided, extract from count sheet name
        if (!stocktakeName || stocktakeName.trim() === '') {
            const sheets = await GoogleSheetsAPI.listSheetsInFolder(env);
            const countSheet = sheets.find(s => s.id === countSheetId);
            
            if (countSheet) {
                stocktakeName = extractStocktakeName(countSheet.name);
            } else {
                // Fallback: try to get name from Drive API
                const accessToken = await GoogleSheetsAPI.getAccessToken(env);
                const driveResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${countSheetId}?fields=name&supportsAllDrives=true`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (driveResponse.ok) {
                    const fileData = await driveResponse.json();
                    stocktakeName = extractStocktakeName(fileData.name);
                } else {
                    stocktakeName = 'Stocktake ' + new Date().toLocaleDateString();
                }
            }
        }
        
        // Parse HnL file
        const hnlData = await parseHnLExcel(await hnlFile.arrayBuffer());
        
        // Create new Google Sheet for this stocktake
        const spreadsheetId = await GoogleSheetsAPI.createStocktakeSpreadsheet(
            stocktakeName,
            env
        );
        
        // Load barcode mapping
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        // Populate theoretical data sheet
        await GoogleSheetsAPI.populateTheoreticalSheet(
            spreadsheetId,
            hnlData,
            barcodeMapping,
            env
        );
        
        // Link count sheet
        await GoogleSheetsAPI.linkCountSheet(
            spreadsheetId,
            countSheetId,
            env
        );
        
        // Create stocktake record
        const stocktake = {
            id: crypto.randomUUID(),
            name: stocktakeName,
            spreadsheetId,
            countSheetId,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: request.user.username
        };
        
        // Save as current stocktake
        await env.STOCKTAKE_KV.put('current_stocktake', JSON.stringify(stocktake));
        
        return new Response(JSON.stringify(stocktake), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Create stocktake error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Variance - Get Data
router.get('/variance/:stocktakeId', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        
        // Get stocktake info
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        // Get theoretical data
        const theoretical = await GoogleSheetsAPI.getTheoreticalData(
            currentStocktake.spreadsheetId,
            env
        );
        
        // Get count data
        const counts = await GoogleSheetsAPI.getCountData(
            currentStocktake.countSheetId,
            env
        );
        
        // Get manual adjustments
        const adjustments = await GoogleSheetsAPI.getAdjustments(
            currentStocktake.spreadsheetId,
            env
        );
        
        // Get barcode mapping
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        // Calculate variance
        const varianceData = VarianceCalculator.calculate(
            theoretical,
            counts,
            adjustments,
            barcodeMapping
        );
        
        return new Response(JSON.stringify(varianceData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Get variance error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Variance - Update Count
router.post('/variance/:stocktakeId/update', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        const { productCode, newCount, reason, user, timestamp } = await request.json();
        
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        if (currentStocktake.status !== 'active') {
            return new Response('Stocktake is not active', { status: 400, headers: corsHeaders });
        }
        
        // Save adjustment to audit trail
        await GoogleSheetsAPI.saveAdjustment(
            currentStocktake.spreadsheetId,
            { productCode, newCount, reason, user, timestamp },
            env
        );
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Stocktake - Finish
router.post('/stocktake/:stocktakeId/finish', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        // Update status
        currentStocktake.status = 'completed';
        currentStocktake.completedAt = new Date().toISOString();
        currentStocktake.completedBy = request.user.username;
        
        // Add to history
        const historyJson = await env.STOCKTAKE_KV.get('stocktake_history', { type: 'json' });
        const history = historyJson || [];
        history.unshift(currentStocktake);
        
        await env.STOCKTAKE_KV.put('stocktake_history', JSON.stringify(history));
        
        // Clear current stocktake
        await env.STOCKTAKE_KV.delete('current_stocktake');
        
        // Lock the spreadsheet (set to view-only)
        await GoogleSheetsAPI.lockSpreadsheet(currentStocktake.spreadsheetId, env);
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Export - Variance Report
router.get('/export/variance/:stocktakeId', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        // Get variance data
        const theoretical = await GoogleSheetsAPI.getTheoreticalData(
            currentStocktake.spreadsheetId,
            env
        );
        const counts = await GoogleSheetsAPI.getCountData(
            currentStocktake.countSheetId,
            env
        );
        const adjustments = await GoogleSheetsAPI.getAdjustments(
            currentStocktake.spreadsheetId,
            env
        );
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        const varianceData = VarianceCalculator.calculate(
            theoretical,
            counts,
            adjustments,
            barcodeMapping
        );
        
        // Generate Excel file
        const excelBuffer = await ExportService.generateVarianceExcel(varianceData);
        
        return new Response(excelBuffer, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="variance-report-${currentStocktake.name}.xlsx"`
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Export - Manual Entry List
router.get('/export/manual/:stocktakeId', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        const theoretical = await GoogleSheetsAPI.getTheoreticalData(
            currentStocktake.spreadsheetId,
            env
        );
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        const manualList = ExportService.generateManualEntryList(
            theoretical,
            barcodeMapping
        );
        
        return new Response(manualList, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="manual-entry-list-${currentStocktake.name}.txt"`
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Export - DAT File
router.get('/export/dat/:stocktakeId', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake || currentStocktake.id !== stocktakeId) {
            return new Response('Stocktake not found', { status: 404, headers: corsHeaders });
        }
        
        const theoretical = await GoogleSheetsAPI.getTheoreticalData(
            currentStocktake.spreadsheetId,
            env
        );
        const counts = await GoogleSheetsAPI.getCountData(
            currentStocktake.countSheetId,
            env
        );
        const adjustments = await GoogleSheetsAPI.getAdjustments(
            currentStocktake.spreadsheetId,
            env
        );
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        const varianceData = VarianceCalculator.calculate(
            theoretical,
            counts,
            adjustments,
            barcodeMapping
        );
        
        const datContent = ExportService.generateDatFile(
            varianceData,
            barcodeMapping
        );
        
        return new Response(datContent, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="stocktake-${currentStocktake.name}.dat"`
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// ============================================
// COUNTING ENDPOINTS (Replaces Apps Script)
// ============================================

// Get Product Database
router.get('/counting/products', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const products = await CountingService.getProductDatabase(env);
        return new Response(JSON.stringify({ success: true, products }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Get Locations
router.get('/counting/locations', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const locations = await CountingService.getLocations(env);
        return new Response(JSON.stringify({ success: true, locations }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Get Kegs
router.get('/counting/kegs', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const kegs = await CountingService.getKegs(env);
        return new Response(JSON.stringify({ success: true, kegs }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Create Stocktake
router.post('/counting/stocktake/create', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { name, user, folderId } = await request.json();
        
        if (!folderId) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Folder ID is required. Please configure a folder ID in Settings.' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        const result = await CountingService.createStocktake(name, user, folderId, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        // Log the full error for debugging
        console.error('Create stocktake error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        let errorMessage = error.message || 'Failed to create stocktake';
        let statusCode = 500;
        
        // Check if it's a permission error
        if (error.message && (error.message.includes('PERMISSION_DENIED') || error.message.includes('Permission denied'))) {
            // Use the specific error message from the service, which includes details
            errorMessage = error.message; // This will have the specific details from counting-service.js
            statusCode = 403;
        }
        
        return new Response(JSON.stringify({ 
            success: false,
            error: errorMessage 
        }), {
            status: statusCode,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// List Stocktakes
router.get('/counting/stocktakes', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const url = new URL(request.url);
        const folderId = url.searchParams.get('folderId') || null;
        const stocktakes = await CountingService.listStocktakes(folderId, env);
        return new Response(JSON.stringify({ success: true, stocktakes }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error listing stocktakes:', error);
        // Preserve the error message from the service
        const errorMessage = error.message || 'Failed to list stocktakes';
        return new Response(JSON.stringify({ 
            success: false,
            error: errorMessage 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Sync Scans
router.post('/counting/scans/sync', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId, scans } = await request.json();
        const result = await CountingService.syncScans(stocktakeId, scans, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Delete Scans
router.post('/counting/scans/delete', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId, syncIds } = await request.json();
        const result = await CountingService.deleteScans(stocktakeId, syncIds, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Load User Scans
router.get('/counting/scans/:stocktakeId/:username', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId, username } = request.params;
        const result = await CountingService.loadUserScans(stocktakeId, username, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Sync Kegs
router.post('/counting/kegs/sync', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId, kegs, location, user } = await request.json();
        const result = await CountingService.syncKegs(stocktakeId, kegs, location, user, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Sync Manual Entries
router.post('/counting/manual/sync', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId, manualEntries } = await request.json();
        const result = await CountingService.syncManualEntries(stocktakeId, manualEntries, env);
        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Debug endpoint to test Google Sheets API authentication
router.get('/debug/test-auth', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;

    try {
        // Test 1: Check if secret is set
        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            return new Response(JSON.stringify({
                success: false,
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY secret is not set',
                help: 'Run: wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Test 2: Check if secret can be parsed
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON',
                details: e.message
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Test 3: Get access token
        let accessToken;
        try {
            accessToken = await GoogleSheetsAPI.getAccessToken(env);
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to get access token',
                details: e.message,
                serviceAccountEmail: serviceAccount.client_email
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Test 4: Try to create a test spreadsheet
        const testResponse = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: { title: 'API Auth Test - DELETE ME' }
                })
            }
        );

        const responseText = await testResponse.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = responseText;
        }

        if (!testResponse.ok) {
            return new Response(JSON.stringify({
                success: false,
                step: 'create_spreadsheet',
                status: testResponse.status,
                statusText: testResponse.statusText,
                error: responseData,
                serviceAccountEmail: serviceAccount.client_email,
                help: testResponse.status === 403
                    ? 'Google Sheets API might not be enabled, or OAuth Consent Screen not configured'
                    : 'Check the error details above'
            }), {
                status: 200, // Return 200 so client can see the debug info
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Test 5: Delete the test spreadsheet
        const spreadsheetId = responseData.spreadsheetId;
        if (spreadsheetId) {
            await fetch(
                `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'All authentication tests passed!',
            serviceAccountEmail: serviceAccount.client_email,
            testSpreadsheetCreated: true,
            testSpreadsheetDeleted: true
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

// Main handler
export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx);
    }
};
