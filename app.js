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
    hasBlockingIssues: false,
    varianceData: [],
    filteredVarianceData: null,
    sortColumn: null,
    sortDirection: 'desc', // 'asc' or 'desc'
    selectedStockGroups: [],
    currentStage: '1', // Stocktake stage (1-7)
    theoreticalProducts: [], // Products from HnL import (for search)
    stageNames: {
        '1': 'Create Stocktake',
        '2': 'First Counts',
        '3': 'First Counts Review',
        '4': 'Variance Report',
        '5': 'Variance Review and Recounts',
        '6': 'Complete and Export',
        '7': 'Save Data for Comparison'
    },
    isOnline: navigator.onLine,
    isSyncing: false,
    unsyncedCount: 0,
    unsyncedKegsCount: 0
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
                    // Load scans from Google Sheets and merge with local
                    await loadScansForStocktake(state.currentStocktake.id, state.user.username);
                    
                    // Load scans for current stocktake (filtered by current user)
                    const allScans = await dbService.getAllScans(state.currentStocktake.id);
                    state.scannedItems = allScans.filter(scan => scan.user === state.user.username);
                    
                    // Count unsynced (only current user's scans)
                    const unsynced = await dbService.getUnsyncedScans(state.currentStocktake.id);
                    state.unsyncedCount = unsynced.filter(scan => scan.user === state.user.username).length;
                    
                    // Check for issues
                    await checkForIssues(state.currentStocktake.id, state.user.username);
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
            alert('Please configure a Google Drive folder ID in Admin Settings before creating a stocktake.');
            return;
        }
        showModal('create-stocktake-modal');
    });
    
    // Admin panel button (on home screen)
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', async () => {
            showScreen('admin-screen');
            await loadAdminPanel();
        });
    }
    
    // Progress stage button
    const progressStageBtn = document.getElementById('progress-stage-btn');
    if (progressStageBtn) {
        progressStageBtn.addEventListener('click', () => handleProgressStage('forward'));
    }
    
    // Rollback stage button (admin only)
    const rollbackStageBtn = document.getElementById('rollback-stage-btn');
    if (rollbackStageBtn) {
        rollbackStageBtn.addEventListener('click', () => handleProgressStage('backward'));
    }
    
    // Folder ID settings (removed from main page, now in admin panel)
    // These buttons are only in the admin panel now
    
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
    
    // Admin panel
    setupAdminPanelListeners();
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
    
    // Keg sync button (also calls syncToServer which handles kegs)
    const syncKegsBtn = document.getElementById('sync-kegs-btn');
    if (syncKegsBtn) syncKegsBtn.addEventListener('click', syncToServer);
    
    // Complete first counts button
    const completeFirstCountsBtn = document.getElementById('complete-first-counts-btn');
    if (completeFirstCountsBtn) completeFirstCountsBtn.addEventListener('click', handleCompleteFirstCounts);
    
    // First Counts Review buttons
    const continueReviewBtn = document.getElementById('continue-review-btn');
    if (continueReviewBtn) {
        continueReviewBtn.addEventListener('click', async () => {
            // Progress to stage 4 (Variance Report)
            try {
                await apiService.updateStocktakeStage(state.currentStocktake.id, '4', true);
                state.currentStage = '4';
                updateStageDisplay();
                applyStageRestrictions();
                
                // Go to reconciliation screen
                showScreen('reconciliation-screen');
                loadReconciliationScreen();
            } catch (error) {
                console.error('Failed to progress to stage 4:', error);
                alert('Failed to progress stage: ' + error.message);
            }
        });
    }
    
    const backToCountingBtn = document.getElementById('back-to-counting-btn');
    if (backToCountingBtn) {
        backToCountingBtn.addEventListener('click', () => {
            // Go back to stage 2 (First Counts)
            apiService.updateStocktakeStage(state.currentStocktake.id, '2', true).then(() => {
                state.currentStage = '2';
                updateStageDisplay();
                applyStageRestrictions();
            }).catch(err => console.warn('Failed to go back to stage 2:', err));
        });
    }
    
    // Settings button
    const settingsBtn = document.getElementById('counting-settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        showScreen('home-screen');
        loadHomeScreen();
    });
}

function setupReconciliationScreenListeners() {
    // Refresh variance button - reloads from sheet and updates reconciliation
    const refreshVarianceBtn = document.getElementById('refresh-variance-btn');
    if (refreshVarianceBtn) refreshVarianceBtn.addEventListener('click', async () => {
        if (!state.currentStocktake) return;
        showLoading('Refreshing variance report from sheet...');
        try {
            // Reload variance data from Google Sheets (this will get latest counts)
            const result = await apiService.getVarianceData(state.currentStocktake.id);
            if (result.success && result.varianceData) {
                if (result.varianceData.items && Array.isArray(result.varianceData.items)) {
                    state.varianceData = result.varianceData.items;
                } else if (Array.isArray(result.varianceData)) {
                    state.varianceData = result.varianceData;
                } else {
                    state.varianceData = [];
                }
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
                state.filteredVarianceData = null; // Clear filter to show all data
                updateVarianceStatus();
                renderVarianceTable();
                updateVarianceDashboard();
                hideLoading();
                alert('✓ Variance report refreshed from Google Sheets');
            } else {
                throw new Error('Failed to refresh variance data');
            }
        } catch (error) {
            hideLoading();
            alert('Failed to refresh variance report: ' + error.message);
            console.error('Refresh variance error:', error);
        }
    });
    
    // Admin button from reconciliation screen
    const adminFromReconBtn = document.getElementById('admin-from-recon-btn');
    if (adminFromReconBtn) {
        adminFromReconBtn.addEventListener('click', async () => {
            showScreen('admin-screen');
            await loadAdminPanel();
        });
        // Show only for admins
        if (state.user && state.user.role === 'admin') {
            adminFromReconBtn.style.display = 'inline-block';
        }
    }
    
    // Old refresh button handler (if exists)
    const oldRefreshBtn = document.getElementById('refresh-variance-btn-old');
    if (oldRefreshBtn) oldRefreshBtn.addEventListener('click', () => {
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
    
    // Stock group filter
    const stockGroupFilter = document.getElementById('stock-group-filter');
    if (stockGroupFilter) {
        stockGroupFilter.addEventListener('change', (e) => {
            const selected = Array.from(e.target.selectedOptions).map(opt => opt.value).filter(v => v);
            state.selectedStockGroups = selected;
            filterVarianceTable(
                document.getElementById('variance-search').value,
                document.getElementById('variance-filter').value
            );
        });
    }
    
    // Sortable column headers
    document.querySelectorAll('.sortable').forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            if (state.sortColumn === sortColumn) {
                // Toggle direction
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortColumn = sortColumn;
                state.sortDirection = 'desc'; // Default to descending
            }
            updateSortIndicators();
            filterVarianceTable(
                document.getElementById('variance-search').value,
                document.getElementById('variance-filter').value
            );
        });
    });
}

function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
        indicator.textContent = '';
    });
    
    if (state.sortColumn) {
        const header = document.querySelector(`[data-sort="${state.sortColumn}"]`);
        if (header) {
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = state.sortDirection === 'asc' ? ' ↑' : ' ↓';
            }
        }
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

// Make handleLogout and dbService available globally for API service
if (typeof window !== 'undefined') {
    window.handleLogout = handleLogout;
    window.dbService = dbService;
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

async function saveFolderId(e, isAdmin = false) {
    // Prevent form submission if button is in a form
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log('saveFolderId called');
    
    const input = isAdmin ? document.getElementById('admin-folder-id-input') : document.getElementById('folder-id-input');
    const status = isAdmin ? document.getElementById('admin-folder-id-status') : document.getElementById('folder-id-status');
    
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

async function clearFolderId(isAdmin = false) {
    const input = isAdmin ? document.getElementById('admin-folder-id-input') : document.getElementById('folder-id-input');
    const status = isAdmin ? document.getElementById('admin-folder-id-status') : document.getElementById('folder-id-status');
    
    if (input) input.value = '';
    if (status) {
        status.innerHTML = '';
        status.className = 'folder-status';
    }
    
    state.folderId = null;
    await dbService.saveState('folderId', null);
    
    updateCreateButtonState();
}

function updateFolderIdDisplay(isAdmin = false) {
    const input = isAdmin ? document.getElementById('admin-folder-id-input') : document.getElementById('folder-id-input');
    const status = isAdmin ? document.getElementById('admin-folder-id-status') : document.getElementById('folder-id-status');
    
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
    
    // Show/hide admin button
    const adminBtn = document.getElementById('admin-panel-btn');
    if (adminBtn) {
        adminBtn.style.display = state.user && state.user.role === 'admin' ? 'block' : 'none';
    }
    
    // Update folder ID display (removed from main page, now in admin)
    // updateFolderIdDisplay();
    
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
            updateStageDisplay();
        } else {
            card.style.display = 'none';
        }
    }
}

async function updateStageDisplay() {
    const stageInfo = document.getElementById('stocktake-stage-text');
    const progressBtn = document.getElementById('progress-stage-btn');
    const stageIndicator = document.getElementById('stage-indicator-text');
    
    const stageNum = state.currentStage || '1';
    const stageName = state.stageNames[stageNum] || `Stage ${stageNum}`;
    const stageText = `${stageNum}: ${stageName}`;
    
    if (stageInfo) {
        stageInfo.textContent = stageText;
    }
    
    if (stageIndicator) {
        stageIndicator.textContent = stageText;
    }
    
    // Show progress/rollback buttons only for admins
    if (progressBtn) {
        if (state.user && state.user.role === 'admin' && state.currentStocktake) {
            progressBtn.style.display = 'inline-block';
        } else {
            progressBtn.style.display = 'none';
        }
    }
    
    const rollbackBtn = document.getElementById('rollback-stage-btn');
    if (rollbackBtn) {
        const stageNum = parseInt(state.currentStage || '1');
        if (state.user && state.user.role === 'admin' && state.currentStocktake && stageNum > 1) {
            rollbackBtn.style.display = 'inline-block';
        } else {
            rollbackBtn.style.display = 'none';
        }
    }
    
    // Show/hide sections based on stage
    applyStageRestrictions();
}

