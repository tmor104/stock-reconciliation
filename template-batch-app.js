// Template & Batch Counting Application Logic
// Handles templates, recipes, batches, and batch calculations

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Round to nearest 0.05 for batch calculations
function roundTo005(value) {
    return Math.round(value * 20) / 20;
}

// Generate unique IDs
function generateID(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Show message helper (extends existing showError function)
function showMessage(message, type = 'info') {
    // For now, use alert - can be enhanced with custom UI later
    if (type === 'success') {
        alert('✅ ' + message);
    } else if (type === 'warning') {
        alert('⚠️ ' + message);
    } else {
        alert(message);
    }
}

// Show warning with confirm dialog
function showWarning(message, actions = {}) {
    const confirmed = confirm(message);
    if (confirmed && actions.onConfirm) {
        actions.onConfirm();
    } else if (!confirmed && actions.onCancel) {
        actions.onCancel();
    }
    return confirmed;
}

// ============================================
// BATCH CALCULATION LOGIC
// ============================================

function calculateBatchIngredients(recipe, batchBottleSizeML, bottleCount) {
    // Validation
    if (bottleCount <= 0) {
        throw new Error('Bottle count must be greater than zero');
    }
    if (batchBottleSizeML <= 0) {
        throw new Error('Batch bottle size must be greater than zero');
    }

    const ingredients = [];
    const totalBatchVolume = batchBottleSizeML * bottleCount;
    const singleRecipeVolume = recipe.ingredients.reduce((sum, ing) => sum + ing.serveSizeML, 0);

    if (singleRecipeVolume === 0) {
        console.error('Invalid recipe: zero total volume', { recipe });
        throw new Error('Recipe has invalid ingredient volumes. Contact admin to fix recipe.');
    }

    const numberOfServes = totalBatchVolume / singleRecipeVolume;

    for (const ingredient of recipe.ingredients) {
        const usageML = numberOfServes * ingredient.serveSizeML;
        const usageBottles = usageML / ingredient.bottleSizeML;
        const roundedQty = roundTo005(usageBottles);

        // Sanity check
        if (!isFinite(roundedQty) || roundedQty < 0) {
            console.error('Invalid calculation result', {
                ingredient,
                usageML,
                usageBottles,
                roundedQty,
                recipe,
                batchBottleSizeML,
                bottleCount
            });
            throw new Error(`Calculation error for ${ingredient.product}. Check recipe data.`);
        }

        ingredients.push({
            barcode: ingredient.barcode,
            product: ingredient.product,
            serveSizeML: ingredient.serveSizeML,
            bottleSizeML: ingredient.bottleSizeML,
            calculatedQty: roundedQty
        });
    }

    return ingredients;
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

const templateManager = {
    currentLocation: null,
    currentTemplate: null,
    templateProducts: [],

    async loadLocations() {
        try {
            // Get locations from state or API
            const locations = state.locations || [];
            const templatesContainer = document.getElementById('template-locations-list');

            if (!templatesContainer) return;

            if (locations.length === 0) {
                templatesContainer.innerHTML = '<p class="info-text">No locations available</p>';
                return;
            }

            // Load template counts for each location
            const allTemplates = await dbService.getTemplates();

            const locationCounts = locations.map(loc => {
                const locationTemplates = allTemplates.filter(t => t.location === loc);
                const liveTemplate = locationTemplates.find(t => t.status === 'Live');
                const draftTemplates = locationTemplates.filter(t => t.status === 'Draft');

                return {
                    name: loc,
                    hasLive: !!liveTemplate,
                    draftCount: draftTemplates.length
                };
            });

            // Render location cards
            templatesContainer.innerHTML = locationCounts.map(loc => `
                <div class="location-card" data-location="${loc.name}">
                    <h4>${loc.name}</h4>
                    <p>${loc.hasLive ? '✅ Live Template' : '❌ No Live Template'}</p>
                    <p>${loc.draftCount} Draft${loc.draftCount !== 1 ? 's' : ''}</p>
                </div>
            `).join('');

            // Add click handlers
            document.querySelectorAll('.location-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const location = e.currentTarget.dataset.location;
                    this.showLocationDetail(location);
                });
            });

        } catch (error) {
            console.error('Failed to load locations:', error);
            showMessage('Failed to load locations: ' + error.message, 'warning');
        }
    },

    async showLocationDetail(location) {
        this.currentLocation = location;
        document.getElementById('template-location-name').textContent = location;
        showScreen('template-detail-screen');

        // Load templates for this location
        const templates = await dbService.getTemplates(location);
        const liveTemplate = templates.find(t => t.status === 'Live');
        const draftTemplates = templates.filter(t => t.status === 'Draft');

        // Update live template info
        const liveTemplateInfo = document.getElementById('live-template-info');
        const editLiveBtn = document.getElementById('edit-live-template-btn');

        if (liveTemplate) {
            liveTemplateInfo.innerHTML = `
                <p><strong>Name:</strong> ${liveTemplate.templateName}</p>
                <p><strong>Products:</strong> ${liveTemplate.products?.length || 0}</p>
                <p><strong>Last Modified:</strong> ${new Date(liveTemplate.lastModified || liveTemplate.lastUpdated).toLocaleString()}</p>
            `;
            editLiveBtn.style.display = 'inline-block';
        } else {
            liveTemplateInfo.innerHTML = '<p class="info-text">No live template for this location</p>';
            editLiveBtn.style.display = 'none';
        }

        // Update drafts list
        const draftsList = document.getElementById('draft-templates-list');
        if (draftTemplates.length === 0) {
            draftsList.innerHTML = '<p class="info-text">No draft templates</p>';
        } else {
            draftsList.innerHTML = draftTemplates.map(t => `
                <div class="template-draft-item" style="background: white; padding: 16px; margin-bottom: 12px; border: 1px solid var(--slate-200); border-radius: 8px;">
                    <h4 style="margin: 0 0 8px 0;">${t.templateName}</h4>
                    <p style="margin: 4px 0; font-size: 14px; color: var(--slate-600);">Products: ${t.products?.length || 0}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: var(--slate-600);">Modified: ${new Date(t.lastModified || t.lastUpdated).toLocaleString()}</p>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button class="btn-secondary" data-action="edit" data-id="${t.templateID}">Edit</button>
                        <button class="btn-primary" data-action="push-live" data-id="${t.templateID}">Push to Live</button>
                        <button class="btn-secondary" data-action="duplicate" data-id="${t.templateID}">Duplicate</button>
                        <button class="btn-secondary" data-action="delete" data-id="${t.templateID}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add event handlers for draft actions
            draftsList.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const action = e.target.dataset.action;
                    const templateID = e.target.dataset.id;

                    switch (action) {
                        case 'edit':
                            await this.editTemplate(templateID);
                            break;
                        case 'push-live':
                            await this.pushTemplateLive(templateID);
                            break;
                        case 'duplicate':
                            await this.duplicateTemplate(templateID);
                            break;
                        case 'delete':
                            await this.deleteTemplate(templateID);
                            break;
                    }
                });
            });
        }
    },

    async createNewTemplate() {
        if (!this.currentLocation) {
            showMessage('No location selected', 'warning');
            return;
        }

        this.currentTemplate = null;
        this.templateProducts = [];

        document.getElementById('template-editor-title').textContent = 'Create Template';
        document.getElementById('template-name-input').value = '';
        document.getElementById('template-editor-location').textContent = this.currentLocation;
        document.getElementById('template-products-table').innerHTML = '<p class="info-text">No products added yet</p>';

        showModal('template-editor-modal');
    },

    async editTemplate(templateID) {
        const template = await dbService.getTemplate(templateID);
        if (!template) {
            showMessage('Template not found', 'warning');
            return;
        }

        this.currentTemplate = template;
        this.templateProducts = template.products || [];

        document.getElementById('template-editor-title').textContent = 'Edit Template';
        document.getElementById('template-name-input').value = template.templateName;
        document.getElementById('template-editor-location').textContent = template.location;

        this.renderTemplateProducts();
        showModal('template-editor-modal');
    },

    renderTemplateProducts() {
        const container = document.getElementById('template-products-table');

        // Always render table with search bar at top
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--slate-100);">
                        <th colspan="5" style="padding: 12px; border: none;">
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="text" id="template-product-search" placeholder="Search products to add..."
                                       style="flex: 1; padding: 8px; border: 1px solid var(--slate-300); border-radius: 4px;">
                                <button id="add-section-header-btn" class="btn-secondary" style="white-space: nowrap;">+ Add Section</button>
                            </div>
                            <div id="template-search-results" style="margin-top: 8px;"></div>
                        </th>
                    </tr>
                    <tr style="background: var(--slate-200); height: 36px;">
                        <th style="width: 60px; padding: 8px; font-size: 13px;">#</th>
                        <th style="padding: 8px; text-align: left; font-size: 13px;">Product</th>
                        <th style="width: 120px; padding: 8px; font-size: 13px;">Par Level</th>
                        <th style="width: 80px; padding: 8px; font-size: 13px;">Partial?</th>
                        <th style="width: 80px; padding: 8px; font-size: 13px;"></th>
                    </tr>
                </thead>
                <tbody id="template-products-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('template-products-tbody');
        tbody.innerHTML = this.templateProducts.map((item, index) => {
            if (item.isSection) {
                return `
                    <tr class="template-row-section" style="height: 32px; background: var(--slate-50);">
                        <td style="padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--slate-200);">${index + 1}</td>
                        <td colspan="3" style="padding: 6px 8px; font-size: 13px; border-bottom: 1px solid var(--slate-200);"><strong>SECTION: ${item.name}</strong></td>
                        <td style="padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--slate-200);"><button class="btn-secondary" data-remove="${index}" style="padding: 4px 8px; font-size: 11px;">Remove</button></td>
                    </tr>
                `;
            } else {
                return `
                    <tr style="height: 32px;">
                        <td style="padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--slate-200);">${index + 1}</td>
                        <td style="padding: 6px 8px; font-size: 13px; border-bottom: 1px solid var(--slate-200);">${item.product}</td>
                        <td style="padding: 6px 8px; border-bottom: 1px solid var(--slate-200);"><input type="number" step="0.01" min="0" value="${item.parLevel || 0}" data-index="${index}" class="par-level-input" style="width: 100%; padding: 4px; font-size: 12px;"></td>
                        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid var(--slate-200);"><input type="checkbox" ${item.partial ? 'checked' : ''} data-index="${index}" class="partial-checkbox"></td>
                        <td style="padding: 6px 8px; border-bottom: 1px solid var(--slate-200);"><button class="btn-secondary" data-remove="${index}" style="padding: 4px 8px; font-size: 11px;">Remove</button></td>
                    </tr>
                `;
            }
        }).join('');

        if (this.templateProducts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--slate-500);"><em>No products added yet - search above to add products</em></td></tr>';
        }

        // Add event listeners
        tbody.querySelectorAll('.par-level-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.templateProducts[index].parLevel = parseFloat(e.target.value) || 0;
            });
        });

        tbody.querySelectorAll('.partial-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.templateProducts[index].partial = e.target.checked;
            });
        });

        tbody.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.remove);
                this.templateProducts.splice(index, 1);
                this.renderTemplateProducts();
            });
        });
    },

    async saveTemplate(status = 'Draft') {
        const templateName = document.getElementById('template-name-input').value.trim();

        if (!templateName) {
            showMessage('Please enter a template name', 'warning');
            return;
        }

        if (this.templateProducts.length === 0) {
            showMessage('Please add at least one product', 'warning');
            return;
        }

        const template = {
            templateID: this.currentTemplate?.templateID || generateID('tmpl'),
            templateName,
            location: this.currentLocation,
            status,
            createdBy: state.user?.username || 'unknown',
            lastModified: new Date().toISOString(),
            products: this.templateProducts.map(p => p.isSection ? `SECTION:${p.name}` : p.barcode),
            parLevels: this.templateProducts.map(p => p.isSection ? null : (p.parLevel || 0)),
            partialFlags: this.templateProducts.map(p => p.isSection ? null : (p.partial || false))
        };

        try {
            // Save to IndexedDB
            await dbService.saveTemplate(template);

            // Sync to server
            await apiService.saveTemplate(template);

            showMessage(`Template saved as ${status}`, 'success');
            hideModal('template-editor-modal');

            // Refresh location detail
            await this.showLocationDetail(this.currentLocation);

        } catch (error) {
            console.error('Failed to save template:', error);
            showMessage('Failed to save template: ' + error.message, 'warning');
        }
    },

    async pushTemplateLive(templateID) {
        const template = await dbService.getTemplate(templateID);
        if (!template) return;

        // Check if there's an existing live template
        const existingLive = await dbService.getTemplates(template.location, 'Live');

        if (existingLive.length > 0) {
            const confirmed = showWarning('This will replace the current live template. Old template will become a draft. Continue?');
            if (!confirmed) return;

            // Set old live template to draft
            for (const oldLive of existingLive) {
                oldLive.status = 'Draft';
                await dbService.saveTemplate(oldLive);
            }
        }

        // Set new template to live
        template.status = 'Live';
        await dbService.saveTemplate(template);

        try {
            await apiService.saveTemplate(template);
            showMessage('Template pushed to live', 'success');
            await this.showLocationDetail(template.location);
        } catch (error) {
            console.error('Failed to push template live:', error);
            showMessage('Failed to push template live: ' + error.message, 'warning');
        }
    },

    async deleteTemplate(templateID) {
        const confirmed = showWarning('Are you sure you want to delete this template?');
        if (!confirmed) return;

        try {
            await dbService.deleteTemplate(templateID);
            await apiService.deleteTemplate(templateID);
            showMessage('Template deleted', 'success');
            await this.showLocationDetail(this.currentLocation);
        } catch (error) {
            console.error('Failed to delete template:', error);
            showMessage('Failed to delete template: ' + error.message, 'warning');
        }
    },

    async duplicateTemplate(templateID) {
        const template = await dbService.getTemplate(templateID);
        if (!template) return;

        const newTemplate = {
            ...template,
            templateID: generateID('tmpl'),
            templateName: template.templateName + ' (Copy)',
            status: 'Draft',
            lastModified: new Date().toISOString()
        };

        await dbService.saveTemplate(newTemplate);
        showMessage('Template duplicated', 'success');
        await this.showLocationDetail(template.location);
    }
};

// ============================================
// BATCH/RECIPE MANAGEMENT
// ============================================

const batchManager = {
    currentRecipe: null,
    recipeIngredients: [],

    async loadRecipes() {
        try {
            const recipes = await dbService.getRecipes();
            const recipesContainer = document.getElementById('recipes-list');

            if (!recipesContainer) return;

            if (recipes.length === 0) {
                recipesContainer.innerHTML = '<p class="info-text">No recipes created yet</p>';
                return;
            }

            // Render recipe cards
            recipesContainer.innerHTML = recipes.map(recipe => `
                <div class="recipe-card">
                    <div class="recipe-card-info">
                        <h4>${recipe.name}</h4>
                        <p>Location: ${recipe.location}</p>
                        <p>Ingredients: ${recipe.ingredients?.length || 0}</p>
                        ${recipe.fillerItems ? `<p>Fillers: ${recipe.fillerItems}</p>` : ''}
                    </div>
                    <div class="recipe-card-actions">
                        <button class="btn-secondary" data-action="edit" data-id="${recipe.recipeID}">Edit</button>
                        <button class="btn-secondary" data-action="duplicate" data-id="${recipe.recipeID}">Duplicate</button>
                        <button class="btn-secondary" data-action="delete" data-id="${recipe.recipeID}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add event handlers
            recipesContainer.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const action = e.target.dataset.action;
                    const recipeID = e.target.dataset.id;

                    switch (action) {
                        case 'edit':
                            await this.editRecipe(recipeID);
                            break;
                        case 'duplicate':
                            await this.duplicateRecipe(recipeID);
                            break;
                        case 'delete':
                            await this.deleteRecipe(recipeID);
                            break;
                    }
                });
            });

        } catch (error) {
            console.error('Failed to load recipes:', error);
            showMessage('Failed to load recipes: ' + error.message, 'warning');
        }
    },

    async createNewRecipe() {
        this.currentRecipe = null;
        this.recipeIngredients = [];

        document.getElementById('recipe-editor-title').textContent = 'Create Recipe';
        document.getElementById('recipe-name-input').value = '';
        document.getElementById('recipe-location-select').value = '';
        document.getElementById('recipe-filler-items-input').value = '';

        // Populate location dropdown
        const locationSelect = document.getElementById('recipe-location-select');
        locationSelect.innerHTML = '<option value="">Select location...</option>' +
            state.locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');

        this.renderRecipeIngredients();
        showModal('recipe-editor-modal');
    },

    async editRecipe(recipeID) {
        const recipe = await dbService.getRecipe(recipeID);
        if (!recipe) {
            showMessage('Recipe not found', 'warning');
            return;
        }

        this.currentRecipe = recipe;
        this.recipeIngredients = recipe.ingredients || [];

        document.getElementById('recipe-editor-title').textContent = 'Edit Recipe';
        document.getElementById('recipe-name-input').value = recipe.name;
        document.getElementById('recipe-location-select').value = recipe.location;

        // Populate location dropdown
        const locationSelect = document.getElementById('recipe-location-select');
        locationSelect.innerHTML = '<option value="">Select location...</option>' +
            state.locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
        locationSelect.value = recipe.location;

        this.renderRecipeIngredients();
        showModal('recipe-editor-modal');
    },

    renderRecipeIngredients() {
        const container = document.getElementById('recipe-ingredients-table');

        // Always render table with search bar at top
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--slate-100);">
                        <th colspan="5" style="padding: 12px; border: none;">
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="text" id="recipe-ingredient-search" placeholder="Search products to add as tracked ingredients..."
                                       style="flex: 1; padding: 8px; border: 1px solid var(--slate-300); border-radius: 4px;">
                                <button id="add-filler-ingredient-btn" class="btn-secondary" style="white-space: nowrap;">+ Add Filler</button>
                            </div>
                            <div id="recipe-ingredient-results" style="margin-top: 8px;"></div>
                        </th>
                    </tr>
                    <tr style="background: var(--slate-200); height: 36px;">
                        <th style="width: 60px; padding: 8px; font-size: 13px;">#</th>
                        <th style="padding: 8px; text-align: left; font-size: 13px;">Ingredient</th>
                        <th style="width: 130px; padding: 8px; font-size: 13px;">Serve Size (ml)</th>
                        <th style="width: 130px; padding: 8px; font-size: 13px;">Bottle Size (ml)</th>
                        <th style="width: 80px; padding: 8px; font-size: 13px;"></th>
                    </tr>
                </thead>
                <tbody id="recipe-ingredients-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('recipe-ingredients-tbody');
        tbody.innerHTML = this.recipeIngredients.map((ing, index) => {
            const isFiller = !ing.barcode; // Filler ingredients don't have barcodes
            const label = isFiller ? `${ing.product} <em>(filler)</em>` : ing.product;
            return `
                <tr style="height: 32px; ${isFiller ? 'background: var(--yellow-50);' : ''}">
                    <td style="padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--slate-200);">${index + 1}</td>
                    <td style="padding: 6px 8px; font-size: 13px; border-bottom: 1px solid var(--slate-200);">${label}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid var(--slate-200);"><input type="number" step="1" min="1" value="${ing.serveSizeML}" data-index="${index}" class="serve-size-input" style="width: 100%; padding: 4px; font-size: 12px;"></td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid var(--slate-200);"><input type="number" step="1" min="1" value="${ing.bottleSizeML || ''}" data-index="${index}" class="bottle-size-input" style="width: 100%; padding: 4px; font-size: 12px;" ${isFiller ? 'placeholder="N/A for filler" disabled' : ''}></td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid var(--slate-200);"><button class="btn-secondary" data-remove="${index}" style="padding: 4px 8px; font-size: 11px;">Remove</button></td>
                </tr>
            `;
        }).join('');

        if (this.recipeIngredients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--slate-500);"><em>No ingredients added yet - search above to add tracked ingredients or click Add Filler</em></td></tr>';
        }

        // Add event listeners
        tbody.querySelectorAll('.serve-size-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.recipeIngredients[index].serveSizeML = parseFloat(e.target.value) || 0;
            });
        });

        tbody.querySelectorAll('.bottle-size-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.recipeIngredients[index].bottleSizeML = parseFloat(e.target.value) || 0;
            });
        });

        tbody.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.remove);
                this.recipeIngredients.splice(index, 1);
                this.renderRecipeIngredients();
            });
        });

        // Add Filler button
        const addFillerBtn = document.getElementById('add-filler-ingredient-btn');
        if (addFillerBtn) {
            addFillerBtn.addEventListener('click', () => {
                const fillerName = prompt('Enter filler ingredient name (e.g., "Sugar", "Ice", "Lime Juice"):');
                if (!fillerName || !fillerName.trim()) return;

                const serveSizeML = parseFloat(prompt('Enter amount used per serve in ml (e.g., 15):', '15'));
                if (!serveSizeML || serveSizeML <= 0) {
                    showMessage('Please enter a valid serve size', 'warning');
                    return;
                }

                this.recipeIngredients.push({
                    product: fillerName.trim(),
                    serveSizeML: serveSizeML,
                    // No barcode or bottleSizeML for filler items
                });
                this.renderRecipeIngredients();
            });
        }
    },

    async saveRecipe() {
        const recipeName = document.getElementById('recipe-name-input').value.trim();
        const location = document.getElementById('recipe-location-select').value;

        if (!recipeName) {
            showMessage('Please enter a recipe name', 'warning');
            return;
        }

        if (!location) {
            showMessage('Please select a location', 'warning');
            return;
        }

        if (this.recipeIngredients.length === 0) {
            showMessage('Please add at least one ingredient', 'warning');
            return;
        }

        // Validate all ingredients have valid sizes
        for (const ing of this.recipeIngredients) {
            const isFiller = !ing.barcode;

            if (!ing.serveSizeML || ing.serveSizeML <= 0) {
                showMessage(`Serve size must be greater than 0 for ${ing.product}`, 'warning');
                return;
            }

            // Only validate bottle size for tracked ingredients
            if (!isFiller && (!ing.bottleSizeML || ing.bottleSizeML <= 0)) {
                showMessage(`Bottle size must be greater than 0 for ${ing.product}`, 'warning');
                return;
            }
        }

        const recipe = {
            recipeID: this.currentRecipe?.recipeID || generateID('rec'),
            name: recipeName,
            location,
            ingredients: this.recipeIngredients
        };

        try {
            await dbService.saveRecipe(recipe);
            await apiService.saveRecipe(recipe);
            showMessage('Recipe saved', 'success');
            hideModal('recipe-editor-modal');
            await this.loadRecipes();
        } catch (error) {
            console.error('Failed to save recipe:', error);
            showMessage('Failed to save recipe: ' + error.message, 'warning');
        }
    },

    async deleteRecipe(recipeID) {
        const confirmed = showWarning('Are you sure you want to delete this recipe?');
        if (!confirmed) return;

        try {
            await dbService.deleteRecipe(recipeID);
            await apiService.deleteRecipe(recipeID);
            showMessage('Recipe deleted', 'success');
            await this.loadRecipes();
        } catch (error) {
            console.error('Failed to delete recipe:', error);
            showMessage('Failed to delete recipe: ' + error.message, 'warning');
        }
    },

    async duplicateRecipe(recipeID) {
        const recipe = await dbService.getRecipe(recipeID);
        if (!recipe) return;

        const newRecipe = {
            ...recipe,
            recipeID: generateID('rec'),
            name: recipe.name + ' (Copy)'
        };

        await dbService.saveRecipe(newRecipe);
        showMessage('Recipe duplicated', 'success');
        await this.loadRecipes();
    }
};

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.templateManager = templateManager;
    window.batchManager = batchManager;
    window.calculateBatchIngredients = calculateBatchIngredients;
    window.showMessage = showMessage;
    window.showWarning = showWarning;
    window.roundTo005 = roundTo005;
    window.generateID = generateID;
}
