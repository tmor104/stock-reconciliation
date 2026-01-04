export class VarianceCalculator {
    /**
     * Calculate variance between theoretical data and actual counts
     * @param {Array} theoretical - Items from Theoretical sheet (HnL data)
     * @param {Array} counts - Actual counts from Tally/Raw Scans
     * @param {Array} adjustments - Manual adjustments
     * @returns {Object} Variance report with items and summary
     */
    static calculate(theoretical, counts, adjustments) {
        // Build mapping tables from theoretical data
        // Theoretical sheet has: productCode, barcode, description
        const barcodeToProductCode = new Map();
        const descriptionToProductCode = new Map();
        const productCodeToTheoretical = new Map();

        theoretical.forEach(item => {
            const productCode = item.productCode || item.description;
            const barcode = (item.barcode || '').trim();
            const description = (item.description || '').toLowerCase().trim();

            // Store theoretical item by productCode
            productCodeToTheoretical.set(productCode, item);

            // Build barcode -> productCode mapping
            if (barcode) {
                barcodeToProductCode.set(barcode, productCode);
            }

            // Build description -> productCode mapping
            if (description) {
                descriptionToProductCode.set(description, productCode);
            }
        });

        // Group counts by productCode
        const productCountMap = new Map();
        const unmatchedCounts = []; // Counts that don't match any theoretical item

        counts.forEach(count => {
            const barcode = (count.barcode || '').trim();
            const description = (count.product || '').toLowerCase().trim();
            const qty = parseFloat(count.quantity) || 0;

            let productCode = null;

            // Match by barcode first (most reliable)
            if (barcode) {
                productCode = barcodeToProductCode.get(barcode);
            }

            // Fallback: match by exact description
            if (!productCode && description) {
                productCode = descriptionToProductCode.get(description);
            }

            // If matched to a theoretical item, add to count map
            if (productCode) {
                const currentQty = productCountMap.get(productCode) || 0;
                productCountMap.set(productCode, currentQty + qty);
            } else {
                // Unmatched item (extra stock not in theoretical)
                unmatchedCounts.push({
                    barcode: count.barcode || '',
                    product: count.product || '',
                    quantity: qty,
                    location: count.location || ''
                });
            }
        });

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
            const productCode = item.productCode || item.description;

            // Get counted quantity
            let countedQty = productCountMap.get(productCode) || 0;
            let manuallyEntered = false;

            // Check for manual adjustment (overrides counted qty)
            if (adjustmentMap.has(productCode)) {
                const adjustment = adjustmentMap.get(productCode);
                countedQty = parseFloat(adjustment.newCount) || 0;
                manuallyEntered = true;
            }

            // Calculate variances
            const theoreticalQty = parseFloat(item.theoreticalQty) || 0;
            const unitCost = parseFloat(item.unitCost) || 0;
            const qtyVariance = countedQty - theoreticalQty;
            const dollarVariance = qtyVariance * unitCost;
            const variancePercent = theoreticalQty !== 0
                ? (qtyVariance / Math.abs(theoreticalQty)) * 100
                : (countedQty > 0 ? 100 : 0); // If theoretical is 0 but counted > 0, that's 100% variance

            return {
                category: item.category || '',
                productCode: productCode,
                barcode: item.barcode || '',
                description: item.description || '',
                unit: item.unit || '',
                unitCost: unitCost,
                theoreticalQty: theoreticalQty,
                theoreticalValue: item.theoreticalValue || (theoreticalQty * unitCost),
                countedQty,
                manuallyEntered,
                qtyVariance,
                dollarVariance,
                variancePercent,
                hasBarcode: !!(item.barcode && item.barcode.trim())
            };
        });

        // Add unmatched counts as "extra items" (items counted but not in theoretical)
        const extraItems = unmatchedCounts.map(count => {
            const qty = count.quantity;
            return {
                category: 'UNACCOUNTED',
                productCode: '', // No product code (not in HnL)
                barcode: count.barcode,
                description: count.product,
                unit: '',
                unitCost: 0, // Unknown cost
                theoreticalQty: 0, // Not in theoretical
                theoreticalValue: 0,
                countedQty: qty,
                manuallyEntered: false,
                qtyVariance: qty, // All counted qty is variance
                dollarVariance: 0, // Can't calculate without cost
                variancePercent: 0,
                hasBarcode: !!(count.barcode && count.barcode.trim()),
                isExtra: true // Flag for special rendering
            };
        });

        // Combine theoretical items + extra items
        const allItems = [...items, ...extraItems];

        // Calculate totals
        const totalDollarVariance = items.reduce((sum, item) => sum + item.dollarVariance, 0);
        const totalQtyVariance = items.reduce((sum, item) => sum + Math.abs(item.qtyVariance), 0);
        const itemsCounted = allItems.filter(i => i.countedQty !== 0 || i.manuallyEntered).length;

        return {
            items: allItems,
            summary: {
                totalItems: items.length, // Only theoretical items count
                extraItems: extraItems.length,
                itemsCounted,
                itemsNotCounted: items.length - items.filter(i => i.countedQty !== 0 || i.manuallyEntered).length,
                totalDollarVariance,
                totalQtyVariance,
                positiveVariances: items.filter(i => i.dollarVariance > 0).length,
                negativeVariances: items.filter(i => i.dollarVariance < 0).length,
                zeroVariances: items.filter(i => i.dollarVariance === 0 && i.countedQty === 0).length
            }
        };
    }
}
