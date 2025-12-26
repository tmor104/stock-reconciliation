// Configuration - MUST be updated before deployment
const CONFIG = {
    WORKER_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:8787'
        : 'YOUR_CLOUDFLARE_WORKER_URL', // Replace with your Cloudflare Worker URL
    BARCODE_SHEET_ID: 'YOUR_BARCODE_SHEET_ID', // Replace with your barcode mapping sheet ID
    PASSWORD_ITERATIONS: 100000, // PBKDF2 iterations for password hashing
};

// Constants
const CONSTANTS = {
    DECIMAL_PLACES: 2,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['.xls', '.xlsx'],
    TOKEN_EXPIRY_HOURS: 24,
};

// State Management
const state = {
    currentUser: null,
    currentStocktake: null,
    varianceData: [],
    filteredData: [],
    barcodeMapping: new Map(),
};

// Utility Functions
// Secure password hashing using PBKDF2 (better than SHA-256)
const hashPassword = async (password, salt = null) => {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Generate or use provided salt
    const saltBuffer = salt
        ? encoder.encode(salt)
        : crypto.getRandomValues(new Uint8Array(16));

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive key using PBKDF2
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: CONFIG.PASSWORD_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(new Uint8Array(saltBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    return { hash: hashHex, salt: saltHex };
};

// For backward compatibility with existing SHA-256 hashes
const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    }).format(value);
};

const formatNumber = (value, decimals = CONSTANTS.DECIMAL_PLACES) => {
    return Number(value).toFixed(decimals);
};

// HTML sanitization to prevent XSS
const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// Create element safely
const createElement = (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key.startsWith('on')) {
            // Don't allow inline event handlers via attributes
            console.warn('Use addEventListener instead of inline handlers');
        } else {
            element.setAttribute(key, value);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });
    return element;
};

const showScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
};

const showModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
};

const hideModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
};

const showError = (elementId, message) => {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = sanitizeHTML(message);
        el.style.display = 'block';
    }
};

const hideError = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = '';
        el.style.display = 'none';
    }
};

// Input validation
const validation = {
    isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    isValidUsername: (username) => /^[a-zA-Z0-9_-]{3,20}$/.test(username),
    isValidPassword: (password) => password.length >= 8,
    isValidNumber: (value) => !isNaN(parseFloat(value)) && isFinite(value),
    isValidFileType: (filename, allowedTypes) => {
        const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return allowedTypes.includes(ext);
    },
    isValidFileSize: (size, maxSize) => size <= maxSize,
};

