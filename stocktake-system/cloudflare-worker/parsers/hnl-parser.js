import * as XLSX from 'xlsx';

// Helper function to check if value is numeric
function isNumeric(value) {
    if (value === null || value === undefined || value === '') return false;
    return !isNaN(parseFloat(value)) && isFinite(value);
}

export async function parseHnLExcel(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Convert to JSON - keep ALL rows including blanks (handles merged cells)
    // This is the key fix from reformat-hnl: blankrows: true preserves structure
    const rawData = XLSX.utils.sheet_to_json(firstSheet, { 
        header: 1, 
        defval: null,
        blankrows: true  // CRITICAL: Keep blank rows to handle merged cells properly
    });
    
    const items = [];
    let currentCategory = '';
    
    // Process each row - similar to reformat-hnl algorithm
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Skip if row is completely empty
        if (!row || row.length === 0) continue;
        
        const firstCell = row[0];
        
        // Check if this is a stock group header
        if (typeof firstCell === 'string' && firstCell.startsWith('Stock Group No:')) {
            currentCategory = firstCell.replace('Stock Group No:', '').trim();
            continue;
        }
        
        // Check if this is a data row (numeric InvCode in column 0)
        // This is how reformat-hnl identifies data rows
        if (isNumeric(firstCell) && currentCategory !== null) {
            // Map sparse columns to dense format (matching reformat-hnl):
            // Column 0: InvCode
            // Column 2: Stock Description
            // Column 3: Unit (Inners)
            // Column 4: Average Unit Cost
            // Column 5: Quantity Entered
            // Column 6: Quantity at Stocktake (THIS IS WHAT WE WANT)
            // Column 9: Quantity Difference
            // Column 11: $ Value of Difference
            // Column 12: Value on hand at Stocktake
            
            const invCode = firstCell;
            const description = row[2] || '';
            const unit = row[3] || '';
            const avgUnitCost = parseFloat(row[4]) || 0;
            const qtyEntered = parseFloat(row[5]) || 0;
            const qtyAtStocktake = parseFloat(row[6]) || 0; // Column 6 = "Quantity at Stocktake"
            
            // Only include rows with a description
            if (description && typeof description === 'string' && description.trim()) {
                items.push({
                    category: currentCategory,
                    productCode: invCode.toString().trim(),
                    description: description.trim(),
                    unit: unit.toString().trim(),
                    unitCost: avgUnitCost,
                    theoreticalQty: qtyAtStocktake, // Use "Quantity at Stocktake" from column 6
                    theoreticalValue: qtyAtStocktake * avgUnitCost
                });
            }
        }
    }
    
    return {
        items,
        metadata: {
            totalItems: items.length,
            categories: [...new Set(items.map(i => i.category))].filter(Boolean),
            parsedAt: new Date().toISOString()
        }
    };
}
