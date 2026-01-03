# Integration Contract: Stock (Count App) ↔ Stocktake Reconciliation System

**Version:** 1.0  
**Last Updated:** 2025-01-27  
**Integration Type:** Google Sheets (Shared Storage)

## Overview

The **Stock** repo is a barcode scanning count tool that writes physical count data to Google Sheets. The **Stocktake** system reads this data to calculate variances against theoretical stock from HnL.

**Integration Method:** Google Sheets (no direct API calls)

---

## Stock (Count App) → Stocktake System

### Purpose
Stock app writes physical count data that stocktake system reads to calculate variances.

### Data Flow
- **Format:** Google Sheets (columns A-K)
- **Frequency:** Real-time (as users scan barcodes)
- **Direction:** Stock app writes → Stocktake reads
- **Location:** Google Drive folder specified by `COUNT_SHEETS_FOLDER_ID`

### Google Sheet Format

#### Required Columns (A-J) - "Raw Scans" Sheet

**Note:** The Stock app writes to a sheet called "Raw Scans" with 10 columns (A-J). The stocktake system reads columns A-K but only uses A-J (column K/Status is optional and may be empty).

| Column | Field | Type | Required | Description |
|--------|-------|------|----------|-------------|
| A | Barcode | string | Yes | Product barcode (EAN-13, UPC, etc.) |
| B | Product | string | Yes | Product description/name |
| C | Quantity | number | Yes | Counted quantity (can be decimal) |
| D | Location | string | Yes | Where item was counted (e.g., "Cooler 1") |
| E | User | string | Yes | Who performed the count |
| F | Timestamp | string | Yes | ISO 8601 format (e.g., "2025-01-27T14:30:00Z") |
| G | Stock Level | string/number | No | Stock level indicator or number |
| H | $ Value | number | No | Calculated dollar value |
| I | Synced | string | Yes | Always "Yes" for synced scans |
| J | Sync ID | string | Yes | Unique identifier for sync operation (used for updates/deletes) |

**Column K (Status):** Not written by Stock app, but stocktake system may read it (will be empty).

#### Sheet Structure
```
Sheet Name: "Raw Scans"
Row 1: Headers (Barcode, Product, Quantity, Location, User, Timestamp, Stock Level, $ Value, Synced, Sync ID)
Row 2+: Data rows
```

**Important:** The Stock app creates multiple sheets:
- **"Raw Scans"** - This is what stocktake reads (columns A-J)
- **"Tally"** - Aggregated view (not used by stocktake)
- **"Manual"** - Manual entries (not currently used by stocktake)
- **"Kegs"** - Keg counts (not currently used by stocktake)
- **"Deleted Scans"** - Audit trail (not used by stocktake)

### Data Requirements

1. **Header Row:** Must be present in row 1
2. **Barcode Format:** String, no spaces (e.g., "9300857058404")
3. **Quantity:** Numeric, can be decimal (e.g., 15.5)
4. **Multiple Scans:** Same barcode can appear multiple times (will be summed)
5. **Empty Cells:** Use empty string, not null

### Example Data

**Raw Scans Sheet (A-J):**
```csv
Barcode,Product,Quantity,Location,User,Timestamp,Stock Level,$ Value,Synced,Sync ID
9300857058404,Great Northern Original 4.2% 330mL Bottle,24,Cooler 1,John,2025-01-27T14:30:00Z,50,1020.00,Yes,1737982200000-0.123456789
9300857058404,Great Northern Original 4.2% 330mL Bottle,12,Cooler 2,Sarah,2025-01-27T14:35:00Z,50,510.00,Yes,1737982500000-0.987654321
9313419522225,Hahn Super Dry 4.6% 330mL,18,Cooler 1,John,2025-01-27T14:32:00Z,45,810.00,Yes,1737982320000-0.456789123
```

**Notes:**
- Sync ID format: `{timestamp}-{random}` (e.g., `1737982200000-0.123456789`)
- Synced column: Always "Yes" for synced scans
- Stock Level: Can be number or string
- The stocktake system will automatically sum multiple rows with the same barcode (24 + 12 = 36 total for Great Northern)

### Google Drive Folder & Sheet Structure

**Stock App Creates:**
- Individual Google Spreadsheets (one per stocktake)
- Sheet Name Format: `Stocktake - {name} - {date}` (e.g., "Stocktake - December 2025 - 2025-01-27 14:30")
- Each spreadsheet contains multiple sheets:
  - **"Raw Scans"** - This is what stocktake reads (columns A-J)
  - "Tally" - Aggregated view (not used by stocktake)
  - "Manual" - Manual entries (not currently used by stocktake)
  - "Kegs" - Keg counts (not currently used by stocktake)
  - "Deleted Scans" - Audit trail (not used by stocktake)
  - "Metadata" - Stocktake info (not used by stocktake)