async function handleProgressStage(direction = 'forward') {
    if (!state.currentStocktake) return;
    
    const currentStageNum = parseInt(state.currentStage || '1');
    const originalStage = state.currentStage;
    
    let targetStage;
    if (direction === 'backward') {
        if (currentStageNum <= 1) {
            alert('Stocktake is already at the first stage.');
            return;
        }
        targetStage = (currentStageNum - 1).toString();
    } else {
        if (currentStageNum >= 7) {
            alert('Stocktake is already at the final stage.');
            return;
        }
        targetStage = (currentStageNum + 1).toString();
    }
    
    const targetStageName = state.stageNames[targetStage] || `Stage ${targetStage}`;
    const currentStageName = state.stageNames[state.currentStage] || `Stage ${state.currentStage}`;
    
    // Always confirm stage changes
    const confirmMessage = direction === 'backward' 
        ? `⚠️ Go BACK from Stage ${state.currentStage} (${currentStageName}) to Stage ${targetStage} (${targetStageName})?\n\nThis may allow users to modify data that was already reviewed. Continue?`
        : `Progress from Stage ${state.currentStage} (${currentStageName}) to Stage ${targetStage} (${targetStageName})?`;
    
    if (!confirm(confirmMessage)) return;
    
    showLoading(`${direction === 'backward' ? 'Rolling back' : 'Progressing'} stage...`);
    
    try {
        // For backward movement, require admin
        if (direction === 'backward' && (!state.user || state.user.role !== 'admin')) {
            throw new Error('Only admins can roll back stages');
        }
        
        const result = await apiService.updateStocktakeStage(state.currentStocktake.id, targetStage, direction === 'backward' ? false : true);
        if (result.success) {
            // Only update UI state if backend update succeeded
            state.currentStage = targetStage;
            updateStageDisplay();
            applyStageRestrictions();
            hideLoading();
            alert(`✓ Stocktake ${direction === 'backward' ? 'rolled back' : 'progressed'} to Stage ${targetStage}: ${targetStageName}`);
            
            // If rolling back to stage 2, reload counting screen
            if (direction === 'backward' && targetStage === '2') {
                showScreen('counting-screen');
                loadCountingScreen();
            }
            
            // If we're in admin panel, reload stage info
            if (document.getElementById('admin-stages-tab')?.classList.contains('active')) {
                await loadAdminStages();
            }
        } else {
            throw new Error(result.error || 'Failed to update stage');
        }
    } catch (error) {
        hideLoading();
        
        // Verify actual stage from backend
        try {
            const stageResult = await apiService.getStocktakeStage(state.currentStocktake.id);
            if (stageResult.success && stageResult.stage) {
                const actualStage = stageResult.stage;
                // Sync UI to actual backend stage
                if (state.currentStage !== actualStage) {
                    console.warn(`Stage mismatch after error: UI=${state.currentStage}, Backend=${actualStage}. Syncing UI.`);
                    state.currentStage = actualStage;
                    updateStageDisplay();
                    applyStageRestrictions();
                }
            }
        } catch (stageCheckError) {
            console.error('Failed to verify stage after error:', stageCheckError);
        }
        
        alert(`❌ Failed to update stage: ${error.message}\n\nCurrent stage remains: ${state.currentStage}`);
        console.error('Update stage error:', error);
    }
}

function applyStageRestrictions() {
    const stageNum = parseInt(state.currentStage || '1');
    
    // Stage-based UI blocking
    // Stage 1: Only create stocktake
    // Stage 2: Allow counting
    // Stage 3: Review mode - show uncounted items
    // Stage 4: Variance report uploaded - allow viewing
    // Stage 5: Variance review - allow editing
    // Stage 6: Complete and export
    // Stage 7: Read-only
    
    // Hide/show sections based on stage
    const completeSection = document.getElementById('complete-first-counts-section');
    const reviewSection = document.getElementById('first-counts-review-section');
    
    if (stageNum === 3) {
        // Stage 3: Show review section, hide complete button
        if (completeSection) completeSection.style.display = 'none';
        if (reviewSection) {
            reviewSection.style.display = 'block';
            // Load review data when section is shown
            showFirstCountsReview();
        }
    } else {
        // Other stages: Show complete button, hide review section
        if (completeSection) completeSection.style.display = 'block';
        if (reviewSection) reviewSection.style.display = 'none';
    }
    
    // Hide/show buttons based on stage
    const continueBtn = document.getElementById('continue-stocktake-btn');
    const viewReconBtn = document.getElementById('view-reconciliation-btn');
    const completeBtn = document.getElementById('complete-first-counts-btn');
    
    if (continueBtn) {
        continueBtn.disabled = stageNum < 2 || stageNum >= 7;
    }
    
    if (viewReconBtn) {
        viewReconBtn.disabled = stageNum < 4 || stageNum >= 7;
    }
    
    if (completeBtn) {
        completeBtn.disabled = stageNum < 2 || stageNum >= 3;
    }
}

