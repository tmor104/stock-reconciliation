import * as XLSX from 'xlsx';

export class ExportService {
    static async generateVarianceExcel(varianceData) {
        const workbook = XLSX.utils.book_new();
        
        // Prepare data for Excel
        const excelData = varianceData.items.map(item => ({
            'Category': item.category,
            'Product Code': item.productCode,
            'Description': item.description,
            'Unit': item.unit,
            'Unit Cost': item.unitCost,
            'Theoretical Qty': item.theoreticalQty,
            'Counted Qty': item.countedQty,
            'Qty Variance': item.qtyVariance,
            'Variance %': item.variancePercent,
            '$ Variance': item.dollarVariance,
            'Has Barcode': item.hasBarcode ? 'Yes' : 'No',
            'Manually Entered': item.manuallyEntered ? 'Yes' : 'No'
        }));
        
        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        const columnWidths = [
            { wch: 25 }, // Category
            { wch: 15 }, // Product Code
            { wch: 40 }, // Description
            { wch: 15 }, // Unit
            { wch: 12 }, // Unit Cost
            { wch: 15 }, // Theoretical Qty
            { wch: 15 }, // Counted Qty
            { wch: 15 }, // Qty Variance
            { wch: 12 }, // Variance %
            { wch: 15 }, // $ Variance
            { wch: 12 }, // Has Barcode
            { wch: 15 }  // Manually Entered
        ];
        worksheet['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Variance Report');
        
        // Add summary sheet
        const summaryData = [
            ['Total Items', varianceData.summary.totalItems],
            ['Items Counted', varianceData.summary.itemsCounted],
            ['Items Not Counted', varianceData.summary.itemsNotCounted],
            ['Total $ Variance', varianceData.summary.totalDollarVariance],
            ['Total Qty Variance', varianceData.summary.totalQtyVariance],
            ['Positive Variances', varianceData.summary.positiveVariances],
            ['Negative Variances', varianceData.summary.negativeVariances],
            ['Zero Variances', varianceData.summary.zeroVariances]
        ];
        
        const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWorksheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
        
        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        return excelBuffer;
    }
    
    static generateManualEntryList(theoretical, barcodeMapping) {
        // Get items that don't have barcodes
        const manualItems = theoretical.filter(item => {
            const productCode = item.productCode || item.description;
            return !barcodeMapping.has(productCode);
        });
        
        if (manualItems.length === 0) {
            return 'No items require manual entry - all items have barcodes.';
        }
        
        let output = 'MANUAL ENTRY LIST\n';
        output += '='.repeat(80) + '\n\n';
        output += 'The following items do not have barcodes and must be counted manually:\n\n';
        
        // Group by category
        const byCategory = new Map();
        manualItems.forEach(item => {
            if (!byCategory.has(item.category)) {
                byCategory.set(item.category, []);
            }
            byCategory.get(item.category).push(item);
        });
        
        // Output by category
        for (const [category, items] of byCategory) {
            output += `\n${category}\n`;
            output += '-'.repeat(80) + '\n';
            
            items.forEach((item, index) => {
                output += `${index + 1}. ${item.description}\n`;
                output += `   Product Code: ${item.productCode || 'N/A'}\n`;
                output += `   Unit: ${item.unit}\n`;
                output += `   Theoretical Qty: ${item.theoreticalQty}\n`;
                output += `   Count: ___________\n\n`;
            });
        }
        
        output += '\n' + '='.repeat(80) + '\n';
        output += `Total items requiring manual entry: ${manualItems.length}\n`;
        
        return output;
    }
    
    static generateDatFile(varianceData, barcodeMapping) {
        // Create reverse mapping (productCode -> barcode)
        const productToBarcodeMap = new Map();
        for (const [productCode, barcode] of barcodeMapping) {
            productToBarcodeMap.set(productCode, barcode);
        }
        
        let datContent = '';
        
        // Only include items with:
        // 1. A barcode
        // 2. Non-zero counted quantity
        varianceData.items.forEach(item => {
            const productCode = item.productCode || item.description;
            const barcode = productToBarcodeMap.get(productCode);
            
            // Skip items without barcodes or with zero count
            if (!barcode || item.countedQty === 0) {
                return;
            }
            
            // Format: barcode starting at position 1, count starting at position 17
            // Barcode is left-aligned, then spaces to pad to position 17
            const barcodeStr = barcode.toString();
            const countStr = item.countedQty.toFixed(1);
            
            // Pad barcode to 16 characters (so count starts at position 17)
            const paddedLine = barcodeStr.padEnd(16, ' ') + countStr;
            
            datContent += paddedLine + '\n';
        });
        
        return datContent;
    }
    
    static generateManualEntryPDF(varianceData) {
        // Get items without barcodes that have been counted
        const manualItems = varianceData.items.filter(item => {
            const hasBarcode = item.hasBarcode !== false;
            const countedQty = item.countedQty || 0;
            return !hasBarcode && countedQty > 0;
        });
        
        if (manualItems.length === 0) {
            return null; // No items to export
        }
        
        // Generate HTML table for PDF
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Manual Entry List</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4A5568; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Manual Entry List</h1>
    <p>Items without barcodes - Counted quantities</p>
    <table>
        <thead>
            <tr>
                <th>Product Name</th>
                <th>Quantity</th>
            </tr>
        </thead>
        <tbody>
`;
        
        manualItems.forEach(item => {
            const productName = item.description || item.product || 'N/A';
            const quantity = item.countedQty || 0;
            html += `
            <tr>
                <td>${productName}</td>
                <td>${quantity}</td>
            </tr>
`;
        });
        
        html += `
        </tbody>
    </table>
</body>
</html>
`;
        
        return html;
    }
}
