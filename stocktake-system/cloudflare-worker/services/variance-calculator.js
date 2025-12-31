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
        
        // Create reverse mapping (barcode -> product description)
        // Note: barcodeMapping is Map<ProductDescription, Barcode> from Product Database sheet
        for (const [productDescription, barcode] of barcodeMapping) {
            reverseBarcodeMap.set(barcode, productDescription);
        }

        // Map barcode counts to product descriptions
        for (const [barcode, qty] of countMap) {
            const productDescription = reverseBarcodeMap.get(barcode);
            if (productDescription) {
                if (productCountMap.has(productDescription)) {
                    productCountMap.set(productDescription, productCountMap.get(productDescription) + qty);
                } else {
                    productCountMap.set(productDescription, qty);
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
            // Match by product description (from HnL Stock Description column)
            // This matches the Product Database sheet's Column B
            const productDescription = item.description;

            // Get counted quantity (from barcode scans or manual entry)
            let countedQty = productCountMap.get(productDescription) || 0;
            let manuallyEntered = false;

            // Check for manual adjustment (uses productCode from theoretical sheet)
            if (adjustmentMap.has(item.productCode)) {
                const adjustment = adjustmentMap.get(item.productCode);
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
                hasBarcode: barcodeMapping.has(productDescription)
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
