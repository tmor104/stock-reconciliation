// Unified API Service
// Hybrid approach: Apps Script for file operations, Cloudflare Workers for auth and complex logic

const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyRxTKP3KGCiGKhkraeaSz9rxEknGR6mF0LnGQBzMuXp_WfjLf7DtLULC0924ZJcmwQ/exec',
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

    async getKegs() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/kegs`, {
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
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createStocktake',
                name,
                user
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create stocktake');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to create stocktake');
        }
        
        return {
            success: true,
            stocktakeId: result.stocktakeId,
            name: result.name,
            url: result.url
        };
    }

    async listStocktakes(folderId = null) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'listStocktakes'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to list stocktakes');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to list stocktakes');
        }
        
        return {
            success: true,
            stocktakes: result.stocktakes || []
        };
    }

    // ============================================
    // SCAN SYNCING (Apps Script - File Operations)
    // ============================================

    async syncScans(stocktakeId, scans) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
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
        if (!result.success) {
            throw new Error(result.message || 'Failed to sync scans');
        }
        
        return result;
    }

    async deleteScans(stocktakeId, syncIds) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
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
        if (!result.success) {
            throw new Error(result.message || 'Failed to delete scans');
        }
        
        return result;
    }

    async loadUserScans(stocktakeId, username) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'loadUserScans',
                stocktakeId,
                username
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user scans');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to load user scans');
        }
        
        return result;
    }

    async syncKegs(stocktakeId, kegs, location, user) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'syncKegs',
                stocktakeId,
                kegs,
                location,
                user
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync kegs');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Failed to sync kegs');
        }
        
        return result;
    }

    async syncManualEntries(stocktakeId, manualEntries) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error('Apps Script URL not configured. Please set APPS_SCRIPT_URL in api-service.js');
        }
        
        // No Content-Type header = simple request = no preflight (Apps Script doesn't handle OPTIONS)
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
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
        if (!result.success) {
            throw new Error(result.message || 'Failed to sync manual entries');
        }
        
        return result;
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
        
        return await response.json();
    }

    async updateVarianceData(stocktakeId) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/variance/${stocktakeId}/update`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
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
}

// Export singleton instance
const apiService = new UnifiedAPIService();

