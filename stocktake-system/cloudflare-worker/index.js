import { Router } from 'itty-router';
import { parseHnLExcel } from './parsers/hnl-parser';
import { GoogleSheetsAPI } from './services/google-sheets';
import { AuthService } from './services/auth';
import { VarianceCalculator } from './services/variance-calculator';
import { ExportService } from './services/export';

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
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.substring(7);
    const user = await AuthService.validateToken(token, env);
    
    if (!user) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    
    request.user = user;
    return null;
};

const requireAdmin = async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    if (request.user.role !== 'admin') {
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
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
            return new Response('Invalid credentials', { status: 401, headers: corsHeaders });
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

// Stocktake - Get Current
router.get('/stocktake/current', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const currentStocktake = await env.STOCKTAKE_KV.get('current_stocktake', { type: 'json' });
        
        if (!currentStocktake) {
            return new Response(null, { status: 404, headers: corsHeaders });
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
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Stocktake - Create New
router.post('/stocktake/create', async (request, env) => {
    const authError = await requireAdmin(request, env);
    if (authError) return authError;
    
    try {
        const formData = await request.formData();
        const hnlFile = formData.get('hnlFile');
        const countSheetId = formData.get('countSheetId');
        const stocktakeName = formData.get('stocktakeName');
        
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

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

// Main handler
export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx);
    }
};
