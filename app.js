// Unified Stock System - Main Application
// Complete workflow: Login → Select/Create → Upload Variance → Count → Complete → Export

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    user: null,
    token: null,
    currentStocktake: null,
    folderId: null,
    productDatabase: [],
    locations: [],
    kegs: [],
    scannedItems: [],
    manualEntries: [],
    kegsList: [],
    currentLocation: '',
    scanType: 'regular', // 'regular' or 'kegs'
    currentMode: 'scan', // 'scan' or 'search'
    currentProduct: null,
    searchQuery: '',
    searchResults: [],
    varianceData: [],
    isOnline: navigator.onLine,
    isSyncing: false,
    unsyncedCount: 0
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay) {
        overlay.style.display = 'flex';
        if (messageEl) messageEl.textContent = message;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = '';
        el.style.display = 'none';
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    }).format(value);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

// Note: sha256 is defined in api-service.js, no need to redeclare here

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    try {
        // Initialize IndexedDB
        await dbService.init();
        
        // Load saved state
        const savedUser = await dbService.getState('user');
        const savedToken = await dbService.getState('token');
        const savedStocktake = await dbService.getState('currentStocktake');
        const savedFolderId = await dbService.getState('folderId');
        const savedLocation = await dbService.getState('currentLocation');
        
        if (savedUser && savedToken) {
            state.user = savedUser;
            state.token = savedToken;
            apiService.setToken(savedToken);
            
            // Validate token by making a test API call
            try {
                const testResult = await apiService.getProductDatabase();
                // If we get here, token is valid
                
                if (savedStocktake) {
                    state.currentStocktake = savedStocktake;
                }
                
                if (savedFolderId) {
                    state.folderId = savedFolderId;
                }
                
                if (savedLocation) {
                    state.currentLocation = savedLocation;
                }
                
                // Load products and locations from cache
                state.productDatabase = await dbService.getProducts();
                state.locations = await dbService.getLocations();
                
                // Check if we have a current stocktake
                if (state.currentStocktake) {
                    // Load scans for current stocktake
                    const scans = await dbService.getAllScans(state.currentStocktake.id);
                    state.scannedItems = scans;
                    
                    // Count unsynced
                    const unsynced = await dbService.getUnsyncedScans(state.currentStocktake.id);
                    state.unsyncedCount = unsynced.length;
                }
                
                // Show home screen
                showScreen('home-screen');
                await loadHomeScreen();
            } catch (error) {
                // Token is invalid or expired - clear it and show login
                console.warn('Token validation failed, clearing saved state:', error);
                await dbService.saveState('user', null);
                await dbService.saveState('token', null);
                state.user = null;
                state.token = null;
                apiService.setToken(null);
                showScreen('login-screen');
            }
        } else {
            // Show login screen
            showScreen('login-screen');
        }
        
        // Set up online/offline listeners
        window.addEventListener('online', () => {
            state.isOnline = true;
            updateOfflineIndicator();
        });
        
        window.addEventListener('offline', () => {
            state.isOnline = false;
            updateOfflineIndicator();
        });
        
        updateOfflineIndicator();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize application: ' + error.message);
    }
}

function updateOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.style.display = state.isOnline ? 'none' : 'block';
    }
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout buttons
    document.querySelectorAll('#logout-btn, #counting-logout-btn, #reconciliation-logout-btn').forEach(btn => {
        if (btn) btn.addEventListener('click', handleLogout);
    });
    
    // Home screen
    const createStocktakeBtn = document.getElementById('create-stocktake-btn');
    if (createStocktakeBtn) createStocktakeBtn.addEventListener('click', () => {
        if (!state.folderId) {
            alert('Please configure a Google Drive folder ID in Settings before creating a stocktake.');
            return;
        }
        showModal('create-stocktake-modal');
    });
    
    // Folder ID settings
    const saveFolderIdBtn = document.getElementById('save-folder-id-btn');
    if (saveFolderIdBtn) {
        console.log('Setting up save folder ID button listener');
        saveFolderIdBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveFolderId(e);
        });
    } else {
        console.error('save-folder-id-btn not found!');
    }
    
    const clearFolderIdBtn = document.getElementById('clear-folder-id-btn');
    if (clearFolderIdBtn) {
        clearFolderIdBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearFolderId();
        });
    }
    
    const refreshStocktakesBtn = document.getElementById('refresh-stocktakes-btn');
    if (refreshStocktakesBtn) refreshStocktakesBtn.addEventListener('click', loadStocktakes);
    
    const continueStocktakeBtn = document.getElementById('continue-stocktake-btn');
    if (continueStocktakeBtn) continueStocktakeBtn.addEventListener('click', () => {
        if (state.currentStocktake) {
            showScreen('counting-screen');
            loadCountingScreen();
        }
    });
    
    const viewReconciliationBtn = document.getElementById('view-reconciliation-btn');
    if (viewReconciliationBtn) viewReconciliationBtn.addEventListener('click', () => {
        if (state.currentStocktake) {
            showScreen('reconciliation-screen');
            loadReconciliationScreen();
        }
    });
    
    // Create stocktake modal
    const createStocktakeForm = document.getElementById('create-stocktake-form');
    if (createStocktakeForm) {
        createStocktakeForm.addEventListener('submit', handleCreateStocktake);
    }
    
    const cancelCreateBtn = document.getElementById('cancel-create-btn');
    if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', () => hideModal('create-stocktake-modal'));
    
    // Upload variance modal
    const uploadVarianceForm = document.getElementById('upload-variance-form');
    if (uploadVarianceForm) {
        uploadVarianceForm.addEventListener('submit', handleUploadVariance);
    }
    
    const skipUploadBtn = document.getElementById('skip-upload-btn');
    if (skipUploadBtn) skipUploadBtn.addEventListener('click', () => {
        hideModal('upload-variance-modal');
        showScreen('counting-screen');
        loadCountingScreen();
    });
    
    // Counting screen
    setupCountingScreenListeners();
    
    // Reconciliation screen
    setupReconciliationScreenListeners();
}

