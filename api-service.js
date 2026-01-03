// Unified API Service
// All operations go through Cloudflare Workers (no Apps Script needed!)

const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev',
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
    // STOCKTAKE MANAGEMENT (Cloudflare Workers)
    // ============================================

    async createStocktake(name, user, folderId = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/stocktake/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, user, folderId })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create stocktake' }));
            throw new Error(error.error || 'Failed to create stocktake');
        }
        
        return await response.json();
    }

    async listStocktakes(folderId = null) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const url = folderId 
            ? `${CONFIG.WORKER_URL}/counting/stocktakes?folderId=${encodeURIComponent(folderId)}`
            : `${CONFIG.WORKER_URL}/counting/stocktakes`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            // If 401, token is invalid - clear it
            if (response.status === 401) {
                this.token = null;
                // Clear from IndexedDB
                if (typeof dbService !== 'undefined') {
                    dbService.saveState('token', null).catch(console.error);
                    dbService.saveState('user', null).catch(console.error);
                }
                // Trigger logout (skip confirmation for expired tokens)
                if (typeof handleLogout === 'function') {
                    handleLogout(true);
                }
                throw new Error('Session expired. Please log in again.');
            }
            
            let errorMessage = 'Failed to list stocktakes';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = `Failed to list stocktakes (${response.status})`;
            }
            throw new Error(errorMessage);
        }
        
        return await response.json();
    }

    // ============================================
    // SCAN SYNCING (Cloudflare Workers)
    // ============================================

    async syncScans(stocktakeId, scans) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/scans/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stocktakeId, scans })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync scans');
        }
        
        return await response.json();
    }

    async deleteScans(stocktakeId, syncIds) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/scans/delete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stocktakeId, syncIds })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete scans');
        }
        
        return await response.json();
    }

    async loadUserScans(stocktakeId, username) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/scans/${stocktakeId}/${username}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user scans');
        }
        
        return await response.json();
    }

    async syncKegs(stocktakeId, kegs, location, user) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/kegs/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stocktakeId, kegs, location, user })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync kegs');
        }
        
        return await response.json();
    }

    async syncManualEntries(stocktakeId, manualEntries) {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch(`${CONFIG.WORKER_URL}/counting/manual/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stocktakeId, manualEntries })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync manual entries');
        }
        
        return await response.json();
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