async function showFirstCountsReview() {
    // Get variance data to find items with 0 counts
    await reloadVarianceData();
    
    // Find items with 0 counted quantity
    const uncountedItems = state.varianceData.filter(item => {
        const countedQty = item.countedQty || item.countQty || 0;
        return countedQty === 0 && (item.theoreticalQty || 0) > 0; // Only show items that should have stock
    });
    
    const uncountedList = document.getElementById('uncounted-items-list');
    if (!uncountedList) return;
    
    if (uncountedItems.length === 0) {
        uncountedList.innerHTML = '<p class="info-text">✅ All items have been counted!</p>';
    } else {
        uncountedList.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--slate-200); border-radius: 8px; padding: 16px;">
                <p style="margin-bottom: 12px; font-weight: 600;">Found ${uncountedItems.length} items with 0 counts:</p>
                ${uncountedItems.map(item => `
                    <div class="uncounted-item" style="padding: 12px; margin-bottom: 8px; background: var(--slate-50); border-radius: 6px; border-left: 4px solid var(--orange-400);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${item.description || item.product || 'Unknown'}</strong>
                                <p style="font-size: 12px; color: var(--slate-600); margin-top: 4px;">
                                    Code: ${item.productCode || item.barcode || 'N/A'} • 
                                    Theoretical: ${item.theoreticalQty || 0} • 
                                    ${item.barcode ? `Barcode: ${item.barcode}` : '✍️ No Barcode'}
                                </p>
                            </div>
                            <button class="btn-secondary" onclick="addUncountedItem('${item.productCode || item.barcode || ''}', '${(item.description || item.product || '').replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                                Add Count
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    hideLoading();
}

async function reloadVarianceData() {
    const varianceResult = await apiService.getVarianceData(state.currentStocktake.id);
    if (varianceResult.success && varianceResult.varianceData) {
        // Extract items array if varianceData is an object with items property
        if (varianceResult.varianceData.items && Array.isArray(varianceResult.varianceData.items)) {
            state.varianceData = varianceResult.varianceData.items;
        } else if (Array.isArray(varianceResult.varianceData)) {
            state.varianceData = varianceResult.varianceData;
        } else {
            state.varianceData = [];
        }
        await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
    }
}

// Global function for adding uncounted items
window.addUncountedItem = function(productCode, description) {
    // Switch to search mode and pre-fill the search
    state.currentMode = 'search';
    state.searchQuery = description;
    handleSearch();
    updateCountingScreen();
    
    // Focus search input
    setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, 100);
};

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
        
        // Load stage
        try {
            const stageResult = await apiService.getStocktakeStage(stocktake.id);
            if (stageResult.success) {
                state.currentStage = stageResult.stage || '1';
            } else {
                state.currentStage = '1';
            }
        } catch (error) {
            console.warn('Error loading stage (defaulting to 1):', error);
            state.currentStage = '1';
        }
        updateStageDisplay();
        
        // Load theoretical products for search
        try {
            const theoreticalResult = await apiService.getTheoreticalProducts(stocktake.id);
            if (theoreticalResult.success && theoreticalResult.products) {
                state.theoreticalProducts = theoreticalResult.products;
            } else {
                state.theoreticalProducts = [];
            }
        } catch (error) {
            console.warn('Error loading theoretical products:', error);
            state.theoreticalProducts = [];
        }
        
        // Load and merge scans from Google Sheets and local storage
        if (state.user) {
            try {
                await loadScansForStocktake(stocktake.id, state.user.username);
            } catch (error) {
                console.warn('Error loading scans (continuing anyway):', error);
            }
        }
        
        // Load scans for current stocktake (filtered by current user only)
        const allScans = await dbService.getAllScans(stocktake.id);
        state.scannedItems = state.user ? allScans.filter(scan => scan.user === state.user.username) : allScans;
        
        // Count unsynced (only current user's scans)
        const unsynced = await dbService.getUnsyncedScans(stocktake.id);
        state.unsyncedCount = state.user ? unsynced.filter(scan => scan.user === state.user.username).length : unsynced.length;
        
        // Check for issues
        if (state.user) {
            try {
                await checkForIssues(stocktake.id, state.user.username);
            } catch (error) {
                console.warn('Error checking for issues:', error);
            }
        }
        
        // Check if there are unacknowledged issues
        try {
            const hasIssues = await hasUnacknowledgedIssues(stocktake.id);
            if (hasIssues) {
                state.hasBlockingIssues = true;
                // Don't alert on init - just set the flag
            } else {
                state.hasBlockingIssues = false;
            }
        } catch (error) {
            console.warn('Error checking issues:', error);
        }
        
        // Check if variance report exists
        const varianceData = await dbService.getVarianceData(stocktake.id);
        if (varianceData) {
            // Ensure it's an array
            if (Array.isArray(varianceData)) {
                state.varianceData = varianceData;
            } else if (varianceData.items && Array.isArray(varianceData.items)) {
                state.varianceData = varianceData.items;
            } else {
                state.varianceData = [];
            }
        } else {
            state.varianceData = [];
        }
        
        if (state.varianceData.length > 0) {
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
        
        // Load kegs from master sheet (for initial list)
        const kegsResult = await apiService.getKegs();
        if (kegsResult.success) {
            state.kegs = kegsResult.kegs;
            // Only set kegsList if we don't have a stocktake selected (will load from stocktake if available)
            if (!state.currentStocktake) {
                state.kegsList = kegsResult.kegs.map(keg => ({ ...keg, count: 0 }));
            }
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
    
    // Check for blocking issues
    if (await checkBlockingIssues()) {
        alert('⚠️ Unacknowledged issues detected! Please review and acknowledge them in the Admin panel before uploading variance report.');
        return;
    }
    
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
                // Extract items array if varianceData is an object with items property
                if (varianceResult.varianceData.items && Array.isArray(varianceResult.varianceData.items)) {
                    state.varianceData = varianceResult.varianceData.items;
                } else if (Array.isArray(varianceResult.varianceData)) {
                    state.varianceData = varianceResult.varianceData;
                } else {
                    state.varianceData = [];
                }
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
            
            hideModal('upload-variance-modal');
            // Go straight to counting screen after upload
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
    
    // Auto-progress to stage 2 (First Counts) if currently at stage 1
    // This happens automatically when entering counting screen
    if (state.currentStage === '1') {
        try {
            await apiService.updateStocktakeStage(state.currentStocktake.id, '2', true);
            state.currentStage = '2';
            updateStageDisplay();
        } catch (error) {
            console.warn('Failed to auto-progress to stage 2:', error);
        }
    }
    
    // Update stocktake info
    const stocktakeInfo = document.getElementById('counting-stocktake-info');
    if (stocktakeInfo) {
        stocktakeInfo.textContent = state.currentStocktake.name;
    }
    
    // Load products and locations if not loaded
    if (state.productDatabase.length === 0 || state.locations.length === 0) {
        await loadProductsAndLocations();
    }
    
    // Load theoretical products for search if not already loaded
    if (state.theoreticalProducts.length === 0 && state.currentStocktake) {
        try {
            const theoreticalResult = await apiService.getTheoreticalProducts(state.currentStocktake.id);
            if (theoreticalResult.success && theoreticalResult.products) {
                state.theoreticalProducts = theoreticalResult.products;
            }
        } catch (error) {
            console.warn('Error loading theoretical products:', error);
        }
    }
    
    // Update location selector
    const locationSelect = document.getElementById('location-select');
    if (locationSelect) {
        locationSelect.innerHTML = state.locations.map(loc => 
            `<option value="${loc}" ${loc === state.currentLocation ? 'selected' : ''}>${loc}</option>`
        ).join('');
    }
    
    // Load kegs from stocktake spreadsheet (if available), otherwise from master sheet
    try {
        if (state.currentStocktake) {
            const kegsResult = await apiService.getKegs(state.currentStocktake.id);
            if (kegsResult.success && kegsResult.kegs && kegsResult.kegs.length > 0) {
                // Use kegs from stocktake spreadsheet
                state.kegsList = kegsResult.kegs.map(keg => ({ 
                    name: keg.name, 
                    count: parseFloat(keg.count) || 0,
                    synced: true // Kegs loaded from server are already synced
                }));
            } else {
                // Fallback to master sheet kegs if stocktake has none
                if (state.kegs.length > 0) {
                    state.kegsList = state.kegs.map(keg => ({ ...keg, count: 0, synced: true }));
                }
            }
        } else if (state.kegs.length > 0) {
            // No stocktake selected, use master sheet kegs
            state.kegsList = state.kegs.map(keg => ({ ...keg, count: 0, synced: true }));
        }
        
        // Count unsynced kegs
        state.unsyncedKegsCount = state.kegsList.filter(k => {
            const count = parseFloat(k.count) || 0;
            return count > 0 && !k.synced;
        }).length;
    } catch (error) {
        console.warn('Error loading kegs from stocktake, using master sheet:', error);
        if (state.kegs.length > 0) {
            state.kegsList = state.kegs.map(keg => ({ ...keg, count: 0 }));
        }
    }
    
    // Reload and merge scans from Google Sheets and local storage
    if (state.user) {
        await loadScansForStocktake(state.currentStocktake.id, state.user.username);
    }
    
    // Load scans from IndexedDB (filtered by current user only)
    const allScans = await dbService.getAllScans(state.currentStocktake.id);
    state.scannedItems = allScans.filter(scan => scan.user === state.user.username);
    
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
        if (manualSection) manualSection.style.display = 'none'; // No separate manual entries - all in scanned items
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
                ${state.kegsList.map((keg, idx) => {
                    const isUnsynced = (keg.count > 0 || parseFloat(keg.count) > 0) && !keg.synced;
                    const rowClass = isUnsynced ? 'unsynced-row' : (keg.synced ? 'synced-row' : '');
                    const displayValue = (keg.count === 0 || keg.count === '0') ? '' : (keg.count || '');
                    return `
                    <tr class="${rowClass}" data-keg-index="${idx}">
                        <td>${keg.name}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="text" 
                                       id="keg-count-${idx}"
                                       value="${displayValue}" 
                                       placeholder="0"
                                       inputmode="decimal"
                                       onfocus="this.value = this.value === '0' ? '' : this.value"
                                       onblur="if (this.value === '') this.value = '0'; updateKegCount(${idx}, this.value)"
                                       onchange="updateKegCount(${idx}, this.value)"
                                       onkeypress="if(event.key==='Enter') { updateKegCount(${idx}, this.value); }"
                                       style="width: 80px; padding: 8px; text-align: center; border: 2px solid ${isUnsynced ? 'var(--orange-500)' : 'var(--orange-300)'}; border-radius: 8px; font-weight: bold; font-size: 18px; -moz-appearance: textfield;"
                                       class="keg-count-input">
                                <button onclick="showAddToKegInput(${idx})" 
                                        class="btn-secondary" 
                                        style="padding: 8px 12px; min-width: 40px;"
                                        title="Add to count">
                                    <span style="font-size: 18px;">+</span>
                                </button>
                                <div id="keg-add-input-${idx}" style="display: none; gap: 4px; align-items: center;">
                                    <input type="text" 
                                           id="keg-add-value-${idx}"
                                           placeholder="0.0"
                                           inputmode="decimal"
                                           style="width: 60px; padding: 4px; text-align: center; border: 1px solid var(--slate-300); border-radius: 4px;"
                                           onkeypress="if(event.key==='Enter') { applyAddToKeg(${idx}); }">
                                    <button onclick="applyAddToKeg(${idx})" 
                                            class="btn-primary" 
                                            style="padding: 4px 8px; font-size: 12px;">
                                        Add
                                    </button>
                                    <button onclick="hideAddToKegInput(${idx})" 
                                            class="btn-secondary" 
                                            style="padding: 4px 8px; font-size: 12px;">
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function updateKegCount(index, value) {
    if (state.kegsList[index]) {
        const newCount = parseFloat(value) || 0;
        const oldCount = parseFloat(state.kegsList[index].count) || 0;
        const wasSynced = state.kegsList[index].synced;
        
        state.kegsList[index].count = newCount;
        state.kegsList[index].synced = false; // Mark as unsynced when count changes
        
        // Update unsynced count
        if (wasSynced && newCount > 0) {
            state.unsyncedKegsCount++;
        } else if (!wasSynced && newCount === 0) {
            state.unsyncedKegsCount = Math.max(0, state.unsyncedKegsCount - 1);
        }
        
        updateKegsTable();
        updateSyncButton();
        
        // Auto-sync after 10 keg changes (same as regular scans)
        if (state.unsyncedKegsCount >= 10 && state.isOnline && !state.isSyncing) {
            syncToServer();
        }
    }
}

window.showAddToKegInput = function(index) {
    const addInputDiv = document.getElementById(`keg-add-input-${index}`);
    const addInput = document.getElementById(`keg-add-value-${index}`);
    if (addInputDiv && addInput) {
        addInputDiv.style.display = 'flex';
        addInput.focus();
    }
};

window.hideAddToKegInput = function(index) {
    const addInputDiv = document.getElementById(`keg-add-input-${index}`);
    const addInput = document.getElementById(`keg-add-value-${index}`);
    if (addInputDiv && addInput) {
        addInputDiv.style.display = 'none';
        addInput.value = '';
    }
};

window.applyAddToKeg = function(index) {
    const addInput = document.getElementById(`keg-add-value-${index}`);
    if (!addInput || !state.kegsList[index]) return;
    
    const addValue = parseFloat(addInput.value);
    if (isNaN(addValue) || addValue <= 0) {
        alert('Please enter a valid number to add');
        return;
    }
    
    const currentCount = parseFloat(state.kegsList[index].count) || 0;
    const newCount = currentCount + addValue;
    
    updateKegCount(index, newCount.toString());
    hideAddToKegInput(index);
};

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
        results.innerHTML = state.searchResults.map(product => {
            const identifier = product.barcode || product.productCode || product.invCode || 'No Code';
            const description = product.description || product.product || 'Unknown';
            const hasBarcode = product.barcode && product.barcode !== '';
            return `
            <div class="search-result-item ${!hasBarcode ? 'no-barcode-item' : ''}" onclick="selectSearchResult('${identifier}')">
                <h4>${description}</h4>
                <p>${hasBarcode ? `Barcode: ${product.barcode}` : '✍️ No Barcode - Manual Entry'} • ${product.productCode || product.invCode ? `Code: ${product.productCode || product.invCode}` : ''} • Qty: ${product.theoreticalQty || 0}</p>
            </div>
        `;
        }).join('');
    } else {
        results.innerHTML = '';
    }
}

function updateSyncButton() {
    const syncBtn = document.getElementById('counting-sync-btn');
    const syncStatusText = document.getElementById('sync-status-text');
    const unsyncedBadge = document.getElementById('unsynced-count-badge');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    const syncKegsBtn = document.getElementById('sync-kegs-btn');
    
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
    
    // Enable keg sync button if there are unsynced kegs (same logic as manual sync)
    if (syncKegsBtn) {
        const hasUnsyncedKegs = state.unsyncedKegsCount > 0;
        syncKegsBtn.disabled = !state.isOnline || state.isSyncing || !hasUnsyncedKegs;
        
        // Update button text and style based on sync state
        if (state.isSyncing) {
            syncKegsBtn.textContent = 'Syncing...';
            syncKegsBtn.style.opacity = '0.6';
        } else if (hasUnsyncedKegs) {
            syncKegsBtn.textContent = `Sync Kegs (${state.unsyncedKegsCount})`;
            syncKegsBtn.style.opacity = '1';
        } else {
            syncKegsBtn.textContent = 'Sync Kegs';
            syncKegsBtn.style.opacity = '1';
        }
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
    
    // All entries (barcoded or not) go to scanned items list
    // No separate manual entries - everything is countable from search/kegs
    state.scannedItems.unshift(scan);
    
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
    
    // Use theoretical products (from HnL import) for search, not master sheet
    // Master sheet is only used for barcode lookups when scanning
    // Exclude kegs (stock groups 1 and 300) from search since they're on keg counting sheet
    const searchSource = state.theoreticalProducts.length > 0 
        ? state.theoreticalProducts.filter(p => {
            const category = (p.category || '').toString().trim();
            // Exclude stock groups 1, 300, and any containing "Beer Keg" or "Cider/Seltzer Keg"
            return category !== '1' && 
                   category !== '300' && 
                   category !== '1 Beer Keg' && 
                   category !== '300 Cider/Seltzer Keg' &&
                   !category.includes('Beer Keg') &&
                   !category.includes('Cider/Seltzer Keg');
        })
        : state.productDatabase.filter(p => {
            // Also filter master sheet if used as fallback
            const stockGroup = (p.stockGroup || '').toString().trim();
            return stockGroup !== '1' && 
                   stockGroup !== '300' && 
                   stockGroup !== '1 Beer Keg' && 
                   stockGroup !== '300 Cider/Seltzer Keg' &&
                   !stockGroup.includes('Beer Keg') &&
                   !stockGroup.includes('Cider/Seltzer Keg');
        });
    
    state.searchResults = searchSource.filter(p => {
        const description = (p.description || p.product || '').toLowerCase();
        const barcode = (p.barcode || '').toString().toLowerCase();
        const productCode = (p.productCode || p.invCode || '').toString().toLowerCase();
        return description.includes(query) || 
               barcode.includes(query) || 
               productCode.includes(query);
    });
    
    updateSearchResults();
}

function selectSearchResult(productCodeOrBarcode) {
    // Search in theoretical products first, then fallback to master sheet
    let product = state.theoreticalProducts.find(p => 
        (p.barcode || '').toString() === productCodeOrBarcode ||
        (p.productCode || p.invCode || '').toString() === productCodeOrBarcode
    );
    
    if (!product && state.productDatabase.length > 0) {
        product = state.productDatabase.find(p => p.barcode === productCodeOrBarcode);
    }
    
    if (product) {
        // Convert theoretical product format to scan format
        state.currentProduct = {
            barcode: product.barcode || '',
            product: product.description || product.product || 'Unknown',
            currentStock: product.theoreticalQty || 0,
            value: product.theoreticalValue || product.unitCost || 0,
            isManualEntry: !product.barcode || product.barcode === '', // No barcode = manual entry
            productCode: product.productCode || product.invCode || '',
            unit: product.unit || '',
            unitCost: product.unitCost || 0
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
    // Check for blocking issues
    if (await checkBlockingIssues()) {
        alert('⚠️ Unacknowledged issues detected! Please review and acknowledge them in the Admin panel before syncing.');
        return;
    }
    if (!state.currentStocktake || !state.isOnline || state.isSyncing) return;
    
    state.isSyncing = true;
    updateSyncButton();
    
    try {
        // Sync regular scans
        const unsyncedScans = await dbService.getUnsyncedScans(state.currentStocktake.id);
        if (unsyncedScans.length > 0) {
            const result = await apiService.syncScans(state.currentStocktake.id, unsyncedScans);
            if (result.success) {
                // Extract syncedIds from result (handle both old and new format)
                const syncedIds = result.syncedIds || result.data?.syncedIds || [];
                if (syncedIds.length > 0) {
                    await dbService.markScansSynced(syncedIds);
                    state.unsyncedCount -= syncedIds.length;
                }
                // Reload scans to update UI with synced status
                const scans = await dbService.getAllScans(state.currentStocktake.id);
                state.scannedItems = scans;
                updateCountingScreen();
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
        
        // Sync kegs - only sync unsynced kegs with counts > 0
        const unsyncedKegs = state.kegsList.filter(k => {
            const count = parseFloat(k.count) || 0;
            return count > 0 && !k.synced;
        });
        
        if (unsyncedKegs.length > 0) {
            try {
                const result = await apiService.syncKegs(
                    state.currentStocktake.id,
                    unsyncedKegs,
                    state.currentLocation,
                    state.user.username
                );
                if (result.success || result.ok) {
                    // Mark synced kegs as synced (but keep their counts for display)
                    state.kegsList = state.kegsList.map(k => {
                        const wasUnsynced = unsyncedKegs.some(uk => uk.name === k.name);
                        if (wasUnsynced) {
                            return { ...k, synced: true };
                        }
                        return k;
                    });
                    
                    // Update unsynced count
                    state.unsyncedKegsCount = Math.max(0, state.unsyncedKegsCount - unsyncedKegs.length);
                    
                    // Update UI to show synced state
                    updateKegsTable();
                    updateSyncButton();
                } else {
                    throw new Error(result.message || 'Failed to sync kegs');
                }
            } catch (error) {
                console.error('Keg sync error:', error);
                alert('Failed to sync kegs: ' + error.message);
                throw error;
            }
        }
        
        // Reload and merge scans from Google Sheets and local storage
        if (state.user) {
            try {
                await loadScansForStocktake(state.currentStocktake.id, state.user.username);
            } catch (error) {
                console.warn('Error reloading scans from server:', error);
            }
        }
        
        // Load scans from IndexedDB (filtered by current user only)
        const allScans = await dbService.getAllScans(state.currentStocktake.id);
        state.scannedItems = state.user ? allScans.filter(scan => scan.user === state.user.username) : allScans;
        
        // Reload kegs from stocktake
        try {
            const kegsResult = await apiService.getKegs(state.currentStocktake.id);
            if (kegsResult.success && kegsResult.kegs && kegsResult.kegs.length > 0) {
                state.kegsList = kegsResult.kegs.map(keg => ({ 
                    name: keg.name, 
                    count: keg.count || 0 
                }));
            }
        } catch (error) {
            console.warn('Error reloading kegs:', error);
        }
        
        updateCountingScreen();
        
        // Show sync confirmation
        const syncedCount = unsyncedScans.length + (kegsWithCounts.length > 0 ? kegsWithCounts.length : 0);
        if (syncedCount > 0) {
            showSyncConfirmation(syncedCount);
        }
        
    } catch (error) {
        console.error('Sync error:', error);
        alert('Sync failed: ' + error.message);
    } finally {
        state.isSyncing = false;
        updateSyncButton();
    }
}

function showSyncConfirmation(count) {
    // Show a brief confirmation message
    const syncStatusText = document.getElementById('sync-status-text');
    if (syncStatusText) {
        const originalText = syncStatusText.textContent;
        syncStatusText.textContent = `✓ Synced ${count} items`;
        syncStatusText.style.color = 'var(--emerald-600)';
        
        setTimeout(() => {
            syncStatusText.textContent = originalText;
            syncStatusText.style.color = '';
        }, 3000);
    }
}

// ============================================
// COMPLETE FIRST COUNTS
// ============================================

async function handleCompleteFirstCounts() {
    if (!state.currentStocktake) return;
    
    if (!confirm('Complete first counts? This will match your counts with the variance report.')) return;
    
    showLoading('Matching counts with variance report...');
    
    let stageUpdated = false;
    let originalStage = state.currentStage;
    
    try {
        // Step 1: Sync all unsynced scans first - CRITICAL: must succeed before proceeding
        try {
            await syncToServer();
        } catch (syncError) {
            hideLoading();
            alert(`⚠️ Sync failed! Cannot complete first counts until all data is synced.\n\nError: ${syncError.message}\n\nPlease fix the sync issue and try again.`);
            console.error('Sync error in handleCompleteFirstCounts:', syncError);
            // DO NOT proceed - return early
            return;
        }
        
        // Step 2: Update variance data
        const result = await apiService.completeFirstCounts(state.currentStocktake.id);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to complete first counts');
        }
        
        // Step 3: Only update stage if everything succeeded
        try {
            await apiService.updateStocktakeStage(state.currentStocktake.id, '3', true);
            state.currentStage = '3';
            stageUpdated = true;
            updateStageDisplay();
            applyStageRestrictions();
            
            // Show First Counts Review section with uncounted items
            await showFirstCountsReview();
            hideLoading();
        } catch (stageError) {
            // Stage update failed - rollback UI state
            console.error('Failed to update stage:', stageError);
            state.currentStage = originalStage;
            updateStageDisplay();
            applyStageRestrictions();
            
            // Still reload variance data even if stage update fails
            await reloadVarianceData();
            hideLoading();
            showScreen('reconciliation-screen');
            loadReconciliationScreen();
            
            alert(`⚠️ Variance data updated, but stage update failed. Current stage: ${originalStage}\n\nError: ${stageError.message}`);
        }
    } catch (error) {
        // Any error - ensure UI state matches backend
        hideLoading();
        
        // If stage was updated but something else failed, try to rollback
        if (stageUpdated) {
            try {
                await apiService.updateStocktakeStage(state.currentStocktake.id, originalStage, false);
                state.currentStage = originalStage;
                updateStageDisplay();
                applyStageRestrictions();
            } catch (rollbackError) {
                console.error('Failed to rollback stage:', rollbackError);
            }
        }
        
        // Reload actual stage from backend to ensure sync
        try {
            const stageResult = await apiService.getStocktakeStage(state.currentStocktake.id);
            if (stageResult.success) {
                state.currentStage = stageResult.stage || originalStage;
                updateStageDisplay();
                applyStageRestrictions();
            }
        } catch (stageCheckError) {
            console.error('Failed to check stage:', stageCheckError);
        }
        
        alert(`❌ Failed to complete first counts: ${error.message}\n\nPlease try again or contact support if the issue persists.`);
        console.error('Complete first counts error:', error);
    }
}

// ============================================
// RECONCILIATION SCREEN
// ============================================

async function loadReconciliationScreen() {
    if (!state.currentStocktake) return;
    
    // Always verify stage from backend to ensure UI is in sync
    try {
        const stageResult = await apiService.getStocktakeStage(state.currentStocktake.id);
        if (stageResult.success && stageResult.stage) {
            const actualStage = stageResult.stage;
            // If UI state doesn't match backend, sync it
            if (state.currentStage !== actualStage) {
                console.warn(`Stage mismatch in reconciliation: UI=${state.currentStage}, Backend=${actualStage}. Syncing UI to backend.`);
                state.currentStage = actualStage;
            }
        } else if (!state.currentStage) {
            // Fallback if no stage returned
            state.currentStage = '1';
        }
    } catch (error) {
        console.warn('Failed to load stage from backend:', error);
        // Fallback to UI state or default
        if (!state.currentStage) {
            state.currentStage = '1';
        }
    }
    updateStageDisplay();
    applyStageRestrictions();
    
    // Update stocktake info
    const stocktakeInfo = document.getElementById('reconciliation-stocktake-info');
    if (stocktakeInfo) {
        stocktakeInfo.textContent = state.currentStocktake.name;
    }
    
    // Load variance data if not loaded
    if (!Array.isArray(state.varianceData) || state.varianceData.length === 0) {
        try {
            const result = await apiService.getVarianceData(state.currentStocktake.id);
            if (result.success && result.varianceData) {
                // VarianceCalculator returns { items: [...], totals: {...} }
                // Extract items array if needed
                if (result.varianceData.items && Array.isArray(result.varianceData.items)) {
                    state.varianceData = result.varianceData.items;
                } else if (Array.isArray(result.varianceData)) {
                    state.varianceData = result.varianceData;
                } else {
                    state.varianceData = [];
                }
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
        } catch (error) {
            console.error('Error loading variance data:', error);
            state.varianceData = []; // Ensure it's always an array
        }
    }
    
    // Ensure varianceData is always an array
    if (!Array.isArray(state.varianceData)) {
        state.varianceData = [];
    }
    
    // Update variance status
    updateVarianceStatus();
    
    // Populate stock group filter
    populateStockGroupFilter();
    
    // Render variance table
    renderVarianceTable();
}

function populateStockGroupFilter() {
    const stockGroupFilter = document.getElementById('stock-group-filter');
    if (!stockGroupFilter) return;
    
    // Get unique stock groups from variance data
    const stockGroups = [...new Set(state.varianceData
        .map(item => item.category)
        .filter(cat => cat && cat.toString().trim())
    )].sort();
    
    // Clear existing options (except "All Stock Groups")
    stockGroupFilter.innerHTML = '<option value="">All Stock Groups</option>';
    
    // Add stock group options
    stockGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.toString().trim();
        option.textContent = group.toString().trim();
        stockGroupFilter.appendChild(option);
    });
}

function showStockGroupsSummary() {
    if (!Array.isArray(state.varianceData) || state.varianceData.length === 0) {
        alert('No variance data available');
        return;
    }
    
    // Calculate stock group totals
    const stockGroupTotals = {};
    state.varianceData.forEach(item => {
        const category = item.category || 'Unknown';
        if (!stockGroupTotals[category]) {
            stockGroupTotals[category] = {
                count: 0,
                totalTheoretical: 0,
                totalCounted: 0,
                totalDollarVariance: 0,
                totalQtyVariance: 0,
                items: []
            };
        }
        stockGroupTotals[category].count++;
        stockGroupTotals[category].totalTheoretical += (item.theoreticalQty || 0);
        stockGroupTotals[category].totalCounted += (item.countedQty || 0);
        stockGroupTotals[category].totalDollarVariance += (item.dollarVariance || 0);
        stockGroupTotals[category].totalQtyVariance += (item.qtyVariance || 0);
        stockGroupTotals[category].items.push(item);
    });
    
    // Create modal content
    const modalContent = `
        <div class="stock-groups-summary-modal">
            <div class="modal-header">
                <h2>📊 Stock Groups Variance Summary</h2>
                <button class="modal-close" onclick="closeStockGroupsSummary()">×</button>
            </div>
            <div class="modal-body">
                <table class="stock-groups-table">
                    <thead>
                        <tr>
                            <th>Stock Group</th>
                            <th>Items</th>
                            <th>Theoretical</th>
                            <th>Counted</th>
                            <th>Qty Variance</th>
                            <th>Dollar Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(stockGroupTotals)
                            .sort((a, b) => Math.abs(b[1].totalDollarVariance) - Math.abs(a[1].totalDollarVariance))
                            .map(([group, totals]) => `
                                <tr class="${totals.totalDollarVariance >= 0 ? 'variance-positive-row' : 'variance-negative-row'}">
                                    <td><strong>${group}</strong></td>
                                    <td>${totals.count}</td>
                                    <td>${formatNumber(totals.totalTheoretical)}</td>
                                    <td>${formatNumber(totals.totalCounted)}</td>
                                    <td class="${totals.totalQtyVariance >= 0 ? 'variance-positive' : 'variance-negative'}">
                                        ${formatNumber(totals.totalQtyVariance)}
                                    </td>
                                    <td class="${totals.totalDollarVariance >= 0 ? 'variance-positive' : 'variance-negative'}">
                                        ${formatCurrency(totals.totalDollarVariance)}
                                    </td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Create and show modal
    let modal = document.getElementById('stock-groups-summary-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'stock-groups-summary-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = modalContent;
    modal.style.display = 'flex';
}

window.closeStockGroupsSummary = function() {
    const modal = document.getElementById('stock-groups-summary-modal');
    if (modal) modal.style.display = 'none';
};

function updateVarianceStatus() {
    const statusInfo = document.getElementById('variance-status-info');
    if (!statusInfo) return;
    
    // Ensure varianceData is an array
    if (!Array.isArray(state.varianceData)) {
        state.varianceData = [];
    }
    
    if (state.varianceData.length === 0) {
        statusInfo.innerHTML = '<p style="color: var(--slate-600);">No variance report uploaded yet.</p>';
    } else {
        const totalItems = state.varianceData.length;
        const withVariance = state.varianceData.filter(v => Math.abs(v.qtyVariance || v.varianceQty || 0) > 0).length;
        statusInfo.innerHTML = `
            <p><strong>Total Items:</strong> ${totalItems}</p>
            <p><strong>Items with Variance:</strong> ${withVariance}</p>
        `;
    }
    
    // Also update dashboard
    updateVarianceDashboard();
}

function updateVarianceDashboard() {
    if (!Array.isArray(state.varianceData) || state.varianceData.length === 0) {
        const totalVarianceEl = document.getElementById('total-variance-display');
        const itemsCountedEl = document.getElementById('items-counted-display');
        const stockGroupsEl = document.getElementById('stock-groups-totals');
        if (totalVarianceEl) totalVarianceEl.textContent = '$0.00';
        if (itemsCountedEl) itemsCountedEl.textContent = '0';
        if (stockGroupsEl) stockGroupsEl.textContent = '-';
        return;
    }
    
    // Calculate total dollar variance
    const totalDollarVariance = state.varianceData.reduce((sum, item) => {
        return sum + (item.dollarVariance || 0);
    }, 0);
    
    // Count items with counts > 0
    const itemsCounted = state.varianceData.filter(item => {
        const countedQty = item.countedQty || 0;
        return countedQty > 0 || item.manuallyEntered;
    }).length;
    
    // Calculate stock group totals
    const stockGroupTotals = {};
    state.varianceData.forEach(item => {
        const category = item.category || 'Unknown';
        if (!stockGroupTotals[category]) {
            stockGroupTotals[category] = {
                count: 0,
                dollarVariance: 0
            };
        }
        stockGroupTotals[category].count++;
        stockGroupTotals[category].dollarVariance += (item.dollarVariance || 0);
    });
    
    // Update displays
    const totalVarianceEl = document.getElementById('total-variance-display');
    if (totalVarianceEl) {
        totalVarianceEl.textContent = formatCurrency(totalDollarVariance);
        totalVarianceEl.style.color = totalDollarVariance >= 0 ? 'var(--emerald-600)' : 'var(--red-600)';
    }
    
    const itemsCountedEl = document.getElementById('items-counted-display');
    if (itemsCountedEl) {
        itemsCountedEl.textContent = `${itemsCounted} / ${state.varianceData.length}`;
    }
    
    const stockGroupsEl = document.getElementById('stock-groups-totals');
    if (stockGroupsEl) {
        const groupsList = Object.entries(stockGroupTotals)
            .slice(0, 5) // Show top 5 groups
            .map(([group, totals]) => `${group}: ${formatCurrency(totals.dollarVariance)}`)
            .join(' • ');
        stockGroupsEl.textContent = groupsList || '-';
        stockGroupsEl.style.fontSize = '12px';
        stockGroupsEl.style.maxHeight = '60px';
        stockGroupsEl.style.overflowY = 'auto';
    }
}

function renderVarianceTable() {
    const tbody = document.getElementById('variance-table-body');
    if (!tbody) return;
    
    // Ensure varianceData is an array
    if (!Array.isArray(state.varianceData)) {
        state.varianceData = [];
    }
    
    // Get filtered data (from state.filteredVarianceData if set, otherwise all data)
    const dataToRender = state.filteredVarianceData || state.varianceData;
    
    if (dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No variance data available. Upload a variance report first.</td></tr>';
        return;
    }
    
    tbody.innerHTML = dataToRender.map(item => {
        // VarianceCalculator uses qtyVariance and dollarVariance
        const varianceQty = item.qtyVariance !== undefined ? item.qtyVariance : (item.varianceQty || 0);
        const varianceValue = item.dollarVariance !== undefined ? item.dollarVariance : (item.varianceValue || 0);
        const varianceQtyClass = varianceQty > 0 ? 'variance-positive' : varianceQty < 0 ? 'variance-negative' : '';
        const productName = item.description || item.product || 'N/A';
        const productCode = item.productCode || item.barcode || 'N/A';
        const hasBarcode = item.hasBarcode !== false && (item.productCode || item.barcode);
        const rowClass = !hasBarcode ? 'no-barcode-row' : (varianceQty > 0 ? 'variance-positive-row' : varianceQty < 0 ? 'variance-negative-row' : '');
        const canEdit = true; // All items are editable
        
        return `
            <tr class="${rowClass}">
                <td>${productName}</td>
                <td>${item.theoreticalQty || 0}</td>
                <td>${item.countedQty || 0}</td>
                <td class="${varianceQtyClass}">${varianceQty}</td>
                <td class="${varianceQtyClass}">${formatCurrency(varianceValue)}</td>
                <td>
                    ${canEdit ? `<button class="btn-secondary" onclick="editVarianceItem('${productCode.replace(/'/g, "\\'")}')">Edit</button>` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

function filterVarianceTable(searchQuery = '', filterType = 'all') {
    // Ensure varianceData is an array
    if (!Array.isArray(state.varianceData)) {
        state.varianceData = [];
    }
    
    let filtered = [...state.varianceData];
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(item => {
            const productName = (item.description || item.product || '').toLowerCase();
            const productCode = (item.productCode || item.barcode || '').toLowerCase();
            return productName.includes(query) || productCode.includes(query);
        });
    }
    
    // Apply stock group filter
    if (state.selectedStockGroups && state.selectedStockGroups.length > 0) {
        filtered = filtered.filter(item => {
            const itemCategory = (item.category || '').toString().trim();
            return state.selectedStockGroups.some(group => {
                const groupStr = group.toString().trim();
                return itemCategory === groupStr || itemCategory.includes(groupStr);
            });
        });
    }
    
    // Apply type filter
    if (filterType !== 'all') {
        filtered = filtered.filter(item => {
            const varianceQty = item.qtyVariance !== undefined ? item.qtyVariance : (item.varianceQty || 0);
            const hasBarcode = item.hasBarcode !== false && (item.productCode || item.barcode);
            const countedQty = item.countedQty || 0;
            
            switch (filterType) {
                case 'variance':
                    return Math.abs(varianceQty) > 0;
                case 'positive':
                    return varianceQty > 0;
                case 'negative':
                    return varianceQty < 0;
                case 'uncounted':
                    return countedQty === 0 && !item.manuallyEntered;
                case 'no-barcode':
                    return !hasBarcode;
                case 'quantity-over':
                    return varianceQty > 0;
                case 'quantity-under':
                    return varianceQty < 0;
                case 'counted':
                    return countedQty > 0; // New filter for testing
                default:
                    return true;
            }
        });
    }
    
    // Store filtered data
    state.filteredVarianceData = filtered;
    
    // Re-render table
    renderVarianceTable();
}

// ============================================
// SCAN LOADING AND MERGING
// ============================================

async function loadScansForStocktake(stocktakeId, currentUsername) {
    try {
        // Load scans from Google Sheets (all users) - pass null to load all scans
        const result = await apiService.loadUserScans(stocktakeId, null);
        const serverScans = result.success && result.scans ? result.scans : [];
        
        // Load local scans
        const localScans = await dbService.getAllScans(stocktakeId);
        
        // Create a map of syncIds for deduplication
        const scanMap = new Map();
        
        // First, add all server scans (server takes precedence)
        serverScans.forEach(scan => {
            if (scan.syncId) {
                scanMap.set(scan.syncId, {
                    ...scan,
                    stocktakeId,
                    synced: true
                });
            }
        });
        
        // Then, add local scans that don't exist on server
        localScans.forEach(scan => {
            if (scan.syncId && !scanMap.has(scan.syncId)) {
                scanMap.set(scan.syncId, scan);
            } else if (!scan.syncId) {
                // Local scan without syncId (not yet synced) - add it
                const tempId = `local-${Date.now()}-${Math.random()}`;
                scanMap.set(tempId, scan);
            }
        });
        
        // Clear existing scans for this stocktake
        await dbService.clearScans(stocktakeId);
        
        // Save all merged scans
        for (const scan of scanMap.values()) {
            await dbService.saveScan(scan);
        }
        
        return Array.from(scanMap.values());
    } catch (error) {
        console.error('Error loading scans:', error);
        // Return local scans as fallback
        return await dbService.getAllScans(stocktakeId);
    }
}

// ============================================
// ADMIN PANEL
// ============================================

function setupAdminPanelListeners() {
    // Admin back button
    const adminBackBtn = document.getElementById('admin-back-btn');
    if (adminBackBtn) {
        adminBackBtn.addEventListener('click', () => {
            showScreen('home-screen');
            loadHomeScreen();
        });
    }
    
    // Admin logout
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchAdminTab(tabName);
        });
    });
    
    // Admin stage management buttons
    const adminProgressBtn = document.getElementById('admin-progress-stage-btn');
    if (adminProgressBtn) {
        adminProgressBtn.addEventListener('click', () => handleProgressStage('forward'));
    }
    
    const adminRollbackBtn = document.getElementById('admin-rollback-stage-btn');
    if (adminRollbackBtn) {
        adminRollbackBtn.addEventListener('click', () => handleProgressStage('backward'));
    }
    
    // Add user form
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
    
    // Admin folder settings
    const adminSaveFolderBtn = document.getElementById('admin-save-folder-id-btn');
    if (adminSaveFolderBtn) {
        adminSaveFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveFolderId(e, true); // true = admin panel
        });
    }
    
    const adminClearFolderBtn = document.getElementById('admin-clear-folder-id-btn');
    if (adminClearFolderBtn) {
        adminClearFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearFolderId(true); // true = admin panel
        });
    }
    
    // Stocktake selects
    const countsStocktakeSelect = document.getElementById('counts-stocktake-select');
    if (countsStocktakeSelect) {
        countsStocktakeSelect.addEventListener('change', loadUserCounts);
    }
    
    const varianceStocktakeSelect = document.getElementById('variance-stocktake-select');
    if (varianceStocktakeSelect) {
        varianceStocktakeSelect.addEventListener('change', loadAdminVariance);
    }
    
    const issuesStocktakeSelect = document.getElementById('issues-stocktake-select');
    if (issuesStocktakeSelect) {
        issuesStocktakeSelect.addEventListener('change', loadIssues);
    }
}