function setupCountingScreenListeners() {
    // Scan type buttons
    document.querySelectorAll('.scan-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.scan-type-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.scanType = e.target.dataset.type;
            updateCountingScreen();
        });
    });
    
    // Location selector
    const locationSelect = document.getElementById('location-select');
    if (locationSelect) {
        locationSelect.addEventListener('change', (e) => {
            state.currentLocation = e.target.value;
            dbService.saveState('currentLocation', state.currentLocation);
        });
    }
    
    // Barcode input
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleBarcodeSubmit();
            }
        });
    }
    
    // Search product button
    const searchProductBtn = document.getElementById('search-product-btn');
    if (searchProductBtn) searchProductBtn.addEventListener('click', () => {
        state.currentMode = 'search';
        updateCountingScreen();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
    });
    
    // Back to scan button
    const backToScanBtn = document.getElementById('back-to-scan-btn');
    if (backToScanBtn) backToScanBtn.addEventListener('click', () => {
        state.currentMode = 'scan';
        state.searchQuery = '';
        state.searchResults = [];
        updateCountingScreen();
    });
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            handleSearch();
        });
    }
    
    // Quantity input
    const quantityInput = document.getElementById('quantity-input');
    if (quantityInput) {
        quantityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleQuantitySubmit();
            }
        });
    }
    
    // Quick add buttons
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amount = parseInt(e.target.dataset.amount);
            const quantityInput = document.getElementById('quantity-input');
            if (quantityInput) {
                const current = parseFloat(quantityInput.value) || 0;
                quantityInput.value = (current + amount).toString();
            }
        });
    });
    
    // Confirm quantity button
    const confirmQuantityBtn = document.getElementById('confirm-quantity-btn');
    if (confirmQuantityBtn) confirmQuantityBtn.addEventListener('click', handleQuantitySubmit);
    
    // Cancel quantity button
    const cancelQuantityBtn = document.getElementById('cancel-quantity-btn');
    if (cancelQuantityBtn) cancelQuantityBtn.addEventListener('click', () => {
        state.currentProduct = null;
        updateCountingScreen();
    });
    
    // Sync button
    const syncBtn = document.getElementById('counting-sync-btn');
    if (syncBtn) syncBtn.addEventListener('click', syncToServer);
    
    // Manual sync button
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    if (manualSyncBtn) manualSyncBtn.addEventListener('click', syncToServer);
    
    // Complete first counts button
    const completeFirstCountsBtn = document.getElementById('complete-first-counts-btn');
    if (completeFirstCountsBtn) completeFirstCountsBtn.addEventListener('click', handleCompleteFirstCounts);
    
    // Settings button
    const settingsBtn = document.getElementById('counting-settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        showScreen('home-screen');
        loadHomeScreen();
    });
}

function setupReconciliationScreenListeners() {
    // Refresh variance button
    const refreshVarianceBtn = document.getElementById('refresh-variance-btn');
    if (refreshVarianceBtn) refreshVarianceBtn.addEventListener('click', () => {
        showModal('upload-variance-modal');
    });
    
    // Upload variance from recon button
    const uploadVarianceFromReconBtn = document.getElementById('upload-variance-from-recon-btn');
    if (uploadVarianceFromReconBtn) uploadVarianceFromReconBtn.addEventListener('click', () => {
        showModal('upload-variance-modal');
    });
    
    // Back to counting button
    const backToCountingBtn = document.getElementById('back-to-counting-btn');
    if (backToCountingBtn) backToCountingBtn.addEventListener('click', () => {
        showScreen('counting-screen');
        loadCountingScreen();
    });
    
    // Complete stocktake button
    const completeStocktakeBtn = document.getElementById('complete-stocktake-btn');
    if (completeStocktakeBtn) completeStocktakeBtn.addEventListener('click', handleCompleteStocktake);
    
    // Variance search
    const varianceSearch = document.getElementById('variance-search');
    if (varianceSearch) {
        varianceSearch.addEventListener('input', (e) => {
            filterVarianceTable(e.target.value);
        });
    }
    
    // Variance filter
    const varianceFilter = document.getElementById('variance-filter');
    if (varianceFilter) {
        varianceFilter.addEventListener('change', (e) => {
            filterVarianceTable(document.getElementById('variance-search').value, e.target.value);
        });
    }
}

// ============================================
// LOGIN
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (!usernameInput || !passwordInput) return;
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        showError('login-error', 'Please enter both username and password');
        return;
    }
    
    hideError('login-error');
    showLoading('Signing in...');
    
    try {
        const result = await apiService.login(username, password);
        
        if (result.token) {
            state.user = { username: result.username, role: result.role };
            state.token = result.token;
            apiService.setToken(result.token);
            
            // Save to IndexedDB
            await dbService.saveState('user', state.user);
            await dbService.saveState('token', state.token);
            
            // Load folder ID if saved
            const savedFolderId = await dbService.getState('folderId');
            if (savedFolderId) {
                state.folderId = savedFolderId;
            }
            
            // Load products and locations
            await loadProductsAndLocations();
            
            hideLoading();
            showScreen('home-screen');
            await loadHomeScreen();
        } else {
            throw new Error('Login failed');
        }
    } catch (error) {
        hideLoading();
        showError('login-error', error.message || 'Invalid credentials');
        console.error('Login error:', error);
    }
}