// Better error handling with toast notifications
const showToast = (message, type = 'info') => {
    const toast = createElement('div', {
        className: `toast toast-${type}`,
        role: 'alert'
    }, [message]);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Confirmation dialog (better than alert)
const confirm = (message) => {
    return new Promise((resolve) => {
        if (window.confirm(message)) {
            resolve(true);
        } else {
            resolve(false);
        }
    });
};

// API Functions
const api = {
    async login(username, password) {
        const hashedPassword = await sha256(password);
        const response = await fetch(`${CONFIG.WORKER_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: hashedPassword })
        });
        
        if (!response.ok) {
            throw new Error('Invalid credentials');
        }
        
        return await response.json();
    },

    async getUsers(token) {
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    },

    async addUser(token, username, password, role) {
        const hashedPassword = await sha256(password);
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password: hashedPassword, role })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add user');
        }
        
        return await response.json();
    },

    async deleteUser(token, username) {
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users/${username}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
        
        return await response.json();
    },

    async getCurrentStocktake(token) {
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/current`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 404) {
            return null;
        }
        
        return await response.json();
    },

    async getStocktakeHistory(token) {
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    },

    async getAvailableCountSheets(token) {
        const response = await fetch(`${CONFIG.WORKER_URL}/sheets/count-sheets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    },

    async uploadHnLFile(token, file, countSheetId, stocktakeName, onProgress) {
        const formData = new FormData();
        formData.append('hnlFile', file);
        formData.append('countSheetId', countSheetId);
        formData.append('stocktakeName', stocktakeName);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error('Upload failed'));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('POST', `${CONFIG.WORKER_URL}/stocktake/create`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });
    },

    async getVarianceData(token, stocktakeId) {
        const response = await fetch(`${CONFIG.WORKER_URL}/variance/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    },

    async updateCount(token, stocktakeId, productCode, newCount, reason) {
        const response = await fetch(`${CONFIG.WORKER_URL}/variance/${stocktakeId}/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productCode,
                newCount,
                reason,
                user: state.currentUser.username,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update count');
        }
        
        return await response.json();
    },

    async finishStocktake(token, stocktakeId) {
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/${stocktakeId}/finish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to finish stocktake');
        }
        
        return await response.json();
    },

    async exportVarianceReport(token, stocktakeId) {
        const response = await fetch(`${CONFIG.WORKER_URL}/export/variance/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const blob = await response.blob();
        return blob;
    },

    async exportManualEntryList(token, stocktakeId) {
        const response = await fetch(`${CONFIG.WORKER_URL}/export/manual/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const blob = await response.blob();
        return blob;
    },

    async exportDatFile(token, stocktakeId) {
        const response = await fetch(`${CONFIG.WORKER_URL}/export/dat/${stocktakeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const blob = await response.blob();
        return blob;
    }
};

// Authentication
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-error');
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const userData = await api.login(username, password);
        state.currentUser = userData;
        
        if (userData.role === 'admin') {
            await loadAdminDashboard();
            showScreen('admin-screen');
        } else {
            await loadCurrentStocktake();
            showScreen('variance-screen');
        }
    } catch (error) {
        showError('login-error', error.message);
    }
});

// Logout handlers
document.getElementById('logout-btn').addEventListener('click', () => {
    state.currentUser = null;
    state.currentStocktake = null;
    showScreen('login-screen');
});

document.getElementById('logout-variance-btn').addEventListener('click', () => {
    state.currentUser = null;
    state.currentStocktake = null;
    showScreen('login-screen');
});

// Admin Dashboard
async function loadAdminDashboard() {
    await Promise.all([
        loadCurrentStocktakeInfo(),
        loadUsers(),
        loadStocktakeHistory()
    ]);
}

async function loadCurrentStocktakeInfo() {
    try {
        const stocktake = await api.getCurrentStocktake(state.currentUser.token);
        state.currentStocktake = stocktake;
        
        if (stocktake) {
            document.getElementById('current-stocktake-name').textContent = stocktake.name;
            document.getElementById('current-stocktake-date').textContent = 
                new Date(stocktake.createdAt).toLocaleString();
            document.getElementById('current-stocktake-status').textContent = 
                stocktake.status.toUpperCase();
        } else {
            document.getElementById('current-stocktake-name').textContent = 'None';
            document.getElementById('current-stocktake-date').textContent = '-';
            document.getElementById('current-stocktake-status').textContent = '-';
        }
    } catch (error) {
        console.error('Failed to load current stocktake:', error);
    }
}

async function loadUsers() {
    try {
        const users = await api.getUsers(state.currentUser.token);
        const usersList = document.getElementById('users-list');

        // Clear existing content
        usersList.innerHTML = '';

        // Create user items safely without innerHTML to prevent XSS
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';

            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';

            const username = document.createElement('strong');
            username.textContent = user.username; // Safe - no HTML parsing

            const badge = document.createElement('span');
            badge.className = `user-badge ${user.role}`;
            badge.textContent = user.role;

            userInfo.appendChild(username);
            userInfo.appendChild(badge);
            userItem.appendChild(userInfo);

            // Add delete button if not current user
            if (user.username !== state.currentUser.username) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-danger';
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', () => handleDeleteUser(user.username));
                userItem.appendChild(deleteBtn);
            }

            usersList.appendChild(userItem);
        });
    } catch (error) {
        console.error('Failed to load users:', error);
        showToast('Failed to load users', 'error');
    }
}