function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `admin-${tabName}-tab`);
    });
    
    // Load tab data
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'counts') {
        loadUserCounts();
    } else if (tabName === 'variance') {
        loadAdminVariance();
    } else if (tabName === 'issues') {
        loadIssues();
    } else if (tabName === 'stages') {
        loadAdminStages();
    } else if (tabName === 'settings') {
        loadAdminSettings();
    }
}

async function loadAdminPanel() {
    if (!state.user || state.user.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        showScreen('home-screen');
        return;
    }
    
    // Update user info
    const adminUserInfo = document.getElementById('admin-user-info');
    if (adminUserInfo) {
        adminUserInfo.textContent = `Admin: ${state.user.username}`;
    }
    
    // Load initial tab
    switchAdminTab('users');
    
    // Populate stocktake selects
    await populateAdminStocktakeSelects();
}

async function populateAdminStocktakeSelects() {
    try {
        const result = await apiService.listStocktakes(state.folderId);
        const stocktakes = result.success && result.stocktakes ? result.stocktakes : [];
        
        const selects = [
            document.getElementById('counts-stocktake-select'),
            document.getElementById('variance-stocktake-select'),
            document.getElementById('issues-stocktake-select')
        ];
        
        selects.forEach(select => {
            if (!select) return;
            select.innerHTML = '<option value="">Select a stocktake...</option>';
            stocktakes.forEach(st => {
                const option = document.createElement('option');
                option.value = st.id;
                option.textContent = st.name;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error loading stocktakes for admin:', error);
    }
}

async function loadUsers() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '<p class="loading-text">Loading users...</p>';
    
    try {
        const users = await apiService.getUsers();
        if (users.length === 0) {
            usersList.innerHTML = '<p class="info-text">No users found.</p>';
            return;
        }
        
        usersList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-item-header">
                    <h3>${user.username} <span style="color: var(--slate-500); font-size: 0.875rem;">(${user.role})</span></h3>
                    <div class="user-item-actions">
                        ${user.username !== 'admin' ? `<button class="btn-secondary btn-small" onclick="handleDeleteUser('${user.username}')">Delete</button>` : ''}
                    </div>
                </div>
            `;
            usersList.appendChild(userItem);
        });
    } catch (error) {
        usersList.innerHTML = `<p class="error-text">Error loading users: ${error.message}</p>`;
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    showLoading('Adding user...');
    
    try {
        await apiService.addUser(username, password, role);
        document.getElementById('add-user-form').reset();
        await loadUsers();
        hideLoading();
        alert('User added successfully');
    } catch (error) {
        hideLoading();
        alert('Error adding user: ' + error.message);
    }
}

async function handleDeleteUser(username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    
    showLoading('Deleting user...');
    
    try {
        await apiService.deleteUser(username);
        await loadUsers();
        hideLoading();
        alert('User deleted successfully');
    } catch (error) {
        hideLoading();
        alert('Error deleting user: ' + error.message);
    }
}

async function loadUserCounts() {
    const stocktakeId = document.getElementById('counts-stocktake-select')?.value;
    const display = document.getElementById('user-counts-display');
    
    if (!display) return;
    
    if (!stocktakeId) {
        display.innerHTML = '<p class="info-text">Select a stocktake to view user counts</p>';
        return;
    }
    
    display.innerHTML = '<p class="loading-text">Loading user counts...</p>';
    
    try {
        const counts = await apiService.getUserCounts(stocktakeId);
        
        if (!counts || counts.length === 0) {
            display.innerHTML = '<p class="info-text">No counts found for this stocktake</p>';
            return;
        }
        
        let html = '<table class="user-counts-table"><thead><tr><th>User</th><th>Scans</th><th>Manual Entries</th><th>Kegs</th><th>Last Sync</th></tr></thead><tbody>';
        counts.forEach(count => {
            html += `<tr>
                <td>${count.username}</td>
                <td>${count.scanCount || 0}</td>
                <td>${count.manualCount || 0}</td>
                <td>${count.kegCount || 0}</td>
                <td>${count.lastSync || 'Never'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        display.innerHTML = html;
    } catch (error) {
        display.innerHTML = `<p class="error-text">Error loading counts: ${error.message}</p>`;
    }
}

async function loadAdminVariance() {
    const stocktakeId = document.getElementById('variance-stocktake-select')?.value;
    const display = document.getElementById('admin-variance-display');
    
    if (!display) return;
    
    if (!stocktakeId) {
        display.innerHTML = '<p class="info-text">Select a stocktake to view variance report</p>';
        return;
    }
    
    display.innerHTML = '<p class="loading-text">Loading variance report...</p>';
    
    try {
        const result = await apiService.getVarianceData(stocktakeId);
        if (result.success && result.varianceData) {
            // Extract items array
            const varianceItems = Array.isArray(result.varianceData) 
                ? result.varianceData 
                : (result.varianceData.items || []);
            
            if (varianceItems.length === 0) {
                display.innerHTML = '<p class="info-text">No variance data available for this stocktake</p>';
                return;
            }
            
            // Show summary and table
            const totalItems = varianceItems.length;
            const withVariance = varianceItems.filter(v => Math.abs(v.qtyVariance || v.varianceQty || 0) > 0).length;
            const totalDollarVariance = varianceItems.reduce((sum, item) => 
                sum + (item.dollarVariance || item.varianceValue || 0), 0);
            
            let html = `
                <div class="section-card">
                    <h3>Variance Summary</h3>
                    <p><strong>Total Items:</strong> ${totalItems}</p>
                    <p><strong>Items with Variance:</strong> ${withVariance}</p>
                    <p><strong>Total Dollar Variance:</strong> ${formatCurrency(totalDollarVariance)}</p>
                </div>
                <div class="section-card">
                    <h3>Variance Details</h3>
                    <div style="overflow-x: auto;">
                        <table class="user-counts-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Code</th>
                                    <th>Theoretical</th>
                                    <th>Counted</th>
                                    <th>Variance Qty</th>
                                    <th>Variance $</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            varianceItems.slice(0, 50).forEach(item => {
                const varianceQty = item.qtyVariance !== undefined ? item.qtyVariance : (item.varianceQty || 0);
                const varianceValue = item.dollarVariance !== undefined ? item.dollarVariance : (item.varianceValue || 0);
                const varianceQtyClass = varianceQty > 0 ? 'variance-positive' : varianceQty < 0 ? 'variance-negative' : '';
                html += `
                    <tr>
                        <td>${item.description || item.product || 'N/A'}</td>
                        <td>${item.productCode || item.barcode || 'N/A'}</td>
                        <td>${item.theoreticalQty || 0}</td>
                        <td>${item.countedQty || 0}</td>
                        <td class="${varianceQtyClass}">${varianceQty}</td>
                        <td class="${varianceQtyClass}">${formatCurrency(varianceValue)}</td>
                    </tr>
                `;
            });
            
            if (varianceItems.length > 50) {
                html += `<tr><td colspan="6" style="text-align: center; padding: 12px;">... and ${varianceItems.length - 50} more items</td></tr>`;
            }
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            display.innerHTML = html;
        } else {
            display.innerHTML = '<p class="info-text">No variance data available for this stocktake</p>';
        }
    } catch (error) {
        display.innerHTML = `<p class="error-text">Error loading variance: ${error.message}</p>`;
    }
}

async function loadIssues() {
    const stocktakeId = document.getElementById('issues-stocktake-select')?.value || null;
    const issuesList = document.getElementById('issues-list');
    
    if (!issuesList) return;
    
    issuesList.innerHTML = '<p class="loading-text">Loading issues...</p>';
    
    try {
        const issues = await dbService.getIssues(stocktakeId);
        
        if (!issues || issues.length === 0) {
            issuesList.innerHTML = '<p class="info-text">No issues found. ✅</p>';
            return;
        }
        
        issuesList.innerHTML = '';
        issues.forEach(issue => {
            const issueItem = document.createElement('div');
            issueItem.className = `issue-item ${issue.severity === 'high' ? 'high-severity' : ''} ${issue.acknowledged ? 'acknowledged' : ''}`;
            // Build detailed description
            let detailsHTML = `<p><strong>Stocktake:</strong> ${issue.stocktakeId}</p>`;
            detailsHTML += `<p><strong>Message:</strong> ${issue.message || 'No message'}</p>`;
            
            if (issue.description) {
                detailsHTML += `<p><strong>Description:</strong></p><pre style="white-space: pre-wrap; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; margin: 8px 0;">${issue.description}</pre>`;
            }
            
            if (issue.details) {
                detailsHTML += `<p><strong>Details:</strong></p>`;
                
                // User breakdown
                if (issue.details.breakdown) {
                    detailsHTML += `<div style="margin: 8px 0; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">`;
                    detailsHTML += `<strong>User Breakdown:</strong><ul style="margin: 8px 0; padding-left: 20px;">`;
                    Object.entries(issue.details.breakdown).forEach(([user, stats]) => {
                        detailsHTML += `<li><strong>${user}:</strong> ${stats.scanCount} scans, ${stats.totalQuantity} total quantity, ${stats.uniqueProducts.length} unique products, ${stats.locations.length} locations${stats.lastScan ? `, last scan: ${new Date(stats.lastScan).toLocaleString()}` : ''}</li>`;
                    });
                    detailsHTML += `</ul></div>`;
                }
                
                // Conflict details
                if (issue.details.conflicts) {
                    detailsHTML += `<div style="margin: 8px 0; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">`;
                    detailsHTML += `<strong>Conflicting Versions:</strong><ul style="margin: 8px 0; padding-left: 20px;">`;
                    issue.details.conflicts.forEach((conflict, idx) => {
                        detailsHTML += `<li>Version ${idx + 1} (User: ${conflict.user}): ${conflict.product} (${conflict.barcode}) - Qty: ${conflict.quantity}</li>`;
                    });
                    detailsHTML += `</ul></div>`;
                }
                
                // General details
                if (issue.details.users) {
                    detailsHTML += `<p><strong>Users involved:</strong> ${issue.details.users.join(', ')}</p>`;
                }
                if (issue.details.scanCount !== undefined) {
                    detailsHTML += `<p><strong>Total scans:</strong> ${issue.details.scanCount}</p>`;
                }
            }
            
            detailsHTML += `<p><strong>Detected:</strong> ${new Date(issue.timestamp).toLocaleString()}</p>`;
            
            issueItem.innerHTML = `
                <div class="issue-item-header">
                    <h3>${issue.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${issue.severity}</h3>
                    <div class="issue-item-actions">
                        ${!issue.acknowledged ? `<button class="btn-primary btn-small" onclick="handleAcknowledgeIssue('${issue.id}')">Acknowledge</button>` : '<span style="color: var(--slate-500);">Acknowledged</span>'}
                    </div>
                </div>
                ${detailsHTML}
            `;
            issuesList.appendChild(issueItem);
        });
    } catch (error) {
        issuesList.innerHTML = `<p class="error-text">Error loading issues: ${error.message}</p>`;
    }
}

async function handleAcknowledgeIssue(issueId) {
    try {
        await dbService.acknowledgeIssue(issueId);
        await loadIssues();
    } catch (error) {
        alert('Error acknowledging issue: ' + error.message);
    }
}

async function loadAdminStages() {
    if (!state.currentStocktake) {
        // No current stocktake - show message
        const stageInfo = document.getElementById('admin-stage-info');
        const stageDetails = document.getElementById('admin-stage-details');
        const progressBtn = document.getElementById('admin-progress-stage-btn');
        const rollbackBtn = document.getElementById('admin-rollback-stage-btn');
        
        if (stageInfo) {
            stageInfo.innerHTML = '<p style="color: var(--slate-600);">No stocktake selected. Please select a stocktake from the home screen first.</p>';
        }
        if (stageDetails) {
            stageDetails.innerHTML = '<p style="color: var(--slate-600);">Go to the home screen and select a stocktake to manage its stage.</p>';
        }
        if (progressBtn) progressBtn.disabled = true;
        if (rollbackBtn) rollbackBtn.disabled = true;
        return;
    }
    
    // Load current stage
    try {
        const stageResult = await apiService.getStocktakeStage(state.currentStocktake.id);
        const currentStage = stageResult.success ? (stageResult.stage || '1') : '1';
        state.currentStage = currentStage;
        
        const stageNum = parseInt(currentStage);
        const stageName = state.stageNames[currentStage] || `Stage ${currentStage}`;
        
        // Update display
        const stocktakeNameEl = document.getElementById('admin-stage-stocktake-name');
        const currentStageEl = document.getElementById('admin-stage-current');
        const stageDetailsEl = document.getElementById('admin-stage-details');
        const progressBtn = document.getElementById('admin-progress-stage-btn');
        const rollbackBtn = document.getElementById('admin-rollback-stage-btn');
        
        if (stocktakeNameEl) {
            stocktakeNameEl.textContent = state.currentStocktake.name;
        }
        if (currentStageEl) {
            currentStageEl.textContent = `${currentStage}: ${stageName}`;
        }
        if (stageDetailsEl) {
            stageDetailsEl.innerHTML = `
                <p><strong>Stage ${currentStage}:</strong> ${stageName}</p>
                <p style="margin-top: 8px; color: var(--slate-600);">
                    ${stageNum === 1 ? 'Stocktake created' : ''}
                    ${stageNum === 2 ? 'First counts in progress' : ''}
                    ${stageNum === 3 ? 'First counts review - checking for uncounted items' : ''}
                    ${stageNum === 4 ? 'Variance report uploaded - ready for review' : ''}
                    ${stageNum === 5 ? 'Variance review and recounts in progress' : ''}
                    ${stageNum === 6 ? 'Complete and export - ready to finish' : ''}
                    ${stageNum === 7 ? 'Data saved for comparison - stocktake complete' : ''}
                </p>
            `;
        }
        
        // Enable/disable buttons
        if (progressBtn) {
            progressBtn.disabled = stageNum >= 7;
        }
        if (rollbackBtn) {
            rollbackBtn.disabled = stageNum <= 1;
        }
    } catch (error) {
        console.error('Error loading stage info:', error);
        const currentStageEl = document.getElementById('admin-stage-current');
        if (currentStageEl) {
            currentStageEl.textContent = 'Error loading stage';
        }
    }
}

function loadAdminSettings() {
    const folderInput = document.getElementById('admin-folder-id-input');
    if (folderInput && state.folderId) {
        folderInput.value = state.folderId;
    }
}

// Make functions available globally for onclick handlers
window.handleDeleteUser = handleDeleteUser;
window.handleAcknowledgeIssue = handleAcknowledgeIssue;

// ============================================
// ISSUE DETECTION AND TRACKING
// ============================================

async function checkForIssues(stocktakeId, currentUsername) {
    const issues = [];
    
    // Check 1: Multiple users' scans in local storage
    const allScans = await dbService.getAllScans(stocktakeId);
    const uniqueUsers = new Set(allScans.map(scan => scan.user).filter(Boolean));
    
    if (uniqueUsers.size > 1) {
        // Get detailed breakdown by user
        const userBreakdown = {};
        allScans.forEach(scan => {
            const user = scan.user || 'unknown';
            if (!userBreakdown[user]) {
                userBreakdown[user] = {
                    scanCount: 0,
                    totalQuantity: 0,
                    uniqueProducts: new Set(),
                    locations: new Set(),
                    lastScan: null
                };
            }
            userBreakdown[user].scanCount++;
            userBreakdown[user].totalQuantity += scan.quantity || 0;
            if (scan.product) userBreakdown[user].uniqueProducts.add(scan.product);
            if (scan.location) userBreakdown[user].locations.add(scan.location);
            if (scan.timestamp) {
                const scanTime = new Date(scan.timestamp);
                if (!userBreakdown[user].lastScan || scanTime > new Date(userBreakdown[user].lastScan)) {
                    userBreakdown[user].lastScan = scan.timestamp;
                }
            }
        });
        
        // Format breakdown for display
        const breakdownText = Object.entries(userBreakdown).map(([user, stats]) => {
            return `${user}: ${stats.scanCount} scans, ${stats.totalQuantity} total qty, ${stats.uniqueProducts.size} products, ${stats.locations.size} locations${stats.lastScan ? `, last scan: ${new Date(stats.lastScan).toLocaleString()}` : ''}`;
        }).join('\n');
        
        const issue = {
            id: `multi-user-${stocktakeId}-${Date.now()}`,
            type: 'multi_user_scans',
            stocktakeId,
            severity: 'high',
            message: `Multiple users' scans detected locally: ${Array.from(uniqueUsers).join(', ')}. This should not happen.`,
            description: `Detailed breakdown:\n${breakdownText}`,
            details: {
                users: Array.from(uniqueUsers),
                scanCount: allScans.length,
                breakdown: Object.fromEntries(
                    Object.entries(userBreakdown).map(([user, stats]) => [
                        user,
                        {
                            scanCount: stats.scanCount,
                            totalQuantity: stats.totalQuantity,
                            uniqueProducts: Array.from(stats.uniqueProducts),
                            locations: Array.from(stats.locations),
                            lastScan: stats.lastScan
                        }
                    ])
                )
            },
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        issues.push(issue);
    }
    
    // Check 2: Data conflicts (same syncId, different data)
    const syncIdMap = new Map();
    allScans.forEach(scan => {
        if (scan.syncId) {
            if (!syncIdMap.has(scan.syncId)) {
                syncIdMap.set(scan.syncId, []);
            }
            syncIdMap.get(scan.syncId).push(scan);
        }
    });
    
    syncIdMap.forEach((scans, syncId) => {
        if (scans.length > 1) {
            // Check if data differs
            const firstScan = scans[0];
            const hasConflict = scans.some(scan => 
                scan.barcode !== firstScan.barcode ||
                scan.quantity !== firstScan.quantity ||
                scan.product !== firstScan.product
            );
            
            if (hasConflict) {
                const issue = {
                    id: `conflict-${syncId}-${Date.now()}`,
                    type: 'data_conflict',
                    stocktakeId,
                    severity: 'high',
                    message: `Data conflict detected for scan ${syncId}. Multiple versions exist with different data.`,
                    details: {
                        syncId,
                        versions: scans.length,
                        conflicts: scans.map(s => ({
                            barcode: s.barcode,
                            product: s.product,
                            quantity: s.quantity,
                            user: s.user
                        }))
                    },
                    timestamp: new Date().toISOString(),
                    acknowledged: false
                };
                issues.push(issue);
            }
        }
    });
    
    // Save issues
    for (const issue of issues) {
        await dbService.saveIssue(issue);
    }
    
    return issues;
}

async function hasUnacknowledgedIssues(stocktakeId) {
    const issues = await dbService.getIssues(stocktakeId);
    return issues.some(issue => !issue.acknowledged);
}

async function checkBlockingIssues() {
    if (!state.currentStocktake) return false;
    return await hasUnacknowledgedIssues(state.currentStocktake.id);
}

async function editVarianceItem(productCode) {
    if (!state.currentStocktake) return;
    
    // Find the item in variance data
    const item = state.varianceData.find(v => 
        (v.productCode || v.barcode) === productCode
    );
    
    if (!item) {
        alert('Item not found in variance data');
        return;
    }
    
    // Prompt for new count
    const newCountStr = prompt(
        `Edit count for: ${item.description || item.product || productCode}\n\n` +
        `Theoretical: ${item.theoreticalQty || 0}\n` +
        `Current Count: ${item.countedQty || 0}\n\n` +
        `Enter new count:`,
        item.countedQty || 0
    );
    
    if (newCountStr === null) return; // User cancelled
    
    const newCount = parseFloat(newCountStr);
    if (isNaN(newCount)) {
        alert('Invalid number');
        return;
    }
    
    // Prompt for reason
    const reason = prompt('Enter reason for adjustment:', '') || 'Manual adjustment';
    
    showLoading('Saving adjustment...');
    
    try {
        // Save adjustment via API
        const result = await apiService.updateVarianceData(
            state.currentStocktake.id,
            {
                productCode: item.productCode || productCode,
                newCount,
                reason,
                user: state.user.username,
                timestamp: new Date().toISOString()
            }
        );
        
        if (result.success) {
            // Reload variance data to get updated calculations
            const varianceResult = await apiService.getVarianceData(state.currentStocktake.id);
            if (varianceResult.success && varianceResult.varianceData) {
                if (varianceResult.varianceData.items && Array.isArray(varianceResult.varianceData.items)) {
                    state.varianceData = varianceResult.varianceData.items;
                } else if (Array.isArray(varianceResult.varianceData)) {
                    state.varianceData = varianceResult.varianceData;
                } else {
                    state.varianceData = [];
                }
                await dbService.saveVarianceData(state.currentStocktake.id, state.varianceData);
            }
            
            // Refresh the table
            updateVarianceStatus();
            renderVarianceTable();
            
            hideLoading();
            alert('Adjustment saved successfully');
        } else {
            throw new Error(result.message || 'Failed to save adjustment');
        }
    } catch (error) {
        hideLoading();
        alert('Error saving adjustment: ' + error.message);
    }
}

// Make editVarianceItem available globally for onclick handlers
window.editVarianceItem = editVarianceItem;

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
            await apiService.exportPdfManualEntries(state.currentStocktake.id);
            
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