**Stocktake System Expects:**
- Currently looks for sheets in a folder (`COUNT_SHEETS_FOLDER_ID`)
- **⚠️ MISMATCH:** Stock app creates individual spreadsheets, not sheets in a folder
- **Workaround:** Stocktake admin must manually enter spreadsheet ID, OR:
  - Stock app could create spreadsheets in a specific folder
  - Stocktake system could search Drive for "Stocktake -" spreadsheets (like Stock app does)

**Current Workflow:**
1. Stock app creates stocktake → Creates new spreadsheet
2. Admin gets spreadsheet ID from Stock app
3. Admin manually enters spreadsheet ID in stocktake system
4. Stocktake system reads from "Raw Scans" sheet

**Permissions:** Service account needs **view access** to the spreadsheet

### Authentication

- **Method:** Google Service Account
- **Stock App:** Needs write access to Google Sheets
- **Stocktake System:** Uses service account with read access
- **Credentials:** Service account JSON key stored as Cloudflare secret

---

## Stocktake System → Stock (Count App)

### Current: No Direct Communication

The stocktake system does **not** currently send data back to the stock app. It only reads from Google Sheets.

### Future: Potential Notifications

If needed in the future, stocktake could notify stock app via:
- Webhook when stocktake starts
- Webhook when stocktake finishes
- Status updates via Google Sheets (new column)

---

## Shared Resources

### Google Sheets

#### Count Sheets Folder
- **Purpose:** Stores all count sheets
- **Access:** 
  - Stock app: Write access
  - Stocktake: Read access (via service account)
- **Location:** `COUNT_SHEETS_FOLDER_ID` environment variable

#### Barcode Mapping Sheet
- **Purpose:** Maps barcodes to product descriptions
- **Format:** Column A = Barcode, Column B = Product Description
- **Access:** Both systems read (stock app may write to maintain mapping)
- **Location:** `BARCODE_SHEET_ID` environment variable

### Data Flow Diagram

```
┌─────────────────┐
│   Stock App     │
│ (Barcode Scan)  │
└────────┬────────┘
         │
         │ Writes
         ↓
┌─────────────────┐
│  Google Sheets  │
│  (Count Data)   │
└────────┬────────┘
         │
         │ Reads
         ↓
┌─────────────────┐
│ Stocktake System│
│  (Variance Calc) │
└─────────────────┘
```

---

## Data Processing Rules

### How Stocktake Processes Count Data

1. **Reads all rows** from selected count sheet (skips header)
2. **Groups by barcode** and sums quantities
3. **Maps barcode to product** using barcode mapping sheet
4. **Matches to theoretical stock** by product description
5. **Calculates variance** = Counted - Theoretical

### Important Behaviors

- **Multiple Scans:** Automatically summed (e.g., 3 scans of same barcode = total)
- **No Barcode Match:** Item shown in blue, excluded from .dat export
- **Zero Quantity:** Treated as not counted (shown in yellow)
- **Manual Adjustments:** Stocktake allows manual overrides (stored in Audit Trail)

---

## Error Handling

### If Stock App Can't Write to Sheet
- **Stock App Responsibility:** Handle write errors, retry logic
- **Stocktake Impact:** Will read whatever data is available (may be incomplete)

### If Stocktake Can't Read Sheet
- **Stocktake Behavior:** Shows error, allows retry
- **Stock App Impact:** None (continues writing)

### If Sheet Format Changes
- **Breaking Change:** Must coordinate updates to both systems
- **Versioning:** Update this contract, notify both teams

---

## Testing

### Test Scenarios

1. **Single Scan:** One barcode, one row → Stocktake shows count
2. **Multiple Scans:** Same barcode, multiple rows → Stocktake sums correctly
3. **New Barcode:** Barcode not in mapping → Stocktake shows as "no barcode"
4. **Empty Sheet:** No data → Stocktake shows all items as uncounted
5. **Large Dataset:** 1000+ rows → Stocktake processes without timeout

### Test Data

```csv
Barcode,Product,Quantity,Location,User,Timestamp,Stock Level,$ Value,Synced,Status,Sync ID
9300857058404,Test Product 1,10,Location A,TestUser,2025-01-27T10:00:00Z,Medium,100.00,true,Complete,test-001
9300857058404,Test Product 1,5,Location B,TestUser,2025-01-27T10:05:00Z,Medium,50.00,true,Complete,test-002
```

**Expected Result:** Stocktake shows total quantity of 15 for Test Product 1

---

## Versioning & Compatibility

### Current Version
- **Contract Version:** 1.0
- **Column Count:** 11 columns (A-K)
- **Last Breaking Change:** Initial version

### Breaking Changes Policy

If column structure changes:
1. **Update this contract** with new version
2. **Notify both teams** with 2 weeks notice
3. **Update stocktake's `getCountData()`** function
4. **Test thoroughly** before deployment
5. **Deploy both systems** together

### Backwards Compatibility

- **Adding columns:** Safe (stocktake ignores extra columns)
- **Removing columns:** Breaking (requires contract update)
- **Changing column order:** Breaking (requires contract update)
- **Changing data types:** Breaking (requires contract update)

---

## Monitoring & Logging

### What to Monitor