async function handleLogout(skipConfirm = false) {
    if (!skipConfirm && state.unsyncedCount > 0) {
        if (!confirm(`You have ${state.unsyncedCount} unsynced scans. Are you sure you want to logout?`)) {
            return;
        }
    }
    
    state.user = null;
    state.token = null;
    state.currentStocktake = null;
    state.scannedItems = [];
    state.manualEntries = [];
    state.kegsList = [];
    state.unsyncedCount = 0;
    
    apiService.setToken(null);
    
    await dbService.saveState('user', null);
    await dbService.saveState('token', null);
    await dbService.saveState('currentStocktake', null);
    
    showScreen('login-screen');
    
    // Clear form
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
}

// ============================================
// FOLDER ID CONFIGURATION
// ============================================

/**
 * Extract folder ID from a Google Drive URL or return the ID if already provided
 * Supports formats:
 * - https://drive.google.com/drive/folders/FOLDER_ID
 * - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 * - FOLDER_ID (direct ID)
 */
function extractFolderId(input) {
    if (!input || !input.trim()) return null;
    
    const trimmed = input.trim();
    
    // Check if it's a URL
    if (trimmed.includes('drive.google.com')) {
        // Extract ID from URL pattern: /folders/FOLDER_ID
        const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    // If it's not a URL, assume it's already an ID
    // Google Drive folder IDs are typically 33 characters, alphanumeric with dashes/underscores
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return trimmed;
    }
    
    return null;
}

async function saveFolderId(e) {
    // Prevent form submission if button is in a form
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log('saveFolderId called');
    
    const input = document.getElementById('folder-id-input');
    const status = document.getElementById('folder-id-status');
    
    if (!input) {
        console.error('folder-id-input not found');
        return;
    }
    
    if (!status) {
        console.error('folder-id-status not found');
        return;
    }
    
    const inputValue = input.value.trim();
    console.log('Input value:', inputValue);
    
    if (!inputValue) {
        status.innerHTML = '<span class="error-text">⚠️ Folder ID is required to create stocktakes</span>';
        status.className = 'folder-status error';
        return;
    }
    
    const folderId = extractFolderId(inputValue);
    console.log('Extracted folder ID:', folderId);
    
    if (!folderId) {
        status.innerHTML = '<span class="error-text">❌ Invalid folder ID or URL format</span>';
        status.className = 'folder-status error';
        return;
    }
    
    try {
        state.folderId = folderId;
        await dbService.saveState('folderId', folderId);
        console.log('Folder ID saved to IndexedDB');
        
        status.innerHTML = '<span class="success-text">✅ Folder ID saved successfully</span>';
        status.className = 'folder-status success';
        
        // Update create button state
        updateCreateButtonState();
        
        // Reload stocktakes with new folder ID (but don't fail if this errors)
        try {
            await loadStocktakes();
        } catch (error) {
            console.warn('Error reloading stocktakes (this is okay):', error);
            // Still show success for saving the folder ID
        }
    } catch (error) {
        console.error('Error saving folder ID:', error);
        status.innerHTML = '<span class="error-text">❌ Error saving folder ID: ' + error.message + '</span>';
        status.className = 'folder-status error';
    }
}

async function clearFolderId() {
    const input = document.getElementById('folder-id-input');
    const status = document.getElementById('folder-id-status');
    
    if (input) input.value = '';
    if (status) {
        status.innerHTML = '';
        status.className = 'folder-status';
    }
    
    state.folderId = null;
    await dbService.saveState('folderId', null);
    
    updateCreateButtonState();
}

function updateFolderIdDisplay() {
    const input = document.getElementById('folder-id-input');
    const status = document.getElementById('folder-id-status');
    
    if (!input || !status) return;
    
    if (state.folderId) {
        input.value = state.folderId;
        status.innerHTML = '<span class="success-text">✅ Folder ID configured</span>';
        status.className = 'folder-status success';
    } else {
        input.value = '';
        status.innerHTML = '<span class="error-text">⚠️ Folder ID required to create stocktakes</span>';
        status.className = 'folder-status error';
    }
    
    updateCreateButtonState();
}

function updateCreateButtonState() {
    const createBtn = document.getElementById('create-stocktake-btn');
    if (createBtn) {
        if (!state.folderId) {
            createBtn.disabled = true;
            createBtn.title = 'Please configure a folder ID in Settings first';
        } else {
            createBtn.disabled = false;
            createBtn.title = '';
        }
    }
}

// ============================================
// HOME SCREEN
// ============================================

async function loadHomeScreen() {
    // Update user info
    const userInfo = document.getElementById('user-info');
    if (userInfo && state.user) {
        userInfo.textContent = `Hello, ${state.user.username}`;
    }
    
    // Update folder ID display
    updateFolderIdDisplay();
    
    // Load stocktakes
    await loadStocktakes();
    
    // Update current stocktake card
    updateCurrentStocktakeCard();
}

