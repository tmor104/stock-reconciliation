import * as XLSX from 'xlsx';

export async function parseHnLExcel(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Convert to JSON with header detection
    const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    
    // Find the header row (contains "InvCode", "Stock Description", etc.)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (row.some(cell => typeof cell === 'string' && cell.includes('Stock Description'))) {
            headerRowIndex = i;
            break;
        }
    }
    
    if (headerRowIndex === -1) {
        throw new Error('Could not find header row in HnL export');
    }
    
    const headers = rawData[headerRowIndex];
    const items = [];
    let currentCategory = '';
    
    // Find column indices by header name (case-insensitive)
    const findColumnIndex = (searchTerms) => {
        for (let i = 0; i < headers.length; i++) {
            const header = (headers[i] || '').toString().toLowerCase();
            if (searchTerms.some(term => header.includes(term.toLowerCase()))) {
                return i;
            }
        }
        return -1;
    };
    
    const invCodeCol = findColumnIndex(['invcode', 'inv code', 'product code']) || 1; // Default to B
    const descriptionCol = findColumnIndex(['stock description', 'description', 'product']) || 2; // Default to C
    const unitCol = findColumnIndex(['unit', 'uom']) || 3; // Default to D
    const unitCostCol = findColumnIndex(['unit cost', 'cost', 'price']) || 4; // Default to E
    const qtyAtStocktakeCol = findColumnIndex(['quantity at stocktake', 'qty at stocktake', 'stocktake qty']);
    const qtyEnteredCol = findColumnIndex(['quantity entered', 'qty entered', 'entered qty']);
    // Use "Quantity at Stocktake" if found, otherwise fall back to "Quantity Entered", then column F
    const theoreticalQtyCol = qtyAtStocktakeCol >= 0 ? qtyAtStocktakeCol : (qtyEnteredCol >= 0 ? qtyEnteredCol : 5);
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Check if this is a category row
        const firstCell = row[0] || '';
        if (typeof firstCell === 'string' && firstCell.startsWith('Stock Group No:')) {
            currentCategory = firstCell.replace('Stock Group No:', '').trim();
            continue;
        }
        
        // Skip empty rows
        if (!row || row.every(cell => !cell)) {
            continue;
        }
        
        // Extract product data using dynamic column indices
        const invCode = row[invCodeCol] || ''; 
        const description = row[descriptionCol] || '';
        const unit = row[unitCol] || '';
        const unitCost = parseFloat(row[unitCostCol]) || 0;
        const theoreticalQty = parseFloat(row[theoreticalQtyCol]) || 0;
        
        // Only include rows with a description
        if (description && typeof description === 'string') {
            items.push({
                category: currentCategory,
                productCode: invCode.toString().trim(),
                description: description.trim(),
                unit: unit.toString().trim(),
                unitCost: unitCost,
                theoreticalQty: theoreticalQty,
                theoreticalValue: theoreticalQty * unitCost
            });
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
