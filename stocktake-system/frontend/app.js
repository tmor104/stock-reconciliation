// Configuration
const CONFIG = {
    WORKER_URL: 'https://stocktake-reconciliation.tomwmorgan47.workers.dev', // Cloudflare Worker URL
    BARCODE_SHEET_ID: 'YOUR_BARCODE_SHEET_ID', // Not needed - uses Master Sheet automatically
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

const formatNumber = (value, decimals = 2) => {
    return Number(value).toFixed(decimals);
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
        el.textContent = message;
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

    async updateUserPassword(token, username, newPassword) {
        const hashedPassword = await sha256(newPassword);
        const response = await fetch(`${CONFIG.WORKER_URL}/admin/users/${username}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: hashedPassword })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update password');
        }
        
        return await response.json();
    },

    async getCurrentStocktake(token) {
        const response = await fetch(`${CONFIG.WORKER_URL}/stocktake/current`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 404 is expected when there's no active stocktake - return null
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to load stocktake' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        // If response has error field, it's still a 404 case
        if (data.error && data.error.includes('No active stocktake')) {
            return null;
        }
        return data;
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
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to load count sheets' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return Array.isArray(data) ? data : [];
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
            await loadHomePage();
            showScreen('home-screen');
        } else {
            await loadCurrentStocktake();
            showScreen('variance-screen');
        }
    } catch (error) {
        showError('login-error', error.message);
    }
});

// Helper function to extract stocktake name from count sheet name
function extractStocktakeName(countSheetName) {
    // Remove "Stocktake - " prefix
    let name = countSheetName.replace(/^Stocktake\s*-\s*/i, '');
    
    // Remove date suffix (format: " - YYYY-MM-DD HH:MM" or similar)
    name = name.replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/i, '');
    name = name.replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}.*$/i, '');
    
    // Trim whitespace
    return name.trim() || countSheetName;
}

// Load Home Page
async function loadHomePage() {
    try {
        await loadCurrentStocktake();
    } catch (error) {
        // Ignore errors loading current stocktake - it's fine if there isn't one
        console.log('No current stocktake:', error.message);
    }
    await loadCountSheetsForHome();
}

// Load count sheets for home page
async function loadCountSheetsForHome() {
    try {
        const sheets = await api.getAvailableCountSheets(state.currentUser.token);
        const container = document.getElementById('count-sheets-list');
        
        if (!Array.isArray(sheets)) {
            container.innerHTML = '<p class="error-text">Invalid response from server. Please try again.</p>';
            return;
        }
        
        if (sheets.length === 0) {
            container.innerHTML = '<p class="no-sheets">No count sheets available. Create a stocktake in the Stock app first.</p>';
            return;
        }
        
        container.innerHTML = sheets.map(sheet => {
            const extractedName = extractStocktakeName(sheet.name);
            const date = new Date(sheet.modifiedTime).toLocaleDateString();
            
            return `
                <div class="count-sheet-card" data-sheet-id="${sheet.id}" data-sheet-name="${sheet.name}">
                    <h3>${extractedName}</h3>
                    <p class="sheet-details">${sheet.name}</p>
                    <p class="sheet-date">Last modified: ${date}</p>
                    <button class="btn-primary create-stocktake-btn" data-sheet-id="${sheet.id}" data-sheet-name="${sheet.name}">
                        Create Stocktake
                    </button>
                </div>
            `;
        }).join('');
        
        // Add event listeners to create stocktake buttons
        container.querySelectorAll('.create-stocktake-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sheetId = btn.dataset.sheetId;
                const sheetName = btn.dataset.sheetName;
                await createStocktakeFromHome(sheetId, sheetName);
            });
        });
    } catch (error) {
        console.error('Failed to load count sheets:', error);
        document.getElementById('count-sheets-list').innerHTML = 
            '<p class="error-text">Failed to load count sheets. Please try again.</p>';
    }
}

// Create stocktake from home page
async function createStocktakeFromHome(countSheetId, countSheetName) {
    // Show file picker for HnL file
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const extractedName = extractStocktakeName(countSheetName);
        
        // Show progress
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-overlay';
        progressContainer.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <p class="progress-text">Creating stocktake...</p>
            </div>
        `;
        document.body.appendChild(progressContainer);
        
        try {
            await api.uploadHnLFile(
                state.currentUser.token,
                file,
                countSheetId,
                extractedName, // Auto-extracted name
                (percent) => {
                    const fill = progressContainer.querySelector('.progress-fill');
                    const text = progressContainer.querySelector('.progress-text');
                    if (fill) fill.style.width = percent + '%';
                    if (text) text.textContent = `Processing: ${Math.round(percent)}%`;
                }
            );
            
            document.body.removeChild(progressContainer);
            await loadHomePage();
            alert('Stocktake created successfully!');
        } catch (error) {
            document.body.removeChild(progressContainer);
            alert('Failed to create stocktake: ' + error.message);
        }
    };
    input.click();
}

// Logout handlers
document.getElementById('logout-btn').addEventListener('click', () => {
    state.currentUser = null;
    state.currentStocktake = null;
    showScreen('login-screen');
});

document.getElementById('logout-home-btn').addEventListener('click', () => {
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
        // 404 is expected when there's no active stocktake - not an error
        if (error.message.includes('404') || error.message.includes('No active stocktake')) {
            state.currentStocktake = null;
            document.getElementById('current-stocktake-name').textContent = 'None';
            document.getElementById('current-stocktake-date').textContent = '-';
            document.getElementById('current-stocktake-status').textContent = '-';
        } else {
            console.error('Failed to load current stocktake:', error);
        }
    }
}

async function loadUsers() {
    try {
        const users = await api.getUsers(state.currentUser.token);
        const usersList = document.getElementById('users-list');
        
        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <strong>${user.username}</strong>
                    <span class="user-badge ${user.role}">${user.role}</span>
                </div>
                <div class="user-actions">
                    <button class="btn-secondary" onclick="changePassword('${user.username}')">Change Password</button>
                    ${user.username !== state.currentUser.username ? 
                        `<button class="btn-danger" onclick="deleteUser('${user.username}')">Delete</button>` : 
                        ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadStocktakeHistory() {
    try {
        const history = await api.getStocktakeHistory(state.currentUser.token);
        const historyContainer = document.getElementById('stocktake-history');
        
        historyContainer.innerHTML = history.map(st => `
            <div class="stocktake-item" onclick="viewStocktake('${st.id}')">
                <h3>${st.name}</h3>
                <p>Created: ${new Date(st.createdAt).toLocaleDateString()}</p>
                <p>Items: ${st.itemCount || 0}</p>
                <p>Total Variance: ${formatCurrency(st.totalVariance || 0)}</p>
                <span class="stocktake-status ${st.status}">${st.status}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load stocktake history:', error);
    }
}

// User Management
document.getElementById('add-user-btn').addEventListener('click', async () => {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-user-role').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    try {
        await api.addUser(state.currentUser.token, username, password, role);
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        await loadUsers();
        alert('User added successfully');
    } catch (error) {
        alert('Failed to add user: ' + error.message);
    }
});

async function deleteUser(username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        await api.deleteUser(state.currentUser.token, username);
        await loadUsers();
        alert('User deleted successfully');
    } catch (error) {
        alert('Failed to delete user: ' + error.message);
    }
}

async function changePassword(username) {
    const newPassword = prompt(`Enter new password for "${username}":`);
    if (!newPassword) {
        return;
    }
    
    if (newPassword.length < 4) {
        alert('Password must be at least 4 characters long');
        return;
    }
    
    try {
        await api.updateUserPassword(state.currentUser.token, username, newPassword);
        alert('Password updated successfully');
    } catch (error) {
        alert('Failed to update password: ' + error.message);
    }
}

// Start Stocktake
document.getElementById('start-stocktake-btn').addEventListener('click', async () => {
    showModal('start-stocktake-modal');
    await loadCountSheets();
});

document.getElementById('refresh-sheets-btn').addEventListener('click', loadCountSheets);
document.getElementById('refresh-count-sheets-btn').addEventListener('click', loadCountSheetsForHome);

async function loadCountSheets() {
    try {
        const sheets = await api.getAvailableCountSheets(state.currentUser.token);
        const select = document.getElementById('count-sheet-select');
        
        select.innerHTML = '<option value="">Select a count sheet...</option>' +
            sheets.map(sheet => `<option value="${sheet.id}" data-name="${sheet.name}">${sheet.name}</option>`).join('');
        
        // Auto-fill stocktake name when count sheet is selected
        select.addEventListener('change', (e) => {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption.value) {
                const sheetName = selectedOption.dataset.name;
                const extractedName = extractStocktakeName(sheetName);
                document.getElementById('stocktake-name').value = extractedName;
            }
        });
    } catch (error) {
        console.error('Failed to load count sheets:', error);
        alert('Failed to load count sheets');
    }
}

document.getElementById('start-stocktake-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = document.getElementById('hnl-file').files[0];
    const countSheetId = document.getElementById('count-sheet-select').value;
    let stocktakeName = document.getElementById('stocktake-name').value;
    
    if (!file || !countSheetId) {
        alert('Please select a count sheet and upload an HnL file');
        return;
    }
    
    // If stocktake name is empty, extract from count sheet name
    if (!stocktakeName || stocktakeName.trim() === '') {
        const selectedOption = document.getElementById('count-sheet-select').options[document.getElementById('count-sheet-select').selectedIndex];
        if (selectedOption.dataset.name) {
            stocktakeName = extractStocktakeName(selectedOption.dataset.name);
        }
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
        
        // Reload current screen
        if (document.getElementById('home-screen').classList.contains('active')) {
            await loadHomePage();
        } else {
            await loadAdminDashboard();
        }
        alert('Stocktake created successfully!');
    } catch (error) {
        progressContainer.style.display = 'none';
        alert('Failed to create stocktake: ' + error.message);
    }
});

document.getElementById('cancel-start-btn').addEventListener('click', () => {
    hideModal('start-stocktake-modal');
});

// View Variance Report
document.getElementById('view-variance-btn').addEventListener('click', async () => {
    if (!state.currentStocktake) {
        alert('No active stocktake');
        return;
    }
    
    await loadVarianceReport();
    showScreen('variance-screen');
});

document.getElementById('back-to-admin-btn').addEventListener('click', () => {
    if (state.currentUser && state.currentUser.role === 'admin') {
        loadHomePage();
        showScreen('home-screen');
    } else {
        showScreen('admin-screen');
    }
});

async function loadCurrentStocktake() {
    const stocktake = await api.getCurrentStocktake(state.currentUser.token);
    if (!stocktake) {
        alert('No active stocktake');
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
        
        // Populate category filter
        const categories = [...new Set(data.items.map(item => item.category))].sort();
        const categoryFilter = document.getElementById('category-filter');
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        
        applyFilters();
        updateStats();
    } catch (error) {
        console.error('Failed to load variance data:', error);
        alert('Failed to load variance data');
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
    
    tbody.innerHTML = state.filteredData.map(item => {
        const hasBarcode = state.barcodeMapping.has(item.productCode);
        const isCounted = item.countedQty !== 0 || item.manuallyEntered;
        const varianceClass = item.qtyVariance > 0 ? 'positive-variance' :
                              item.qtyVariance < 0 ? 'negative-variance' : '';
        const rowClass = !hasBarcode ? 'no-barcode' : (!isCounted ? 'uncounted' : varianceClass);
        
        return `
            <tr class="${rowClass}">
                <td>${item.category}</td>
                <td>${item.productCode || '-'}</td>
                <td>${item.description}</td>
                <td>${item.unit}</td>
                <td>${formatCurrency(item.unitCost)}</td>
                <td>${formatNumber(item.theoreticalQty)}</td>
                <td>${formatNumber(item.countedQty)}</td>
                <td class="${item.qtyVariance > 0 ? 'variance-positive' : 
                           item.qtyVariance < 0 ? 'variance-negative' : 'variance-zero'}">
                    ${formatNumber(item.qtyVariance)}
                </td>
                <td>${formatNumber(item.variancePercent)}%</td>
                <td class="${item.dollarVariance > 0 ? 'variance-positive' : 
                           item.dollarVariance < 0 ? 'variance-negative' : 'variance-zero'}">
                    ${formatCurrency(item.dollarVariance)}
                </td>
                <td>
                    <button class="btn-edit" onclick="editCount('${item.productCode}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
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
function editCount(productCode) {
    const item = state.varianceData.find(i => i.productCode === productCode);
    if (!item) return;
    
    document.getElementById('edit-product-info').innerHTML = `
        <p><strong>Product:</strong> ${item.description}</p>
        <p><strong>Current Count:</strong> ${formatNumber(item.countedQty)}</p>
        <p><strong>Theoretical:</strong> ${formatNumber(item.theoreticalQty)}</p>
    `;
    
    document.getElementById('edit-count-input').value = item.countedQty;
    document.getElementById('edit-reason').value = '';
    
    // Store product code for submission
    document.getElementById('edit-count-form').dataset.productCode = productCode;
    
    showModal('edit-count-modal');
}

document.getElementById('edit-count-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productCode = e.target.dataset.productCode;
    const newCount = parseFloat(document.getElementById('edit-count-input').value);
    const reason = document.getElementById('edit-reason').value;
    
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
    } catch (error) {
        alert('Failed to update count: ' + error.message);
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
    } catch (error) {
        alert('Failed to export variance report: ' + error.message);
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
    } catch (error) {
        alert('Failed to export manual entry list: ' + error.message);
    }
});

// Finish Stocktake
document.getElementById('finish-stocktake-btn').addEventListener('click', async () => {
    if (!state.currentStocktake) {
        alert('No active stocktake');
        return;
    }
    
    if (!confirm('Are you sure you want to finish this stocktake? This will lock it and generate the .dat export file.')) {
        return;
    }
    
    try {
        const result = await api.finishStocktake(
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
        
        alert('Stocktake finished successfully! .dat file has been downloaded.');
        await loadAdminDashboard();
    } catch (error) {
        alert('Failed to finish stocktake: ' + error.message);
    }
});

// Helper function for viewing historical stocktakes
function viewStocktake(stocktakeId) {
    // This would load a historical stocktake in read-only mode
    console.log('View stocktake:', stocktakeId);
    // Implementation would be similar to loadVarianceReport but for a specific stocktake
}