async function loadStocktakes() {
    const stocktakesList = document.getElementById('stocktakes-list');
    if (!stocktakesList) return;
    
    stocktakesList.innerHTML = '<p class="loading-text">Loading stocktakes...</p>';
    
    try {
        const result = await apiService.listStocktakes(state.folderId);
        
        if (result.success && result.stocktakes) {
            if (result.stocktakes.length === 0) {
                stocktakesList.innerHTML = '<p class="loading-text">No stocktakes found. Create one to get started!</p>';
            } else {
                stocktakesList.innerHTML = result.stocktakes.map(stocktake => `
                    <div class="stocktake-card" data-id="${stocktake.id}">
                        <h3>${stocktake.displayName || stocktake.name}</h3>
                        <p><strong>Created by:</strong> ${stocktake.createdBy}</p>
                        <p><strong>Created:</strong> ${stocktake.createdDate}</p>
                        <p><strong>Status:</strong> ${stocktake.status}</p>
                        <p><strong>Last modified:</strong> ${formatDate(stocktake.lastModified)}</p>
                    </div>
                `).join('');
                
                // Add click listeners
                document.querySelectorAll('.stocktake-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const stocktakeId = card.dataset.id;
                        const stocktake = result.stocktakes.find(s => s.id === stocktakeId);
                        if (stocktake) {
                            selectStocktake(stocktake);
                        }
                    });
                });
            }
        }
    } catch (error) {
        let errorMessage = error.message || 'Failed to load stocktakes';
        
        // Show helpful message if it's a permission error
        if (errorMessage.includes('Permission denied') || errorMessage.includes('service account')) {
            stocktakesList.innerHTML = `
                <div class="error-card" style="padding: 20px; background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; margin: 16px 0;">
                    <h3 style="color: #dc2626; margin-bottom: 12px;">⚠️ Permission Error</h3>
                    <p style="color: #991b1b; margin-bottom: 16px;">${errorMessage}</p>
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-top: 12px;">
                        <p style="font-weight: 600; margin-bottom: 8px;">To fix this:</p>
                        <ol style="margin-left: 20px; color: #7f1d1d;">
                            <li>Open your Google Drive folder</li>
                            <li>Right-click the folder → <strong>Share</strong></li>
                            <li>Add: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com</code></li>
                            <li>Set permission to <strong>Editor</strong> (for creating stocktakes)</li>
                            <li>Uncheck "Notify people"</li>
                            <li>Click <strong>Share</strong></li>
                        </ol>
                    </div>
                </div>
            `;
        } else {
            stocktakesList.innerHTML = `<p class="loading-text" style="color: var(--red-600);">Error loading stocktakes: ${errorMessage}</p>`;
        }
        console.error('Error loading stocktakes:', error);
    }
}

function updateCurrentStocktakeCard() {
    const card = document.getElementById('current-stocktake-card');
    const info = document.getElementById('current-stocktake-info');
    
    if (card && info) {
        if (state.currentStocktake) {
            card.style.display = 'block';
            info.innerHTML = `
                <p><strong>Name:</strong> ${state.currentStocktake.name}</p>
                <p><strong>ID:</strong> ${state.currentStocktake.id}</p>
            `;
        } else {
            card.style.display = 'none';
        }
    }
}

async function handleCreateStocktake(e) {
    e.preventDefault();
    
    // Validate folder ID is set
    if (!state.folderId) {
        alert('Please configure a Google Drive folder ID in Settings before creating a stocktake.');
        hideModal('create-stocktake-modal');
        return;
    }
    
    const nameInput = document.getElementById('stocktake-name-input');
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        alert('Please enter a stocktake name');
        return;
    }
    
    hideModal('create-stocktake-modal');
    showLoading('Creating stocktake...');
    
    try {
        const result = await apiService.createStocktake(name, state.user.username, state.folderId);
        
        if (result.success) {
            const stocktake = {
                id: result.stocktakeId,
                name: result.name,
                url: result.url
            };
            
            state.currentStocktake = stocktake;
            await dbService.saveState('currentStocktake', stocktake);
            await dbService.saveStocktake(stocktake);
            
            // Prompt for variance upload
            hideLoading();
            showModal('upload-variance-modal');
        } else {
            throw new Error(result.error || result.message || 'Failed to create stocktake');
        }
    } catch (error) {
        hideLoading();
        let errorMessage = error.message || 'Failed to create stocktake';
        
        // Show helpful message if it's a permission error
        if (errorMessage.includes('Permission denied') || errorMessage.includes('service account')) {
            alert(`Permission Error:\n\n${errorMessage}\n\nTo fix this:\n1. Open your Google Drive folder\n2. Right-click → Share\n3. Add: stocktake-worker@stocktake-reconciliation.iam.gserviceaccount.com\n4. Set permission to Editor\n5. Uncheck "Notify people"\n6. Click Share`);
        } else {
            alert('Failed to create stocktake: ' + errorMessage);
        }
        console.error('Create stocktake error:', error);
    }
    
    if (nameInput) nameInput.value = '';
}

async function selectStocktake(stocktake) {
    console.log('Selecting stocktake:', stocktake);
    
    try {
        state.currentStocktake = {
            id: stocktake.id,
            name: stocktake.name || stocktake.displayName,
            url: stocktake.url
        };
        
        await dbService.saveState('currentStocktake', state.currentStocktake);
        await dbService.saveStocktake(state.currentStocktake);
        
        // Load scans for this stocktake (non-blocking - continue even if this fails)
        try {
            const result = await apiService.loadUserScans(stocktake.id, state.user.username);
            if (result.success && result.scans) {
                // Save scans to IndexedDB
                for (const scan of result.scans) {
                    const scanWithMeta = {
                        ...scan,
                        stocktakeId: stocktake.id,
                        stocktakeName: stocktake.name,
                        synced: true
                    };
                    await dbService.saveScan(scanWithMeta);
                }
            }
        } catch (error) {
            console.warn('Error loading user scans (continuing anyway):', error);
            // Continue even if loading scans fails
        }
        
        // Load local scans
        const scans = await dbService.getAllScans(stocktake.id);
        state.scannedItems = scans || [];
        
        const unsynced = await dbService.getUnsyncedScans(stocktake.id);
        state.unsyncedCount = unsynced ? unsynced.length : 0;
        
        // Check if variance report exists
        const varianceData = await dbService.getVarianceData(stocktake.id);
        if (varianceData && varianceData.length > 0) {
            state.varianceData = varianceData;
            // Go to reconciliation screen
            console.log('Variance data found, going to reconciliation screen');
            showScreen('reconciliation-screen');
            loadReconciliationScreen();
        } else {
            // No variance data - go to counting screen or prompt for variance upload
            console.log('No variance data, going to counting screen');
            showScreen('counting-screen');
            loadCountingScreen();
        }
    } catch (error) {
        console.error('Error selecting stocktake:', error);
        alert('Error selecting stocktake: ' + error.message);
    }
}

// ============================================
// PRODUCTS AND LOCATIONS
// ============================================

