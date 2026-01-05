// Unified API Service
// Hybrid approach: Apps Script for file operations, Cloudflare Workers for auth and complex logic

const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev',
    // Use Cloudflare Worker proxy to avoid CORS issues
    APPS_SCRIPT_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev/apps-script/proxy',
};

// Utility function for SHA-256 hashing
const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

class UnifiedAPIService {
    constructor() {
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    // ============================================
    // AUTHENTICATION (Cloudflare Workers)
    // ============================================

    async login(username, password) {
        const hashedPassword = await sha256(password);
        const response = await fetch(`${CONFIG.WORKER_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: hashedPassword })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Invalid credentials' }));
            throw new Error(error.error || 'Invalid credentials');
        }
        
        const result = await response.json();
        if (result.token) {
            this.setToken(result.token);
        }
        return result;
    }

    // ============================================
    // PRODUCT DATABASE (Cloudflare Workers)
    // ============================================

    async getProductDatabase() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/products`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load product database');
        }
        
        return await response.json();
    }

    async getLocations() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/locations`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load locations');
        }
        
        return await response.json();
    }

    async getKegs(stocktakeId = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        // If stocktakeId provided, get kegs from stocktake's Kegs sheet
        // Otherwise, get from master sheet
        const url = stocktakeId 
            ? `${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/kegs`
            : `${CONFIG.WORKER_URL}/counting/kegs`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load kegs');
        }
        
        return await response.json();
    }

    // ============================================
    // STOCKTAKE MANAGEMENT (Apps Script - File Operations)
    // ============================================

    async createStocktake(name, user, folderId = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createStocktake',
                name,
                user
            })
        });
        
        if (!response.ok) {
            // Try to get error details from response
            let errorDetails = 'Failed to create stocktake';
            try {
                const errorData = await response.json();
                // Handle error object structure
                if (errorData.error) {
                    if (typeof errorData.error === 'string') {
                        errorDetails = errorData.error;
                    } else if (errorData.error.message) {
                        errorDetails = errorData.error.message;
                    } else {
                        errorDetails = JSON.stringify(errorData.error);
                    }
                } else {
                    errorDetails = errorData.message || JSON.stringify(errorData);
                }
            } catch (e) {
                const text = await response.text();
                errorDetails = text || 'Failed to create stocktake';
            }
            throw new Error(errorDetails);
        }
        
        const result = await response.json();
        if (!result.ok) {
            let errorMsg = result.message || 'Failed to create stocktake';
            if (result.error) {
                if (typeof result.error === 'string') {
                    errorMsg = result.error;
                } else if (result.error.message) {
                    errorMsg = result.error.message;
                }
            }
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        const data = result.data || result;
        return {
            success: true,
            stocktakeId: data.stocktakeId,
            name: data.name,
            url: data.url
        };
    }

    async listStocktakes(folderId = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'listStocktakes'
            })
        });
        
        if (!response.ok) {
            // Try to get error details from response
            let errorDetails = 'Failed to list stocktakes';
            try {
                const errorData = await response.json();
                // Handle error object structure
                if (errorData.error) {
                    if (typeof errorData.error === 'string') {
                        errorDetails = errorData.error;
                    } else if (errorData.error.message) {
                        errorDetails = errorData.error.message;
                    } else {
                        errorDetails = JSON.stringify(errorData.error);
                    }
                } else {
                    errorDetails = errorData.message || JSON.stringify(errorData);
                }
            } catch (e) {
                const text = await response.text();
                errorDetails = text || 'Failed to list stocktakes';
            }
            throw new Error(errorDetails);
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to list stocktakes';
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        const data = result.data || result;
        return {
            success: true,
            stocktakes: data.stocktakes || []
        };
    }

    // ============================================
    // SCAN SYNCING (Apps Script - File Operations)
    // ============================================

    async syncScans(stocktakeId, scans) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'syncScans',
                stocktakeId,
                scans
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync scans');
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to sync scans';
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        const data = result.data || result;
        // Ensure success flag is set
        return {
            success: true,
            ...data
        };
    }

    async deleteScans(stocktakeId, syncIds) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteScans',
                stocktakeId,
                syncIds
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete scans');
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to delete scans';
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        return result.data || result;
    }

    async loadUserScans(stocktakeId, username = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const requestBody = {
            action: 'loadUserScans',
            stocktakeId
        };
        
        // Only include username if provided (null/undefined means load all scans)
        if (username !== null && username !== undefined) {
            requestBody.username = username;
        }
        
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user scans');
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to load user scans';
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        return result.data || result;
    }

    async syncKegs(stocktakeId, kegs, location, user) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Format kegs for Apps Script
        // Send both 'quantity' and 'count' for backward compatibility with Apps Script
        const formattedKegs = kegs.map(keg => ({
            product: keg.name,
            quantity: keg.count,  // Primary field name
            count: keg.count,     // Also send as 'count' for Apps Script compatibility
            location: location || '',
            user: user || '',
            timestamp: new Date().toISOString()
        }));
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'syncKegs',
                stocktakeId,
                kegs: formattedKegs,
                location,
                user
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to sync kegs: ${errorText}`);
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to sync kegs';
            throw new Error(errorMsg);
        }
        