async function loadStocktakeHistory() {
    try {
        const history = await api.getStocktakeHistory(state.currentUser.token);
        const historyContainer = document.getElementById('stocktake-history');

        // Clear existing content
        historyContainer.innerHTML = '';

        if (history.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'No stocktake history yet.';
            emptyMsg.className = 'empty-message';
            historyContainer.appendChild(emptyMsg);
            return;
        }

        // Create stocktake items safely
        history.forEach(st => {
            const item = document.createElement('div');
            item.className = 'stocktake-item';
            item.addEventListener('click', () => handleViewStocktake(st.id));

            const name = document.createElement('h3');
            name.textContent = st.name;

            const created = document.createElement('p');
            created.textContent = `Created: ${new Date(st.createdAt).toLocaleDateString()}`;

            const items = document.createElement('p');
            items.textContent = `Items: ${st.itemCount || 0}`;

            const variance = document.createElement('p');
            variance.textContent = `Total Variance: ${formatCurrency(st.totalVariance || 0)}`;

            const status = document.createElement('span');
            status.className = `stocktake-status ${st.status}`;
            status.textContent = st.status;

            item.appendChild(name);
            item.appendChild(created);
            item.appendChild(items);
            item.appendChild(variance);
            item.appendChild(status);

            historyContainer.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load stocktake history:', error);
        showToast('Failed to load stocktake history', 'error');
    }
}

// User Management
document.getElementById('add-user-btn').addEventListener('click', async () => {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-user-role').value;

    // Validation
    if (!username || !password) {
        showToast('Please enter username and password', 'error');
        return;
    }

    if (!validation.isValidUsername(username)) {
        showToast('Username must be 3-20 characters (letters, numbers, _ or -)', 'error');
        return;
    }

    if (!validation.isValidPassword(password)) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        await api.addUser(state.currentUser.token, username, password, role);
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        await loadUsers();
        showToast('User added successfully', 'success');
    } catch (error) {
        showToast('Failed to add user: ' + error.message, 'error');
    }
});

async function handleDeleteUser(username) {
    const confirmed = await confirm(`Are you sure you want to delete user "${sanitizeHTML(username)}"?`);
    if (!confirmed) {
        return;
    }

    try {
        await api.deleteUser(state.currentUser.token, username);
        await loadUsers();
        showToast('User deleted successfully', 'success');
    } catch (error) {
        showToast('Failed to delete user: ' + error.message, 'error');
    }
}

// Start Stocktake
document.getElementById('start-stocktake-btn').addEventListener('click', async () => {
    showModal('start-stocktake-modal');
    await loadCountSheets();
});

document.getElementById('refresh-sheets-btn').addEventListener('click', loadCountSheets);

async function loadCountSheets() {
    try {
        const sheets = await api.getAvailableCountSheets(state.currentUser.token);
        const select = document.getElementById('count-sheet-select');

        // Clear and rebuild select options safely
        select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a count sheet...';
        select.appendChild(defaultOption);

        sheets.forEach(sheet => {
            const option = document.createElement('option');
            option.value = sheet.id;
            option.textContent = sheet.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load count sheets:', error);
        showToast('Failed to load count sheets', 'error');
    }
}

document.getElementById('start-stocktake-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = document.getElementById('hnl-file').files[0];
    const countSheetId = document.getElementById('count-sheet-select').value;
    const stocktakeName = document.getElementById('stocktake-name').value.trim();

    // Validation
    if (!file || !countSheetId || !stocktakeName) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (!validation.isValidFileType(file.name, CONSTANTS.ALLOWED_FILE_TYPES)) {
        showToast('Please upload an Excel file (.xls or .xlsx)', 'error');
        return;
    }

    if (!validation.isValidFileSize(file.size, CONSTANTS.MAX_FILE_SIZE)) {
        showToast(`File size must be less than ${CONSTANTS.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
        return;
    }

    if (stocktakeName.length < 3) {
        showToast('Stocktake name must be at least 3 characters', 'error');
        return;
    }

    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    progressContainer.style.display = 'block';

    try {
        await api.uploadHnLFile(
            state.currentUser.token,
            file,
            countSheetId,
            stocktakeName,
            (percent) => {
                progressFill.style.width = percent + '%';
                progressText.textContent = `Processing: ${Math.round(percent)}%`;
            }
        );

        hideModal('start-stocktake-modal');
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';

        await loadAdminDashboard();
        showToast('Stocktake created successfully!', 'success');
    } catch (error) {
        progressContainer.style.display = 'none';
        showToast('Failed to create stocktake: ' + error.message, 'error');
    }
});

document.getElementById('cancel-start-btn').addEventListener('click', () => {
    hideModal('start-stocktake-modal');
});

// View Variance Report
document.getElementById('view-variance-btn').addEventListener('click', async () => {
    if (!state.currentStocktake) {
        showToast('No active stocktake', 'warning');
        return;
    }

    await loadVarianceReport();
    showScreen('variance-screen');
});

document.getElementById('back-to-admin-btn').addEventListener('click', () => {
    showScreen('admin-screen');
});

async function loadCurrentStocktake() {
    const stocktake = await api.getCurrentStocktake(state.currentUser.token);
    if (!stocktake) {
        showToast('No active stocktake', 'warning');
        return;
    }
    state.currentStocktake = stocktake;
    await loadVarianceReport();
}

async function loadVarianceReport() {
    try {
        document.getElementById('variance-tbody').innerHTML =
            '<tr><td colspan="11" class="loading">Loading data...</td></tr>';

        const data = await api.getVarianceData(
            state.currentUser.token,
            state.currentStocktake.id
        );

        state.varianceData = data.items;
        state.barcodeMapping = new Map(data.barcodeMapping);

        // Populate category filter safely
        const categories = [...new Set(data.items.map(item => item.category))].sort();
        const categoryFilter = document.getElementById('category-filter');

        categoryFilter.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All Categories';
        categoryFilter.appendChild(allOption);

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });

        applyFilters();
        updateStats();
    } catch (error) {
        console.error('Failed to load variance data:', error);
        showToast('Failed to load variance data', 'error');
    }
}

function applyFilters() {
    const categoryFilter = document.getElementById('category-filter').value;
    const hideZero = document.getElementById('hide-zero-variance').checked;
    const searchTerm = document.getElementById('search-box').value.toLowerCase();
    const sortBy = document.getElementById('sort-by').value;
    
    // Filter
    let filtered = state.varianceData.filter(item => {
        if (categoryFilter && item.category !== categoryFilter) return false;
        if (hideZero && item.qtyVariance === 0) return false;
        if (searchTerm && !item.description.toLowerCase().includes(searchTerm)) return false;
        return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'desc-abs':
                return Math.abs(b.dollarVariance) - Math.abs(a.dollarVariance);
            case 'desc-pos':
                return b.dollarVariance - a.dollarVariance;
            case 'desc-neg':
                return a.dollarVariance - b.dollarVariance;
            case 'qty-abs':
                return Math.abs(b.qtyVariance) - Math.abs(a.qtyVariance);
            case 'qty-pos':
                return b.qtyVariance - a.qtyVariance;
            case 'qty-neg':
                return a.qtyVariance - b.qtyVariance;
            case 'name':
                return a.description.localeCompare(b.description);
            default:
                return 0;
        }
    });
    
    state.filteredData = filtered;
    renderVarianceTable();
}

function renderVarianceTable() {
    const tbody = document.getElementById('variance-tbody');

    if (state.filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="loading">No items found</td></tr>';
        return;
    }

    // Clear table
    tbody.innerHTML = '';

    // Create rows safely without innerHTML to prevent XSS
    state.filteredData.forEach(item => {
        const hasBarcode = state.barcodeMapping.has(item.productCode);
        const isCounted = item.countedQty !== 0 || item.manuallyEntered;
        const varianceClass = item.qtyVariance > 0 ? 'positive-variance' :
                              item.qtyVariance < 0 ? 'negative-variance' : '';
        const rowClass = !hasBarcode ? 'no-barcode' : (!isCounted ? 'uncounted' : varianceClass);

        const row = document.createElement('tr');
        row.className = rowClass;

        // Category
        const categoryCell = document.createElement('td');
        categoryCell.textContent = item.category;
        row.appendChild(categoryCell);

        // Product Code
        const codeCell = document.createElement('td');
        codeCell.textContent = item.productCode || '-';
        row.appendChild(codeCell);

        // Description
        const descCell = document.createElement('td');
        descCell.textContent = item.description;
        row.appendChild(descCell);

        // Unit
        const unitCell = document.createElement('td');
        unitCell.textContent = item.unit;
        row.appendChild(unitCell);

        // Unit Cost
        const costCell = document.createElement('td');
        costCell.textContent = formatCurrency(item.unitCost);
        row.appendChild(costCell);

        // Theoretical Qty
        const theoreticalCell = document.createElement('td');
        theoreticalCell.textContent = formatNumber(item.theoreticalQty);
        row.appendChild(theoreticalCell);

        // Counted Qty
        const countedCell = document.createElement('td');
        countedCell.textContent = formatNumber(item.countedQty);
        row.appendChild(countedCell);

        // Qty Variance
        const qtyVarianceCell = document.createElement('td');
        qtyVarianceCell.className = item.qtyVariance > 0 ? 'variance-positive' :
                                     item.qtyVariance < 0 ? 'variance-negative' : 'variance-zero';
        qtyVarianceCell.textContent = formatNumber(item.qtyVariance);
        row.appendChild(qtyVarianceCell);

        // Variance %
        const percentCell = document.createElement('td');
        percentCell.textContent = formatNumber(item.variancePercent) + '%';
        row.appendChild(percentCell);

        // Dollar Variance
        const dollarVarianceCell = document.createElement('td');
        dollarVarianceCell.className = item.dollarVariance > 0 ? 'variance-positive' :
                                        item.dollarVariance < 0 ? 'variance-negative' : 'variance-zero';
        dollarVarianceCell.textContent = formatCurrency(item.dollarVariance);
        row.appendChild(dollarVarianceCell);

        // Actions
        const actionsCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => handleEditCount(item.productCode));
        actionsCell.appendChild(editBtn);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}

function updateStats() {
    const totalDollarVariance = state.varianceData.reduce((sum, item) => sum + item.dollarVariance, 0);
    const itemsCounted = state.varianceData.filter(item => item.countedQty !== 0 || item.manuallyEntered).length;
    const totalItems = state.varianceData.length;
    const positiveCount = state.varianceData.filter(item => item.dollarVariance > 0).length;
    const negativeCount = state.varianceData.filter(item => item.dollarVariance < 0).length;
    
    document.getElementById('total-dollar-variance').textContent = formatCurrency(totalDollarVariance);
    document.getElementById('items-counted').textContent = `${itemsCounted} / ${totalItems}`;
    document.getElementById('positive-count').textContent = positiveCount;
    document.getElementById('negative-count').textContent = negativeCount;
}

// Filter event listeners
document.getElementById('category-filter').addEventListener('change', applyFilters);
document.getElementById('hide-zero-variance').addEventListener('change', applyFilters);
document.getElementById('search-box').addEventListener('input', applyFilters);
document.getElementById('sort-by').addEventListener('change', applyFilters);
document.getElementById('refresh-variance-btn').addEventListener('click', loadVarianceReport);

// Edit Count
function handleEditCount(productCode) {
    const item = state.varianceData.find(i => i.productCode === productCode);
    if (!item) return;

    // Safely populate product info without innerHTML
    const infoBox = document.getElementById('edit-product-info');
    infoBox.innerHTML = ''; // Clear first

    const productP = document.createElement('p');
    const productStrong = document.createElement('strong');
    productStrong.textContent = 'Product: ';
    productP.appendChild(productStrong);
    productP.appendChild(document.createTextNode(item.description));
    infoBox.appendChild(productP);

    const currentP = document.createElement('p');
    const currentStrong = document.createElement('strong');
    currentStrong.textContent = 'Current Count: ';
    currentP.appendChild(currentStrong);
    currentP.appendChild(document.createTextNode(formatNumber(item.countedQty)));
    infoBox.appendChild(currentP);

    const theoreticalP = document.createElement('p');
    const theoreticalStrong = document.createElement('strong');
    theoreticalStrong.textContent = 'Theoretical: ';
    theoreticalP.appendChild(theoreticalStrong);
    theoreticalP.appendChild(document.createTextNode(formatNumber(item.theoreticalQty)));
    infoBox.appendChild(theoreticalP);

    document.getElementById('edit-count-input').value = item.countedQty;
    document.getElementById('edit-reason').value = '';

    // Store product code for submission
    document.getElementById('edit-count-form').dataset.productCode = productCode;

    showModal('edit-count-modal');
}

document.getElementById('edit-count-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const productCode = e.target.dataset.productCode;
    const newCountValue = document.getElementById('edit-count-input').value;
    const reason = document.getElementById('edit-reason').value.trim();

    // Validation
    if (!validation.isValidNumber(newCountValue)) {
        showToast('Please enter a valid number', 'error');
        return;
    }

    const newCount = parseFloat(newCountValue);

    if (newCount < 0) {
        showToast('Count cannot be negative', 'error');
        return;
    }

    try {
        await api.updateCount(
            state.currentUser.token,
            state.currentStocktake.id,
            productCode,
            newCount,
            reason
        );

        hideModal('edit-count-modal');
        await loadVarianceReport();
        showToast('Count updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update count: ' + error.message, 'error');
    }
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    hideModal('edit-count-modal');
});

// Export Functions
document.getElementById('export-variance-btn').addEventListener('click', async () => {
    try {
        const blob = await api.exportVarianceReport(
            state.currentUser.token,
            state.currentStocktake.id
        );

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `variance-report-${state.currentStocktake.name}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url); // Clean up
        showToast('Variance report exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export variance report: ' + error.message, 'error');
    }
});

document.getElementById('export-manual-btn').addEventListener('click', async () => {
    try {
        const blob = await api.exportManualEntryList(
            state.currentUser.token,
            state.currentStocktake.id
        );

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual-entry-list-${state.currentStocktake.name}.txt`;
        a.click();
        window.URL.revokeObjectURL(url); // Clean up
        showToast('Manual entry list exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export manual entry list: ' + error.message, 'error');
    }
});

// Finish Stocktake
document.getElementById('finish-stocktake-btn').addEventListener('click', async () => {
    if (!state.currentStocktake) {
        showToast('No active stocktake', 'warning');
        return;
    }

    const confirmed = await confirm('Are you sure you want to finish this stocktake? This will lock it and generate the .dat export file.');
    if (!confirmed) {
        return;
    }

    try {
        await api.finishStocktake(
            state.currentUser.token,
            state.currentStocktake.id
        );

        // Download .dat file
        const blob = await api.exportDatFile(
            state.currentUser.token,
            state.currentStocktake.id
        );

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stocktake-${state.currentStocktake.name}.dat`;
        a.click();
        window.URL.revokeObjectURL(url); // Clean up

        showToast('Stocktake finished successfully! .dat file has been downloaded.', 'success');
        await loadAdminDashboard();
    } catch (error) {
        showToast('Failed to finish stocktake: ' + error.message, 'error');
    }
});

// Helper function for viewing historical stocktakes
function handleViewStocktake(stocktakeId) {
    // TODO: Implement viewing historical stocktakes in read-only mode
    // This would be similar to loadVarianceReport but for a specific historical stocktake
    showToast('Viewing historical stocktakes - feature coming soon', 'info');
    console.log('View stocktake:', stocktakeId);
}
