// IndexedDB Service - Heavy usage for offline reliability
// All data is stored locally to prevent data loss on refresh or network issues

const DB_NAME = 'UnifiedStockSystemDB';
const DB_VERSION = 1;

class IndexedDBService {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for scans
                if (!db.objectStoreNames.contains('scans')) {
                    const scansStore = db.createObjectStore('scans', { keyPath: 'syncId' });
                    scansStore.createIndex('synced', 'synced', { unique: false });
                    scansStore.createIndex('timestamp', 'timestamp', { unique: false });
                    scansStore.createIndex('stocktakeId', 'stocktakeId', { unique: false });
                    scansStore.createIndex('user', 'user', { unique: false });
                }

                // Store for app state
                if (!db.objectStoreNames.contains('appState')) {
                    db.createObjectStore('appState', { keyPath: 'key' });
                }

                // Store for product database
                if (!db.objectStoreNames.contains('products')) {
                    const productsStore = db.createObjectStore('products', { keyPath: 'barcode' });
                    productsStore.createIndex('product', 'product', { unique: false });
                }

                // Store for locations
                if (!db.objectStoreNames.contains('locations')) {
                    db.createObjectStore('locations', { keyPath: 'name' });
                }

                // Store for stocktakes
                if (!db.objectStoreNames.contains('stocktakes')) {
                    const stocktakesStore = db.createObjectStore('stocktakes', { keyPath: 'id' });
                    stocktakesStore.createIndex('name', 'name', { unique: false });
                }

                // Store for variance data
                if (!db.objectStoreNames.contains('varianceData')) {
                    const varianceStore = db.createObjectStore('varianceData', { keyPath: 'stocktakeId' });
                }

                // Store for manual entries
                if (!db.objectStoreNames.contains('manualEntries')) {
                    const manualStore = db.createObjectStore('manualEntries', { keyPath: 'syncId' });
                    manualStore.createIndex('stocktakeId', 'stocktakeId', { unique: false });
                }

                // Store for kegs
                if (!db.objectStoreNames.contains('kegs')) {
                    const kegsStore = db.createObjectStore('kegs', { keyPath: 'id' });
                    kegsStore.createIndex('stocktakeId', 'stocktakeId', { unique: false });
                }
            };
        });
    }

    // ============================================
    // SCANS
    // ============================================

    async saveScan(scan) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readwrite');
        const store = tx.objectStore('scans');
        await store.put(scan);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getUnsyncedScans(stocktakeId = null) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readonly');
        const store = tx.objectStore('scans');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                let unsynced = request.result.filter(scan => !scan.synced);
                if (stocktakeId) {
                    unsynced = unsynced.filter(scan => scan.stocktakeId === stocktakeId);
                }
                resolve(unsynced);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllScans(stocktakeId = null) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readonly');
        const store = tx.objectStore('scans');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                let scans = request.result;
                if (stocktakeId) {
                    scans = scans.filter(scan => scan.stocktakeId === stocktakeId);
                }
                // Sort by timestamp (newest first)
                scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(scans);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async markScansSynced(syncIds) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readwrite');
        const store = tx.objectStore('scans');

        const updatePromises = syncIds.map(syncId => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(syncId);
                getRequest.onsuccess = () => {
                    const scan = getRequest.result;
                    if (scan) {
                        scan.synced = true;
                        const putRequest = store.put(scan);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });

        await Promise.all(updatePromises);
    }

    async deleteScan(syncId) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readwrite');
        const store = tx.objectStore('scans');
        await store.delete(syncId);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async clearScans(stocktakeId = null) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['scans'], 'readwrite');
        const store = tx.objectStore('scans');
        
        if (stocktakeId) {
            const request = store.getAll();
            request.onsuccess = () => {
                const scans = request.result.filter(scan => scan.stocktakeId === stocktakeId);
                scans.forEach(scan => store.delete(scan.syncId));
            };
        } else {
            await store.clear();
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ============================================
    // APP STATE
    // ============================================

    async saveState(key, value) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['appState'], 'readwrite');
        const store = tx.objectStore('appState');
        await store.put({ key, value });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getState(key) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['appState'], 'readonly');
        const store = tx.objectStore('appState');
        const request = store.get(key);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // PRODUCTS
    // ============================================

    async saveProducts(products) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['products'], 'readwrite');
        const store = tx.objectStore('products');
        await store.clear();
        
        for (const product of products) {
            await store.put(product);
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getProducts() {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['products'], 'readonly');
        const store = tx.objectStore('products');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // LOCATIONS
    // ============================================

    async saveLocations(locations) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['locations'], 'readwrite');
        const store = tx.objectStore('locations');
        await store.clear();
        
        for (const location of locations) {
            await store.put({ name: location });
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getLocations() {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['locations'], 'readonly');
        const store = tx.objectStore('locations');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result.map(l => l.name));
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // STOCKTAKES
    // ============================================

    async saveStocktake(stocktake) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['stocktakes'], 'readwrite');
        const store = tx.objectStore('stocktakes');
        await store.put(stocktake);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getStocktake(id) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['stocktakes'], 'readonly');
        const store = tx.objectStore('stocktakes');
        const request = store.get(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllStocktakes() {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['stocktakes'], 'readonly');
        const store = tx.objectStore('stocktakes');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // VARIANCE DATA
    // ============================================

    async saveVarianceData(stocktakeId, varianceData) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['varianceData'], 'readwrite');
        const store = tx.objectStore('varianceData');
        await store.put({ stocktakeId, data: varianceData, timestamp: new Date().toISOString() });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getVarianceData(stocktakeId) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['varianceData'], 'readonly');
        const store = tx.objectStore('varianceData');
        const request = store.get(stocktakeId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // MANUAL ENTRIES
    // ============================================

    async saveManualEntry(entry) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['manualEntries'], 'readwrite');
        const store = tx.objectStore('manualEntries');
        await store.put(entry);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllManualEntries(stocktakeId = null) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['manualEntries'], 'readonly');
        const store = tx.objectStore('manualEntries');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                let entries = request.result;
                if (stocktakeId) {
                    entries = entries.filter(entry => entry.stocktakeId === stocktakeId);
                }
                resolve(entries);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteManualEntry(syncId) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['manualEntries'], 'readwrite');
        const store = tx.objectStore('manualEntries');
        await store.delete(syncId);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ============================================
    // KEGS
    // ============================================

    async saveKegs(stocktakeId, kegs) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['kegs'], 'readwrite');
        const store = tx.objectStore('kegs');
        
        // Clear existing kegs for this stocktake
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
            const existingKegs = getAllRequest.result.filter(k => k.stocktakeId === stocktakeId);
            existingKegs.forEach(k => store.delete(k.id));
            
            // Save new kegs
            kegs.forEach((keg, index) => {
                store.put({ id: `${stocktakeId}-${index}`, stocktakeId, ...keg });
            });
        };
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getKegs(stocktakeId) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['kegs'], 'readonly');
        const store = tx.objectStore('kegs');
        const index = store.index('stocktakeId');
        const request = index.getAll(stocktakeId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
const dbService = new IndexedDBService();