- **Stock App:**
  - Write success rate to Google Sheets
  - API quota usage
  - Error rates

- **Stocktake System:**
  - Read success rate from Google Sheets
  - Data processing time
  - Variance calculation accuracy

### Logging

- **Stock App:** Log all write operations (barcode, quantity, timestamp)
- **Stocktake:** Log read operations and any data format errors

---

## Deployment

### Deployment Order

1. **Stock App:** Deploy first (ensures data is being written)
2. **Stocktake:** Deploy second (can immediately read data)
3. **Verify:** Test integration with sample data
4. **Monitor:** Watch for errors in both systems

### Rollback Plan

- **If Stock App breaks:** Stocktake continues with existing data
- **If Stocktake breaks:** Stock app continues writing (data accumulates)
- **If integration breaks:** Both systems can operate independently

---

## Contacts & Maintenance

**Stock App Owner:** [To be filled]  
**Stocktake System Owner:** [To be filled]  
**Integration Maintainer:** [To be filled]

---

## Change Log

| Date | Version | Change | Breaking? | Notes |
|------|---------|--------|-----------|-------|
| 2025-01-27 | 1.0 | Initial contract | - | Based on stocktake system requirements |

---

## Notes

### Current Limitations

1. **No Real-time Sync:** Stocktake reads on-demand, not real-time
2. **No Bidirectional Communication:** Stocktake doesn't send data back
3. **Manual Sheet Selection:** Admin must manually select count sheet in UI
4. **Column Mismatch:** Stock app writes 10 columns (A-J), stocktake reads 11 (A-K) - see "Known Issues" below

### Known Issues

#### ✅ FIXED: Column Mapping Mismatch (Resolved)

**Previous Problem:**
- Stock app writes Sync ID in column **J** (index 9)
- Stocktake system was reading Sync ID from column **K** (index 10)

**Status:** ✅ **FIXED** in google-sheets-v2.js and google-sheets.js
- Both files now correctly read `syncId: row[9]` (Column J)
- Sync ID is now read correctly from the correct column

**Fixed in:**
- `stocktake-system/cloudflare-worker/services/google-sheets-v2.js` line 321
- `stocktake-system/cloudflare-worker/services/google-sheets.js` line 283

### Product Database Column B Requirement

**IMPORTANT:** The Product Database sheet (in Master Sheet) must have:
- **Column A:** Barcode (e.g., "9300857058404")
- **Column B:** Stock Description (e.g., "Great Northern Original 4.2% 330mL Bottle")

**Column B MUST contain the exact Stock Description** as it appears in the HnL file's "Stock Description" column (Column C in HnL export).

**Why this matters:**
- The Stock app reads Column B to display product names when scanning
- The variance calculator matches counted items to theoretical items by description
- If Column B contains InvCode instead of Description, matching will fail

**Verified in code:**
- `google-sheets-v2.js:200` - Uses `item.description` for barcode lookup
- `variance-calculator.js:54` - Matches by `item.description`
- `export.js:72,126` - Uses `item.description` for barcode mapping

### Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Automatic sheet selection based on date/time
- [ ] Stocktake → Stock app notifications
- [ ] Conflict resolution for concurrent edits
- [ ] Batch processing for large datasets

---

## Quick Reference

### For Stock App Developers

**You need to:**
- Write to Google Sheets with exact column format (A-K)
- Include header row
- Handle multiple scans of same barcode (can be separate rows)
- Ensure service account has write access

### For Stocktake Developers

**You need to:**
- Read from Google Sheets using `getCountData()`
- Sum quantities by barcode
- Handle missing/empty columns gracefully
- Map barcodes to products using barcode mapping sheet

### Column Mapping Reference

```javascript
// Stock app writes (AppsScript.gs line 283-294):
const scanRow = [
  scan.barcode,        // A - row[0]
  scan.product,        // B - row[1]
  scan.quantity,        // C - row[2]
  scan.location,        // D - row[3]
  scan.user,           // E - row[4]
  scan.timestamp,       // F - row[5]
  scan.stockLevel || '', // G - row[6]
  scan.value || '',     // H - row[7]
  'Yes',               // I - row[8] (always "Yes" for synced)
  scan.syncId           // J - row[9]
];
// Total: 10 columns (A-J)

// Stocktake reads (google-sheets-v2.js line 311-322):
// ✅ CORRECTED - Now reads A-J correctly
{
  barcode: row[0] || '',                    // A
  product: row[1] || '',                    // B
  quantity: parseFloat(row[2]) || 0,        // C
  location: row[3] || '',                   // D
  user: row[4] || '',                       // E
  timestamp: row[5] || '',                  // F
  stockLevel: row[6] || '',                 // G
  value: parseFloat(row[7]) || 0,           // H
  synced: row[8] || '',                     // I
  syncId: row[9] || ''                      // J ✅ FIXED - Correctly reads from column J
}
```

**✅ FIXED:**
- Stock app writes Sync ID in column **J** (index 9)
- Stocktake now correctly reads Sync ID from column **J** (index 9)
- Sync ID mapping is now correct!