async function loadProductsAndLocations() {
    try {
        // Load products
        const productsResult = await apiService.getProductDatabase();
        if (productsResult.success) {
            state.productDatabase = productsResult.products;
            await dbService.saveProducts(productsResult.products);
        }
        
        // Load locations
        const locationsResult = await apiService.getLocations();
        if (locationsResult.success) {
            state.locations = locationsResult.locations;
            await dbService.saveLocations(locationsResult.locations);
            
            // Set default location if not set
            if (!state.currentLocation && locationsResult.locations.length > 0) {
                state.currentLocation = locationsResult.locations[0];
                await dbService.saveState('currentLocation', state.currentLocation);
            }
        }
        
        // Load kegs
        const kegsResult = await apiService.getKegs();
        if (kegsResult.success) {
            state.kegs = kegsResult.kegs;
            state.kegsList = kegsResult.kegs.map(keg => ({ ...keg, count: 0 }));
        }
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to cached data
        state.productDatabase = await dbService.getProducts();
        state.locations = await dbService.getLocations();
    }
}

// Continue in next part due to length...


// ============================================
// UPLOAD VARIANCE REPORT
// ============================================

async function handleUploadVariance(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('variance-file-input');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        // Skip upload
        hideModal('upload-variance-modal');
        showScreen('counting-screen');
        loadCountingScreen();
        return;
    }
    
    const file = fileInput.files[0];
    if (!state.currentStocktake) {
        alert('No stocktake selected');
        return;
    }
    
    const progressOverlay = document.getElementById('upload-progress');
    if (progressOverlay) progressOverlay.style.display = 'flex';
    
    try {
        const result = await apiService.uploadVarianceReport(state.currentStocktake.id, file);
        
        if (result.success) {
            // Load variance data
            const varianceResult = await apiService.getVarianceData(state.currentStocktake.id);
            if (varianceResult.success && varianceResult.varianceData) {
                state.varianceData = varianceResult.varianceData;
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
            
            hideModal('upload-variance-modal');
            showScreen('counting-screen');
            loadCountingScreen();
        } else {
            throw new Error(result.message || 'Failed to upload variance report');
        }
    } catch (error) {
        alert('Failed to upload variance report: ' + error.message);
        console.error('Upload variance error:', error);
    } finally {
        if (progressOverlay) progressOverlay.style.display = 'none';
        if (fileInput) fileInput.value = '';
    }
}

// ============================================
// COUNTING SCREEN
// ============================================

async function loadCountingScreen() {
    if (!state.currentStocktake) return;
    
    // Update stocktake info
    const stocktakeInfo = document.getElementById('counting-stocktake-info');
    if (stocktakeInfo) {
        stocktakeInfo.textContent = state.currentStocktake.name;
    }
    
    // Load products and locations if not loaded
    if (state.productDatabase.length === 0 || state.locations.length === 0) {
        await loadProductsAndLocations();
    }
    
    // Update location selector
    const locationSelect = document.getElementById('location-select');
    if (locationSelect) {
        locationSelect.innerHTML = state.locations.map(loc => 
            `<option value="${loc}" ${loc === state.currentLocation ? 'selected' : ''}>${loc}</option>`
        ).join('');
    }
    
    // Load kegs if not loaded
    if (state.kegsList.length === 0 && state.kegs.length > 0) {
        state.kegsList = state.kegs.map(keg => ({ ...keg, count: 0 }));
    }
    
    // Load scans
    const scans = await dbService.getAllScans(state.currentStocktake.id);
    state.scannedItems = scans;
    
    const unsynced = await dbService.getUnsyncedScans(state.currentStocktake.id);
    state.unsyncedCount = unsynced.length;
    
    updateCountingScreen();
}

