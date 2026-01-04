# Fixes Applied - Stock-Reconciliation System

**Date:** 2025-01-27  
**Based on:** Integration contract with Stock app (barcode scanning tool)

## Summary

Fixed critical integration issues in stock-reconciliation system to properly work with the Stock app. All changes were made to stock-reconciliation only (no changes to Stock app).

---

## ✅ Fixes Applied

### 1. **Fixed Column Mapping Bug** (CRITICAL)

**Files Changed:**
- `cloudflare-worker/services/google-sheets.js`
- `cloudflare-worker/services/google-sheets-v2.js`

**Problem:**
- Stock app writes 10 columns (A-J) to "Raw Scans" sheet
- Stocktake was reading 11 columns (A-K) and getting syncId from wrong column (row[10] instead of row[9])
- Stocktake was reading from default sheet instead of "Raw Scans" sheet

**Fix:**
- Changed to read from `'Raw Scans'!A:J` (correct sheet and range)
- Fixed syncId to read from `row[9]` (column J) instead of `row[10]` (column K)
- Removed unused `status` field that doesn't exist in Stock app format

**Code Change:**
```javascript
// Before:
const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${countSheetId}/values/A:K`,
    ...
);
return rows.slice(1).map(row => ({
    ...
    syncId: row[10] || ''  // WRONG - column K doesn't exist
}));

// After:
const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${countSheetId}/values/'Raw Scans'!A:J`,
    ...
);
return rows.slice(1).map(row => ({
    ...
    syncId: row[9] || ''  // CORRECT - column J (index 9)
}));
```

---

### 2. **Fixed Sheet Name** (CRITICAL)

**Files Changed:**
- `cloudflare-worker/services/google-sheets.js`
- `cloudflare-worker/services/google-sheets-v2.js`

**Problem:**
- Stock app writes to "Raw Scans" sheet within the spreadsheet
- Stocktake was reading from default sheet (first sheet)

**Fix:**
- Updated to explicitly read from `'Raw Scans'!A:J`

---

### 3. **Fixed Count Sheets Listing** (IMPORTANT)

**Files Changed:**
- `cloudflare-worker/services/google-sheets.js`
- `cloudflare-worker/services/google-sheets-v2.js`

**Problem:**
- Stock app creates individual spreadsheets (not sheets in a folder)
- Stocktake was looking for sheets within a folder
- Stock app names spreadsheets: `Stocktake - {name} - {date}`

**Fix:**
- Updated `listSheetsInFolder()` to search for spreadsheets with "Stocktake -" in the name
- If `COUNT_SHEETS_FOLDER_ID` is set, searches within that folder
- Otherwise, searches all Drive for "Stocktake -" spreadsheets
- Orders by modifiedTime (newest first)

**Code Change:**
```javascript
// Before:
const query = `'${folderId}'+in+parents+and+mimeType='application/vnd.google-apps.spreadsheet'`;

// After:
let query;
if (folderId && folderId !== 'YOUR_GOOGLE_DRIVE_FOLDER_ID') {
    query = `'${folderId}'+in+parents+and+title+contains+'Stocktake -'+and+mimeType='application/vnd.google-apps.spreadsheet'`;
} else {
    query = `title+contains+'Stocktake -'+and+mimeType='application/vnd.google-apps.spreadsheet'`;
}
```

---

### 4. **Switched to google-sheets-v2.js** (IMPORTANT)

**Files Changed:**
- `cloudflare-worker/index.js`

**Problem:**
- `google-sheets.js` has placeholder JWT signing that throws error
- `google-sheets-v2.js` has proper implementation with jose library

**Fix:**
- Changed import to use `google-sheets-v2.js` instead of `google-sheets.js`

**Code Change:**
```javascript
// Before:
import { GoogleSheetsAPI } from './services/google-sheets';

// After:
import { GoogleSheetsAPI } from './services/google-sheets-v2';
```

---

### 5. **Updated Code Review Documentation**

**Files Changed:**
- `CODE_REVIEW.md`

**Updates:**
- Marked column mapping bug as FIXED
- Updated integration questions with answers about Stock app
- Updated architectural concerns to reflect Stock app integration
- Added notes about Stock app's "Raw Scans" sheet format
- Updated priority list to reflect fixes applied

---

## Integration Details

### Stock App Format (What We're Reading)

**Sheet Name:** "Raw Scans"  
**Columns (A-J):**
1. A: Barcode
2. B: Product
3. C: Quantity
4. D: Location
5. E: User
6. F: Timestamp
7. G: Stock Level
8. H: $ Value
9. I: Synced (always "Yes")
10. J: Sync ID

**Spreadsheet Structure:**
- Stock app creates individual spreadsheets (not sheets in a folder)
- Spreadsheet name: `Stocktake - {name} - {date}`
- Each spreadsheet contains multiple sheets:
  - "Raw Scans" ← **This is what stocktake reads**
  - "Tally" (aggregated view)
  - "Manual" (manual entries)
  - "Kegs" (keg counts)
  - "Deleted Scans" (audit trail)
  - "Metadata" (stocktake info)

---

## Testing Checklist

After deployment, verify:

- [ ] Can list stocktake spreadsheets (searches for "Stocktake -" in name)
- [ ] Can read from "Raw Scans" sheet (not default sheet)
- [ ] Sync ID is read correctly (from column J, not K)
- [ ] All 10 columns are mapped correctly
- [ ] Multiple scans of same barcode are summed correctly
- [ ] Variance calculations work with Stock app data

---

## Remaining Issues (Not Fixed)

These are documented in `CODE_REVIEW.md` and still need attention:

1. **Authentication system** - Token storage/validation broken
2. **Client-side password hashing** - Security issue
3. **CORS allows all origins** - Security issue
4. **No input validation** - Security issue
5. **No error handling** - Will crash on bad data
6. **No caching** - Performance issue
7. **No pagination** - Performance issue for large datasets

---

## Files Modified

1. `cloudflare-worker/services/google-sheets.js`
2. `cloudflare-worker/services/google-sheets-v2.js`
3. `cloudflare-worker/index.js`
4. `CODE_REVIEW.md`
5. `INTEGRATION_CONTRACT_STOCK_STOCKTAKE.md` (created earlier)

---

## Next Steps

1. **Test the fixes** with actual Stock app data
2. **Deploy to Cloudflare Workers**
3. **Verify integration** works end-to-end
4. **Address remaining security issues** (see CODE_REVIEW.md)
5. **Add caching** for better performance
6. **Add error handling** for robustness

---

## Notes

- All changes are backward compatible (won't break existing functionality)
- Changes align with actual Stock app implementation
- Integration contract documents the exact format expected
- No changes made to Stock app (as requested)