        // Return success format
        return {
            success: true,
            ...(result.data || result)
        };
    }

    async syncManualEntries(stocktakeId, manualEntries) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // Use Cloudflare Worker proxy (handles CORS properly)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'syncManualEntries',
                stocktakeId,
                manualEntries
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync manual entries');
        }
        
        const result = await response.json();
        if (!result.ok) {
            const errorMsg = result.error?.message || result.message || 'Failed to sync manual entries';
            throw new Error(errorMsg);
        }
        
        // New format: data is wrapped in data object
        return result.data || result;
    }

    // ============================================
    // RECONCILIATION (Cloudflare Workers)
    // ============================================

    async getCurrentStocktake() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/current`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (response.status === 404) {
            return null; // No current stocktake
        }
        
        if (!response.ok) {
            throw new Error('Failed to get current stocktake');
        }
        
        return await response.json();
    }

    async createStocktakeReconciliation(countSheetId, stocktakeName, hnlFile = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const formData = new FormData();
        formData.append('countSheetId', countSheetId);
        formData.append('stocktakeName', stocktakeName);
        if (hnlFile) {
            formData.append('hnlFile', hnlFile);
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/create`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create stocktake reconciliation' }));
            throw new Error(error.error || 'Failed to create stocktake reconciliation');
        }
        
        return await response.json();
    }

    async uploadVarianceReport(stocktakeId, hnlFile) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const formData = new FormData();
        formData.append('hnlFile', hnlFile);
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to upload variance report' }));
            throw new Error(error.error || 'Failed to upload variance report');
        }
        
        return await response.json();
    }

    async getVarianceData(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/variance/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get variance data');
        }
        
        const result = await response.json();
        // Ensure success flag is set
        return {
            success: true,
            varianceData: result.varianceData || result
        };
    }

    async updateVarianceData(stocktakeId, adjustment = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/variance/${stocktakeId}/update`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: adjustment ? JSON.stringify(adjustment) : undefined
        });
        
        if (!response.ok) {
            throw new Error('Failed to update variance data');
        }
        
        return await response.json();
    }

    async completeFirstCounts(stocktakeId) {
        // This triggers matching counts with variance report
        return this.updateVarianceData(stocktakeId);
    }

    async finishStocktake(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/finish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to finish stocktake');
        }
        
        return await response.json();
    }

    // ============================================
    // EXPORTS (Cloudflare Workers)
    // ============================================

    async exportVarianceReport(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/export/variance/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export variance report');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `variance-report-${stocktakeId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async exportManualEntries(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/export/manual/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export manual entries');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual-entries-${stocktakeId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async exportPdfManualEntries(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/export/manual-pdf/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export PDF manual entries');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual-entry-${stocktakeId}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async exportDatFile(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/export/dat/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to export .dat file');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stocktake-${stocktakeId}.dat`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    // ============================================
    // COUNT SHEETS (Cloudflare Workers)
    // ============================================

    async getAvailableCountSheets() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/sheets/count-sheets`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            // Return empty array if error (e.g., no access yet)
            return { success: true, sheets: [] };
        }
        
        return await response.json();
    }

    // ============================================
    // ADMIN (Cloudflare Workers)
    // ============================================

    async getUsers() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to get users' }));
            throw new Error(error.error || 'Failed to get users');
        }
        
        return await response.json();
    }

    async addUser(username, password, role = 'user') {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const hashedPassword = await sha256(password);
        
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password: hashedPassword, role })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to add user' }));
            throw new Error(error.error || 'Failed to add user');
        }
        
        return await response.json();
    }

    async deleteUser(username) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users/${username}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to delete user' }));
            throw new Error(error.error || 'Failed to delete user');
        }
        
        return await response.json();
    }

    async getUserCounts(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/counts/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to get user counts' }));
            throw new Error(error.error || 'Failed to get user counts');
        }
        
        return await response.json();
    }

    async updateFolderId(folderId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/folder-id`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderId })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update folder ID' }));
            throw new Error(error.error || 'Failed to update folder ID');
        }
        
        return await response.json();
    }

    // ============================================
    // STOCKTAKE STAGES
    // ============================================

    async updateStocktakeStatus(stocktakeId, status) {
        const response = await fetch(`${this.workerUrl}/stocktake/${stocktakeId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to update stocktake status' }));
            throw new Error(error.message || 'Failed to update stocktake status');
        }
        
        return await response.json();
    }
    
    async getStocktakeStage(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/stage`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to get stage' }));
            throw new Error(error.error || 'Failed to get stage');
        }
        
        return await response.json();
    }

    async updateStocktakeStage(stocktakeId, stage, autoProgress = false) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/stage`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stage, autoProgress })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update stage' }));
            throw new Error(error.error || 'Failed to update stage');
        }
        
        return await response.json();
    }

    async getTheoreticalProducts(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/theoretical`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to get theoretical products' }));
            throw new Error(error.error || 'Failed to get theoretical products');
        }

        return await response.json();
    }

    // ============================================
    // TEMPLATES (Apps Script - Sheet Operations)
    // ============================================

    async getTemplates(location = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getTemplates',
                location
            })
        });

        if (!response.ok) {
            throw new Error('Failed to load templates');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to load templates');
        }

        return result.data || result;
    }

    async saveTemplate(template) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveTemplate',
                template
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save template');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to save template');
        }

        return result.data || result;
    }

    async deleteTemplate(templateID) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteTemplate',
                templateID
            })
        });

        if (!response.ok) {
            throw new Error('Failed to delete template');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to delete template');
        }

        return result.data || result;
    }

    // ============================================
    // RECIPES (Apps Script - Sheet Operations)
    // ============================================

    async getRecipes(location = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getRecipes',
                location
            })
        });

        if (!response.ok) {
            throw new Error('Failed to load recipes');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to load recipes');
        }

        return result.data || result;
    }

    async saveRecipe(recipe) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveRecipe',
                recipe
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save recipe');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to save recipe');
        }

        return result.data || result;
    }

    async deleteRecipe(recipeID) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteRecipe',
                recipeID
            })
        });

        if (!response.ok) {
            throw new Error('Failed to delete recipe');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to delete recipe');
        }

        return result.data || result;
    }

    // ============================================
    // BATCHES (Apps Script - Sheet Operations)
    // ============================================

    async syncBatches(stocktakeId, batches) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'syncBatches',
                stocktakeId,
                batches
            })
        });

        if (!response.ok) {
            throw new Error('Failed to sync batches');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to sync batches');
        }

        return result.data || result;
    }

    async loadBatches(stocktakeId) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured');
        }

        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'loadBatches',
                stocktakeId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to load batches');
        }

        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to load batches');
        }

        return result.data || result;
    }

    // ============================================
    // ALL PRODUCTS (Cloudflare Workers)
    // ============================================

    async getAllProducts() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${CONFIG.WORKER_URL}/counting/all-products`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load all products');
        }

        return await response.json();
    }

    // ============================================
    // PERMISSIONS (Cloudflare Workers)
    // ============================================

    async getUserPermissions(username = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const url = username
            ? `${CONFIG.WORKER_URL}/admin/permissions/${username}`
            : `${CONFIG.WORKER_URL}/admin/permissions`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to get permissions' }));
            throw new Error(error.error || 'Failed to get permissions');
        }

        return await response.json();
    }

    async updateUserPermissions(username, permissions) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${CONFIG.WORKER_URL}/admin/permissions/${username}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(permissions)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update permissions' }));
            throw new Error(error.error || 'Failed to update permissions');
        }

        return await response.json();
    }
}

// Export singleton instance
const apiService = new UnifiedAPIService();