function updateCountingScreen() {
    // Update scan type buttons
    document.querySelectorAll('.scan-type-btn').forEach(btn => {
        if (btn.dataset.type === state.scanType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show/hide sections based on scan type
    const regularSection = document.getElementById('scanned-items-section');
    const manualSection = document.getElementById('manual-entries-section');
    const kegsSection = document.getElementById('kegs-section');
    const barcodeSection = document.getElementById('barcode-input-section');
    const productConfirmation = document.getElementById('product-confirmation');
    const searchSection = document.getElementById('search-section');
    
    if (state.scanType === 'regular') {
        if (regularSection) regularSection.style.display = 'block';
        if (manualSection) manualSection.style.display = state.manualEntries.length > 0 ? 'block' : 'none';
        if (kegsSection) kegsSection.style.display = 'none';
        
        if (state.currentMode === 'search') {
            if (barcodeSection) barcodeSection.style.display = 'none';
            if (productConfirmation) productConfirmation.style.display = 'none';
            if (searchSection) searchSection.style.display = 'block';
        } else {
            if (barcodeSection) barcodeSection.style.display = state.currentProduct ? 'none' : 'block';
            if (productConfirmation) productConfirmation.style.display = state.currentProduct ? 'block' : 'none';
            if (searchSection) searchSection.style.display = 'none';
        }
    } else {
        if (regularSection) regularSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'none';
        if (kegsSection) kegsSection.style.display = 'block';
        if (barcodeSection) barcodeSection.style.display = 'none';
        if (productConfirmation) productConfirmation.style.display = 'none';
        if (searchSection) searchSection.style.display = 'none';
    }
    
    // Update scanned items list
    updateScannedItemsList();
    
    // Update manual entries list
    updateManualEntriesList();
    
    // Update kegs table
    updateKegsTable();
    
    // Update sync button
    updateSyncButton();
    
    // Update product confirmation
    if (state.currentProduct) {
        updateProductConfirmation();
    }
    
    // Update search results
    if (state.currentMode === 'search') {
        updateSearchResults();
    }
}

function updateScannedItemsList() {
    const list = document.getElementById('scanned-items-list');
    const count = document.getElementById('scanned-count');
    
    if (count) count.textContent = state.scannedItems.length;
    
    if (list) {
        if (state.scannedItems.length === 0) {
            list.innerHTML = '<p class="loading-text">No scans yet. Start scanning!</p>';
        } else {
            list.innerHTML = state.scannedItems.map(scan => `
                <div class="scan-item ${scan.synced ? 'synced' : 'unsynced'}">
                    <div class="scan-item-info">
                        <h4>${scan.product || 'Unknown Product'}</h4>
                        <p>Barcode: ${scan.barcode || 'N/A'} • Qty: ${scan.quantity} • ${scan.location}</p>
                        <p style="font-size: 12px; color: var(--slate-500);">${formatDate(scan.timestamp)}</p>
                    </div>
                    <div class="scan-item-actions">
                        ${scan.synced ? '✓' : '⚠️'}
                        <button onclick="editScan('${scan.syncId}')" title="Edit">✏️</button>
                        <button onclick="deleteScan('${scan.syncId}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function updateManualEntriesList() {
    const list = document.getElementById('manual-entries-list');
    const count = document.getElementById('manual-count');
    
    if (count) count.textContent = state.manualEntries.length;
    
    if (list && state.manualEntries.length > 0) {
        list.innerHTML = state.manualEntries.map(entry => `
            <div class="manual-entry-item">
                <div class="scan-item-info">
                    <h4>✍️ ${entry.product}</h4>
                    <p>Qty: ${entry.quantity} • ${entry.location}</p>
                    <p style="font-size: 12px; color: var(--slate-500);">${formatDate(entry.timestamp)}</p>
                </div>
                <div class="scan-item-actions">
                    <button onclick="deleteManualEntry('${entry.syncId}')" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }
}

function updateKegsTable() {
    const container = document.getElementById('kegs-table-container');
    if (!container) return;
    
    if (state.kegsList.length === 0) {
        container.innerHTML = '<p class="loading-text">Loading kegs...</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="kegs-table">
            <thead>
                <tr>
                    <th>Keg Name</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${state.kegsList.map((keg, idx) => `
                    <tr>
                        <td>${keg.name}</td>
                        <td>
                            <input type="number" 
                                   value="${keg.count}" 
                                   min="0"
                                   onchange="updateKegCount(${idx}, this.value)"
                                   style="width: 96px; padding: 8px; text-align: center; border: 2px solid var(--orange-300); border-radius: 8px; font-weight: bold; font-size: 18px;">
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function updateKegCount(index, value) {
    if (state.kegsList[index]) {
        state.kegsList[index].count = parseInt(value) || 0;
    }
}

function updateProductConfirmation() {
    const productName = document.getElementById('product-name');
    const productDetails = document.getElementById('product-details');
    
    if (productName && state.currentProduct) {
        productName.textContent = state.currentProduct.product || 'Unknown Product';
    }
    
    if (productDetails && state.currentProduct) {
        productDetails.innerHTML = `
            Barcode: ${state.currentProduct.barcode || 'N/A'}<br>
            Current Stock: ${state.currentProduct.currentStock || 0} • Value: ${formatCurrency(state.currentProduct.value || 0)}
        `;
    }
}

function updateSearchResults() {
    const results = document.getElementById('search-results');
    if (!results) return;
    
    if (state.searchResults.length === 0 && state.searchQuery.trim()) {
        results.innerHTML = `
            <div style="padding: 16px; background: var(--purple-50); border: 2px solid var(--purple-200); border-radius: 8px; margin-top: 16px;">
                <p style="color: var(--purple-800); font-weight: 600; margin-bottom: 12px;">✍️ Product not found in database</p>
                <p style="color: var(--purple-700); font-size: 14px; margin-bottom: 16px;">Create a manual entry for: "${state.searchQuery}"</p>
                <button class="btn-primary" onclick="createManualEntryFromSearch()">✍️ Create Manual Entry</button>
            </div>
        `;
    } else if (state.searchResults.length > 0) {
        results.innerHTML = state.searchResults.map(product => `
            <div class="search-result-item" onclick="selectSearchResult('${product.barcode}')">
                <h4>${product.product}</h4>
                <p>Barcode: ${product.barcode} • Stock: ${product.currentStock || 0}</p>
            </div>
        `).join('');
    } else {
        results.innerHTML = '';
    }
}

function updateSyncButton() {
    const syncBtn = document.getElementById('counting-sync-btn');
    const syncStatusText = document.getElementById('sync-status-text');
    const unsyncedBadge = document.getElementById('unsynced-count-badge');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    if (syncBtn) {
        syncBtn.disabled = !state.isOnline || state.isSyncing || state.unsyncedCount === 0;
    }
    
    if (syncStatusText) {
        syncStatusText.textContent = state.isSyncing ? 'Syncing...' : 'Sync';
    }
    
    if (unsyncedBadge) {
        if (state.unsyncedCount > 0) {
            unsyncedBadge.textContent = state.unsyncedCount;
            unsyncedBadge.style.display = 'inline-block';
        } else {
            unsyncedBadge.style.display = 'none';
        }
    }
    
    if (manualSyncBtn) {
        manualSyncBtn.disabled = !state.isOnline || state.isSyncing || state.unsyncedCount === 0;
    }
}

// ============================================
// BARCODE SCANNING
// ============================================

async function handleBarcodeSubmit() {
    const barcodeInput = document.getElementById('barcode-input');
    if (!barcodeInput) return;
    
    const barcode = barcodeInput.value.trim();
    if (!barcode) return;
    
    // Find product
    const product = state.productDatabase.find(p => p.barcode === barcode);
    
    if (product) {
        state.currentProduct = product;
        barcodeInput.value = '';
        updateCountingScreen();
        
        // Focus quantity input
        setTimeout(() => {
            const quantityInput = document.getElementById('quantity-input');
            if (quantityInput) quantityInput.focus();
        }, 100);
    } else {
        // Product not found - offer to create manual entry
        state.currentProduct = {
            barcode: barcode,
            product: 'UNKNOWN - Manual Entry Required',
            currentStock: 0,
            value: 0,
            isManualEntry: true
        };
        barcodeInput.value = '';
        updateCountingScreen();
        
        setTimeout(() => {
            const quantityInput = document.getElementById('quantity-input');
            if (quantityInput) quantityInput.focus();
        }, 100);
    }
}

async function handleQuantitySubmit() {
    const quantityInput = document.getElementById('quantity-input');
    if (!quantityInput || !state.currentProduct) return;
    
    const quantity = parseFloat(quantityInput.value);
    if (isNaN(quantity) || quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    if (!state.currentStocktake) {
        alert('No stocktake selected');
        return;
    }
    
    const scan = {
        syncId: `${Date.now()}-${Math.random()}`,
        barcode: state.currentProduct.isManualEntry ? '' : state.currentProduct.barcode,
        product: state.currentProduct.product,
        quantity: quantity,
        location: state.currentLocation,
        user: state.user.username,
        timestamp: new Date().toISOString(),
        stockLevel: state.currentProduct.currentStock || 0,
        value: state.currentProduct.value || 0,
        synced: false,
        isManualEntry: state.currentProduct.isManualEntry || false,
        stocktakeId: state.currentStocktake.id,
        stocktakeName: state.currentStocktake.name,
        source: 'local_scan'
    };
    
    // Save to IndexedDB
    await dbService.saveScan(scan);
    
    if (scan.isManualEntry) {
        // Add to manual entries
        state.manualEntries.push(scan);
        await dbService.saveManualEntry(scan);
    } else {
        // Add to scanned items
        state.scannedItems.unshift(scan);
    }
    
    state.unsyncedCount++;
    state.currentProduct = null;
    quantityInput.value = '';
    
    updateCountingScreen();
    
    // Auto-sync every 10 scans
    if (state.unsyncedCount >= 10 && state.isOnline) {
        syncToServer();
    }
}

// ============================================
// SEARCH
// ============================================

function handleSearch() {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) {
        state.searchResults = [];
        updateSearchResults();
        return;
    }
    
    state.searchResults = state.productDatabase.filter(p =>
        p.product.toLowerCase().includes(query) ||
        p.barcode.toString().includes(query)
    );
    
    updateSearchResults();
}

function selectSearchResult(barcode) {
    const product = state.productDatabase.find(p => p.barcode === barcode);
    if (product) {
        state.currentProduct = product;
        state.currentMode = 'scan';
        state.searchQuery = '';
        state.searchResults = [];
        updateCountingScreen();
        
        setTimeout(() => {
            const quantityInput = document.getElementById('quantity-input');
            if (quantityInput) quantityInput.focus();
        }, 100);
    }
}

function createManualEntryFromSearch() {
    state.currentProduct = {
        barcode: '',
        product: state.searchQuery,
        currentStock: 0,
        value: 0,
        isManualEntry: true
    };
    state.currentMode = 'scan';
    state.searchQuery = '';
    state.searchResults = [];
    updateCountingScreen();
    
    setTimeout(() => {
        const quantityInput = document.getElementById('quantity-input');
        if (quantityInput) quantityInput.focus();
    }, 100);
}

// ============================================
// EDIT/DELETE SCANS
// ============================================

async function editScan(syncId) {
    const scan = state.scannedItems.find(s => s.syncId === syncId);
    if (!scan) return;
    
    const newQuantity = prompt('Enter new quantity:', scan.quantity);
    if (newQuantity === null) return;
    
    const quantity = parseFloat(newQuantity);
    if (isNaN(quantity) || quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    scan.quantity = quantity;
    scan.synced = false;
    
    await dbService.saveScan(scan);
    state.unsyncedCount++;
    
    updateCountingScreen();
}

async function deleteScan(syncId) {
    const scan = state.scannedItems.find(s => s.syncId === syncId);
    if (!scan) return;
    
    if (!confirm(`Delete scan of ${scan.product}?`)) return;
    
    // Remove from array
    state.scannedItems = state.scannedItems.filter(s => s.syncId !== syncId);
    
    // Delete from IndexedDB
    await dbService.deleteScan(syncId);
    
    if (!scan.synced) {
        state.unsyncedCount--;
    }
    
    updateCountingScreen();
}

async function deleteManualEntry(syncId) {
    const entry = state.manualEntries.find(e => e.syncId === syncId);
    if (!entry) return;
    
    if (!confirm(`Delete manual entry for ${entry.product}?`)) return;
    
    state.manualEntries = state.manualEntries.filter(e => e.syncId !== syncId);
    await dbService.deleteManualEntry(syncId);
    
    updateCountingScreen();
}

// ============================================
// SYNC OPERATIONS
// ============================================

async function syncToServer() {
    if (!state.currentStocktake || !state.isOnline || state.isSyncing) return;
    
    state.isSyncing = true;
    updateSyncButton();
    
    try {
        // Sync regular scans
        const unsyncedScans = await dbService.getUnsyncedScans(state.currentStocktake.id);
        if (unsyncedScans.length > 0) {
            const result = await apiService.syncScans(state.currentStocktake.id, unsyncedScans);
            if (result.success) {
                await dbService.markScansSynced(result.syncedIds);
                state.unsyncedCount -= result.syncedIds.length;
            }
        }
        
        // Sync manual entries
        if (state.manualEntries.length > 0) {
            const unsyncedManual = state.manualEntries.filter(e => !e.synced);
            if (unsyncedManual.length > 0) {
                const result = await apiService.syncManualEntries(state.currentStocktake.id, unsyncedManual);
                if (result.success) {
                    await dbService.markScansSynced(unsyncedManual.map(e => e.syncId));
                    state.manualEntries = state.manualEntries.map(e => 
                        unsyncedManual.find(u => u.syncId === e.syncId) ? { ...e, synced: true } : e
                    );
                }
            }
        }
        
        // Sync kegs
        const kegsWithCounts = state.kegsList.filter(k => k.count > 0);
        if (kegsWithCounts.length > 0) {
            const result = await apiService.syncKegs(
                state.currentStocktake.id,
                kegsWithCounts,
                state.currentLocation,
                state.user.username
            );
            if (result.success) {
                // Reset keg counts
                state.kegsList = state.kegsList.map(k => ({ ...k, count: 0 }));
            }
        }
        
        // Reload scans to get updated state
        const scans = await dbService.getAllScans(state.currentStocktake.id);
        state.scannedItems = scans;
        
        updateCountingScreen();
        
    } catch (error) {
        console.error('Sync error:', error);
        alert('Sync failed: ' + error.message);
    } finally {
        state.isSyncing = false;
        updateSyncButton();
    }
}

// ============================================
// COMPLETE FIRST COUNTS
// ============================================

async function handleCompleteFirstCounts() {
    if (!state.currentStocktake) return;
    
    if (!confirm('Complete first counts? This will match your counts with the variance report.')) return;
    
    showLoading('Matching counts with variance report...');
    
    try {
        // Sync all unsynced scans first
        await syncToServer();
        
        // Update variance data
        const result = await apiService.completeFirstCounts(state.currentStocktake.id);
        
        if (result.success) {
            // Reload variance data
            const varianceResult = await apiService.getVarianceData(state.currentStocktake.id);
            if (varianceResult.success && varianceResult.varianceData) {
                state.varianceData = varianceResult.varianceData;
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
            
            hideLoading();
            showScreen('reconciliation-screen');
            loadReconciliationScreen();
        } else {
            throw new Error(result.message || 'Failed to complete first counts');
        }
    } catch (error) {
        hideLoading();
        alert('Failed to complete first counts: ' + error.message);
        console.error('Complete first counts error:', error);
    }
}

// ============================================
// RECONCILIATION SCREEN
// ============================================

async function loadReconciliationScreen() {
    if (!state.currentStocktake) return;
    
    // Update stocktake info
    const stocktakeInfo = document.getElementById('reconciliation-stocktake-info');
    if (stocktakeInfo) {
        stocktakeInfo.textContent = state.currentStocktake.name;
    }
    
    // Load variance data if not loaded
    if (state.varianceData.length === 0) {
        try {
            const result = await apiService.getVarianceData(state.currentStocktake.id);
            if (result.success && result.varianceData) {
                state.varianceData = result.varianceData;
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
        } catch (error) {
            console.error('Error loading variance data:', error);
        }
    }
    
    // Update variance status
    updateVarianceStatus();
    
    // Render variance table
    renderVarianceTable();
}

function updateVarianceStatus() {
    const statusInfo = document.getElementById('variance-status-info');
    if (!statusInfo) return;
    
    if (state.varianceData.length === 0) {
        statusInfo.innerHTML = '<p style="color: var(--slate-600);">No variance report uploaded yet.</p>';
    } else {
        const totalItems = state.varianceData.length;
        const withVariance = state.varianceData.filter(v => Math.abs(v.varianceQty) > 0).length;
        statusInfo.innerHTML = `
            <p><strong>Total Items:</strong> ${totalItems}</p>
            <p><strong>Items with Variance:</strong> ${withVariance}</p>
        `;
    }
}

function renderVarianceTable() {
    const tbody = document.getElementById('variance-table-body');
    if (!tbody) return;
    
    if (state.varianceData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No variance data available. Upload a variance report first.</td></tr>';
        return;
    }
    
    tbody.innerHTML = state.varianceData.map(item => {
        const varianceQtyClass = item.varianceQty > 0 ? 'variance-positive' : item.varianceQty < 0 ? 'variance-negative' : '';
        return `
            <tr>
                <td>${item.product || 'N/A'}</td>
                <td>${item.barcode || 'N/A'}</td>
                <td>${item.theoreticalQty || 0}</td>
                <td>${item.countedQty || 0}</td>
                <td class="${varianceQtyClass}">${item.varianceQty || 0}</td>
                <td class="${varianceQtyClass}">${formatCurrency(item.varianceValue || 0)}</td>
                <td>
                    <button class="btn-secondary" onclick="editVarianceItem('${item.barcode || ''}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterVarianceTable(searchQuery = '', filterType = 'all') {
    // This would filter the variance table - implementation depends on requirements
    renderVarianceTable();
}

function editVarianceItem(barcode) {
    // This would open an edit modal for variance items
    alert('Edit variance item functionality - to be implemented');
}

// ============================================
// COMPLETE STOCKTAKE
// ============================================

async function handleCompleteStocktake() {
    if (!state.currentStocktake) return;
    
    if (!confirm('Complete stocktake? This will generate the .dat file and manual entries list.')) return;
    
    showLoading('Completing stocktake...');
    
    try {
        // Sync all unsynced data first
        await syncToServer();
        
        // Finish stocktake
        const result = await apiService.finishStocktake(state.currentStocktake.id);
        
        if (result.success) {
            // Export files
            await apiService.exportDatFile(state.currentStocktake.id);
            await apiService.exportManualEntries(state.currentStocktake.id);
            
            hideLoading();
            alert('Stocktake completed! Files have been downloaded.');
            
            // Return to home screen
            state.currentStocktake = null;
            await dbService.saveState('currentStocktake', null);
            showScreen('home-screen');
            loadHomeScreen();
        } else {
            throw new Error(result.message || 'Failed to complete stocktake');
        }
    } catch (error) {
        hideLoading();
        alert('Failed to complete stocktake: ' + error.message);
        console.error('Complete stocktake error:', error);
    }
}

// ============================================
// START APPLICATION
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
