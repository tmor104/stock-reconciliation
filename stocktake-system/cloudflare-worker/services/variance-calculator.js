export class VarianceCalculator {
    static calculate(theoretical, counts, adjustments, barcodeMapping) {
        // Create a map of product codes to counted quantities
        const countMap = new Map();
        
        // Group counts by barcode, sum quantities
        counts.forEach(count => {
            const barcode = count.barcode;
            const qty = parseFloat(count.quantity) || 0;
            
            if (countMap.has(barcode)) {
                countMap.set(barcode, countMap.get(barcode) + qty);
            } else {
                countMap.set(barcode, qty);
            }
        });
        
        // Convert barcode counts to product code counts using mapping
        const productCountMap = new Map();
        const reverseBarcodeMap = new Map();
        const productDescriptionMap = new Map(); // For fallback matching by description
        
        // Create reverse mapping (barcode -> productCode)
        for (const [productCode, barcode] of barcodeMapping) {
            reverseBarcodeMap.set(barcode, productCode);
        }
        
        // Create product description map for fallback matching
        theoretical.forEach(item => {
            const productCode = item.productCode || item.description;
            const description = (item.description || '').toLowerCase().trim();
            if (description && productCode) {
                productDescriptionMap.set(description, productCode);
            }
        });
        
        // Map barcode counts to product codes
        for (const [barcode, qty] of countMap) {
            let productCode = null;
            const countEntry = counts.find(c => c.barcode === barcode);
            const productName = countEntry?.product || '';
            
            // First try: barcode mapping (most reliable)
            if (barcode && barcode.trim()) {
                productCode = reverseBarcodeMap.get(barcode);
            }
            
            // Fallback 1: match by exact product description from count data
            if (!productCode && productName) {
                const productDesc = productName.toLowerCase().trim();
                productCode = productDescriptionMap.get(productDesc);
            }
            
            // Fallback 2: fuzzy match by product description (contains match)
            if (!productCode && productName) {
                const productDesc = productName.toLowerCase().trim();
                // Try to find a theoretical item where description contains or is contained by the count product name
                for (const [desc, code] of productDescriptionMap) {
                    if (desc.includes(productDesc) || productDesc.includes(desc)) {
                        productCode = code;
                        break;
                    }
                }
            }
            
            // If we found a productCode (via barcode mapping or description match), add it
            if (productCode) {
                if (productCountMap.has(productCode)) {
                    productCountMap.set(productCode, productCountMap.get(productCode) + qty);
                } else {
                    productCountMap.set(productCode, qty);
                }
            } else if (barcode && barcode.trim()) {
                // Log unmatched barcodes for debugging
                console.warn(`Unmatched barcode in counts: ${barcode}, product: ${productName || 'unknown'}`);
            } else if (!barcode && productName) {
                // Item without barcode - try to match by name only
                const productDesc = productName.toLowerCase().trim();
                productCode = productDescriptionMap.get(productDesc);
                if (productCode) {
                    if (productCountMap.has(productCode)) {
                        productCountMap.set(productCode, productCountMap.get(productCode) + qty);
                    } else {
                        productCountMap.set(productCode, qty);
                    }
                } else {
                    console.warn(`Unmatched item (no barcode): ${productName}`);
                }
            }
        }
        
        // Apply manual adjustments
        const adjustmentMap = new Map();
        adjustments.forEach(adj => {
            // Use the latest adjustment for each product
            if (!adjustmentMap.has(adj.productCode) || 
                new Date(adj.timestamp) > new Date(adjustmentMap.get(adj.productCode).timestamp)) {
                adjustmentMap.set(adj.productCode, adj);
            }
        });
        
        // Calculate variance for each theoretical item
        const items = theoretical.map(item => {
            const productCode = item.productCode || item.description; // Fall back to description for matching
            
            // Get counted quantity (from barcode scans or manual entry)
            let countedQty = productCountMap.get(productCode) || 0;
            let manuallyEntered = false;
            
            // Check for manual adjustment
            if (adjustmentMap.has(productCode)) {
                const adjustment = adjustmentMap.get(productCode);
                countedQty = parseFloat(adjustment.newCount) || 0;
                manuallyEntered = true;
            }
            
            // Calculate variances
            const theoreticalQty = item.theoreticalQty;
            const qtyVariance = countedQty - theoreticalQty;
            const dollarVariance = qtyVariance * item.unitCost;
            const variancePercent = theoreticalQty !== 0 
                ? (qtyVariance / Math.abs(theoreticalQty)) * 100 
                : 0;
            
            return {
                ...item,
                countedQty,
                manuallyEntered,
                qtyVariance,
                dollarVariance,
                variancePercent,
                hasBarcode: barcodeMapping.has(productCode)
            };
        });
        
        // Calculate totals
        const totalDollarVariance = items.reduce((sum, item) => sum + item.dollarVariance, 0);
        const totalQtyVariance = items.reduce((sum, item) => sum + Math.abs(item.qtyVariance), 0);
        const itemsCounted = items.filter(i => i.countedQty !== 0 || i.manuallyEntered).length;
        
        return {
            items,
            barcodeMapping: Array.from(barcodeMapping.entries()),
            summary: {
                totalItems: items.length,
                itemsCounted,
                itemsNotCounted: items.length - itemsCounted,
                totalDollarVariance,
                totalQtyVariance,
                positiveVariances: items.filter(i => i.dollarVariance > 0).length,
                negativeVariances: items.filter(i => i.dollarVariance < 0).length,
                zeroVariances: items.filter(i => i.dollarVariance === 0).length
            }
        };
    }
}
