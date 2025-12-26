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
        
        // Extract product data
        const invCode = row[1] || ''; // Column B
        const description = row[2] || ''; // Column C
        const unit = row[3] || ''; // Column D
        const unitCost = parseFloat(row[4]) || 0; // Column E
        const theoreticalQty = parseFloat(row[5]) || 0; // Column F
        
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
