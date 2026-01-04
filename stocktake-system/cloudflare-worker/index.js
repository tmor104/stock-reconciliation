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

// Apps Script Proxy - defensive proxying, never assumes JSON
router.post('/apps-script/proxy', async (request, env) => {
    const requestId = crypto.randomUUID();
    try {
        const APPS_SCRIPT_URL = env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwfvQtQLYsJXxGvlbgImk9LNL9hyiJkslR3q2aZuJduydseE1TE_VsE29QjPhiKqS_L/exec';
        const API_SECRET = env.APPS_SCRIPT_SECRET || '';
        
        // Get request body and add API secret
        const bodyText = await request.text();
        let body;
        try {
            body = JSON.parse(bodyText);
            // Add API secret if configured
            if (API_SECRET) {
                body.secret = API_SECRET;
            }
        } catch (e) {
            // If not JSON, pass through as-is
            body = bodyText;
        }
        
        // Forward to Apps Script with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        let appsScriptResponse;
        try {
            appsScriptResponse = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: typeof body === 'string' ? body : JSON.stringify(body),
                redirect: 'follow',
                signal: controller.signal
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return new Response(JSON.stringify({
                    ok: false,
                    success: false,
                    error: { message: 'Request timeout', where: 'proxy' },
                    requestId: requestId
                }), {
                    status: 504,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            throw fetchError;
        }
        clearTimeout(timeoutId);
        
        // Read response as text (never assume JSON)
        const responseText = await appsScriptResponse.text();
        const contentType = appsScriptResponse.headers.get('content-type') || '';
        const upstreamStatus = appsScriptResponse.status;
        
        // Log for debugging
        console.log(`[${requestId}] Upstream status: ${upstreamStatus}, content-type: ${contentType}`);
        
        // Check for HTML (Apps Script error page)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            const errorMatch = responseText.match(/<title>(.*?)<\/title>/i) || responseText.match(/<h1>(.*?)<\/h1>/i);
            const htmlError = errorMatch ? errorMatch[1] : 'Unknown HTML error';
            
            return new Response(JSON.stringify({
                ok: false,
                success: false,
                error: {
                    message: 'Upstream returned non-JSON (HTML error page)',
                    where: 'proxy',
                    upstreamStatus: upstreamStatus,
                    upstreamContentType: contentType,
                    upstreamBodySnippet: responseText.substring(0, 500),
                    htmlError: htmlError
                },
                requestId: requestId
            }), {
                status: upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Check if content-type indicates JSON
        const isJsonContentType = contentType.includes('application/json');
        const looksLikeJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');
        
        if (isJsonContentType || looksLikeJson) {
            try {
                const jsonData = JSON.parse(responseText);
                // Preserve upstream status, add requestId if missing
                if (!jsonData.requestId) {
                    jsonData.requestId = requestId;
                }
                return new Response(JSON.stringify(jsonData), {
                    status: upstreamStatus,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (parseError) {
                return new Response(JSON.stringify({
                    ok: false,
                    success: false,
                    error: {
                        message: 'Upstream returned invalid JSON',
                        where: 'proxy',
                        upstreamStatus: upstreamStatus,
                        upstreamContentType: contentType,
                        upstreamBodySnippet: responseText.substring(0, 500),
                        parseError: parseError.toString()
                    },
                    requestId: requestId
                }), {
                    status: upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // Not JSON and not HTML - wrap in JSON error
        return new Response(JSON.stringify({
            ok: false,
            success: false,
            error: {
                message: 'Upstream returned unexpected content type',
                where: 'proxy',
                upstreamStatus: upstreamStatus,
                upstreamContentType: contentType,
                upstreamBodySnippet: responseText.substring(0, 500)
            },
            requestId: requestId
        }), {
            status: upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            ok: false,
            success: false,
            error: {
                message: 'Proxy error: ' + error.message,
                where: 'proxy',
                name: error.name
            },
            requestId: requestId
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

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

// Auth - Initialize Admin (one-time setup)
router.post('/auth/init', async (request, env) => {
    try {
        // Check if users already exist
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        if (users.length > 0) {
            return new Response(JSON.stringify({ 
                error: 'Users already exist. Use /auth/login instead.' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Get initial admin password from secret
        const initialPassword = env.INITIAL_ADMIN_PASSWORD;
        
        if (!initialPassword) {
            return new Response(JSON.stringify({ 
                error: 'INITIAL_ADMIN_PASSWORD secret is not set. Set it via: wrangler secret put INITIAL_ADMIN_PASSWORD' 
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Hash the password (frontend sends hashed passwords)
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(initialPassword);
        const passwordHash = await crypto.subtle.digest('SHA-256', passwordData);
        const passwordHashArray = Array.from(new Uint8Array(passwordHash));
        const passwordHashHex = passwordHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Create admin user with hashed password (as frontend sends hashed passwords)
        const adminUser = {
            username: 'admin',
            password: passwordHashHex, // Store hashed password
            role: 'admin'
        };
        
        await env.STOCKTAKE_KV.put('users', JSON.stringify([adminUser]));
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Admin user created successfully. You can now login with username "admin" and the password you set in INITIAL_ADMIN_PASSWORD secret.'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Auth - Login
router.post('/auth/login', async (request, env) => {
    try {
        const { username, password } = await request.json();
        
        // Auto-initialize if no users exist and password matches INITIAL_ADMIN_PASSWORD
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        if (users.length === 0 && username === 'admin' && env.INITIAL_ADMIN_PASSWORD) {
            // Hash the INITIAL_ADMIN_PASSWORD to match what frontend sends
            const encoder = new TextEncoder();
            const initialPasswordData = encoder.encode(env.INITIAL_ADMIN_PASSWORD);
            const initialPasswordHash = await crypto.subtle.digest('SHA-256', initialPasswordData);
            const initialPasswordHashArray = Array.from(new Uint8Array(initialPasswordHash));
            const initialPasswordHashHex = initialPasswordHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Compare with the hashed password from frontend
            if (password === initialPasswordHashHex) {
                // Create admin user with hashed password (as frontend sends hashed passwords)
                const adminUser = {
                    username: 'admin',
                    password: initialPasswordHashHex, // Store hashed password
                    role: 'admin'
                };
                await env.STOCKTAKE_KV.put('users', JSON.stringify([adminUser]));
                
                // Now login
                const result = await AuthService.login(username, password, env);
                return new Response(JSON.stringify(result), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
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
// stocktakeId is the Apps Script spreadsheet ID
router.get('/variance/:stocktakeId', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        // stocktakeId IS the spreadsheet ID in Apps Script system
        
        // Get theoretical data (from Theoretical sheet in spreadsheet)
        let theoretical = [];
        try {
            theoretical = await GoogleSheetsAPI.getTheoreticalData(stocktakeId, env);
        } catch (e) {
            console.warn('No theoretical data found:', e.message);
            // Continue with empty theoretical data
        }
        
        // Get count data (from Tally sheet in same spreadsheet)
        let counts = [];
        try {
            counts = await GoogleSheetsAPI.getCountData(stocktakeId, env);
        } catch (e) {
            console.warn('No count data found:', e.message);
            // Continue with empty counts
        }
        
        // Get manual adjustments (from Manual sheet)
        let adjustments = [];
        try {
            adjustments = await GoogleSheetsAPI.getAdjustments(stocktakeId, env);
        } catch (e) {
            console.warn('No adjustments found:', e.message);
        }
        
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
// stocktakeId is the Apps Script spreadsheet ID
router.post('/variance/:stocktakeId/update', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        const body = await request.json().catch(() => ({}));
        const { productCode, newCount, reason, user, timestamp } = body;
        
        // If no body provided, this is just a trigger to recalculate - return success
        if (!productCode && newCount === undefined) {
            return new Response(JSON.stringify({ success: true, message: 'Variance recalculation triggered' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // stocktakeId IS the spreadsheet ID - no KV lookup needed
        
        // Save adjustment to Audit Trail sheet (create if needed)
        try {
            await GoogleSheetsAPI.saveAdjustment(
                stocktakeId,
                { productCode, newCount, reason, user, timestamp },
                env
            );
        } catch (adjustError) {
            // If Audit Trail sheet doesn't exist, create it
            if (adjustError.message.includes('400') || adjustError.message.includes('not found')) {
                // Create Audit Trail sheet first
                const accessToken = await GoogleSheetsAPI.getAccessToken(env);
                const createResponse = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${stocktakeId}:batchUpdate`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            requests: [{
                                addSheet: {
                                    properties: {
                                        title: 'Audit Trail'
                                    }
                                }
                            }]
                        })
                    }
                );
                
                if (!createResponse.ok) {
                    throw new Error('Failed to create Audit Trail sheet');
                }
                
                // Retry saving adjustment
                await GoogleSheetsAPI.saveAdjustment(
                    stocktakeId,
                    { productCode, newCount, reason, user, timestamp },
                    env
                );
            } else {
                throw adjustError;
            }
        }
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Update variance error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to update variance' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Stocktake - Upload Variance Report (HnL file)
// stocktakeId is the Apps Script spreadsheet ID
router.post('/stocktake/:stocktakeId/upload', async (request, env) => {
    const authError = await requireAuth(request, env);
    if (authError) return authError;
    
    try {
        const { stocktakeId } = request.params;
        // stocktakeId IS the spreadsheet ID - no KV lookup needed
        
        // Get uploaded file
        const formData = await request.formData();
        const hnlFile = formData.get('hnlFile');
        
        if (!hnlFile) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // Parse HnL Excel file
        const arrayBuffer = await hnlFile.arrayBuffer();
        const theoreticalData = await parseHnLExcel(arrayBuffer);
        
        // Get barcode mapping for saving theoretical data
        const barcodeMapping = await GoogleSheetsAPI.getBarcodeMapping(env);
        
        // Save to Theoretical sheet in spreadsheet (creates sheet if needed)
        await GoogleSheetsAPI.populateTheoreticalSheet(
            stocktakeId,
            theoreticalData,
            barcodeMapping,
            env
        );
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Variance report uploaded successfully',
            recordCount: theoreticalData.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Upload variance report error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to upload variance report' }), {
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

// NOTE: File operations (createStocktake, listStocktakes, syncScans, deleteScans, loadUserScans, syncKegs, syncManualEntries)
// have been moved to Apps Script. These endpoints are no longer used.

// Debug - Test Folder Access
router.get('/debug/test-folder-access', async (request, env) => {
    try {
        const url = new URL(request.url);
        const folderId = url.searchParams.get('folderId');
        
        if (!folderId) {
            return new Response(JSON.stringify({ 
                error: 'Please provide folderId query parameter, e.g., ?folderId=1lJiAO7sdEk_BeYLlTxx-dswmttjiDfRE' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        // Test 1: Can we get folder info?
        const folderInfoResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,permissions&supportsAllDrives=true`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        const results = {
            folderId,
            canAccessFolder: folderInfoResponse.ok,
            folderInfo: null,
            canCreateInFolder: false,
            createTestResult: null
        };
        
        if (folderInfoResponse.ok) {
            results.folderInfo = await folderInfoResponse.json();
            
            // Test 2: Can we create a file in this folder?
            const testCreateResponse = await fetch(
                'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'TEST_DELETE_ME_' + Date.now(),
                        mimeType: 'application/vnd.google-apps.spreadsheet',
                        parents: [folderId]
                    })
                }
            );
            
            results.canCreateInFolder = testCreateResponse.ok;
            
            if (testCreateResponse.ok) {
                const createdFile = await testCreateResponse.json();
                results.createTestResult = { success: true, fileId: createdFile.id };
                
                // Delete test file
                await fetch(
                    `https://www.googleapis.com/drive/v3/files/${createdFile.id}`,
                    {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    }
                ).catch(() => {});
            } else {
                const errorText = await testCreateResponse.text();
                try {
                    results.createTestResult = JSON.parse(errorText);
                } catch (e) {
                    results.createTestResult = { error: errorText };
                }
            }
        } else {
            const errorText = await folderInfoResponse.text();
            try {
                results.folderInfo = JSON.parse(errorText);
            } catch (e) {
                results.folderInfo = { error: errorText };
            }
        }
        
        return new Response(JSON.stringify(results, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Debug - Test Service Account (No auth required for testing)
router.get('/debug/test-service-account', async (request, env) => {
    try {
        // Test if we can get an access token
        const accessToken = await GoogleSheetsAPI.getAccessToken(env);
        
        // Test if we can create a spreadsheet (just test, don't actually create)
        const testResponse = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: { title: 'TEST - DELETE ME' }
                })
            }
        );
        
        const responseText = await testResponse.text();
        
        if (testResponse.ok) {
            const data = JSON.parse(responseText);
            // Delete the test spreadsheet immediately
            await fetch(
                `https://www.googleapis.com/drive/v3/files/${data.spreadsheetId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            
            return new Response(JSON.stringify({ 
                success: true,
                message: 'Service account CAN create spreadsheets! The key is working.',
                spreadsheetId: data.spreadsheetId,
                deleted: true
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {
                errorData = { error: { message: responseText } };
            }
            
            return new Response(JSON.stringify({ 
                success: false,
                error: errorData.error?.message || 'Unknown error',
                code: errorData.error?.code,
                status: testResponse.status,
                fullError: errorData
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
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

// Debug - Test Authentication
router.get('/debug/test-auth', async (request, env) => {
    try {
        // Check if secret exists
        if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY secret is not set',
                step: 'Set the secret in Cloudflare Dashboard or via wrangler secret put'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Try to parse the JSON
        let serviceAccountKey;
        try {
            serviceAccountKey = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } catch (e) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON',
                details: e.message,
                step: 'Re-upload the service account JSON key'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Try to get an access token
        try {
            const accessToken = await GoogleSheetsAPI.getAccessToken(env);
            
            // Test with a simple Drive API call
            const testResponse = await fetch(
                'https://www.googleapis.com/drive/v3/about?fields=user',
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (!testResponse.ok) {
                const errorText = await testResponse.text();
                return new Response(JSON.stringify({ 
                    success: false,
                    error: 'Failed to authenticate with Google Drive API',
                    status: testResponse.status,
                    details: errorText,
                    step: 'Check that APIs are enabled and service account key is valid'
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ 
                success: true,
                message: 'Authentication successful! Service account is working correctly.',
                serviceAccountEmail: serviceAccountKey.client_email,
                projectId: serviceAccountKey.project_id
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'Failed to get access token',
                details: error.message,
                step: 'Check service account key and API enablement'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false,
            error: error.message,
            step: 'Check Cloudflare Worker logs for details'
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
